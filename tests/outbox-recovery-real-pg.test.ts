import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db, bloodRequests, donorNotifications, donorProfiles, donorPushSubscriptions, eq, inArray } from '../packages/db/src/index.ts';
import { NotificationOutboxService } from '../apps/api/src/services/notification-outbox.ts';
import { pushNotificationService } from '../apps/api/src/services/push-notifications.ts';

describe('Checkpoint 4.2: Durable Outbox Recovery & PostgreSQL Row Locking', () => {
  let outbox1: NotificationOutboxService;
  let outbox2: NotificationOutboxService;

  const testRequestId = 'req-outbox-test-001';
  const testTerminalReqId = 'req-outbox-terminal-002';
  let testDonor1: string;
  let testDonor2: string;
  let testDonor3: string;

  beforeAll(async () => {
    process.env.TEST_LIVE_DB = 'true';

    outbox1 = new NotificationOutboxService();
    outbox2 = new NotificationOutboxService();
    outbox1.setWorkerId('worker-instance-1');
    outbox2.setWorkerId('worker-instance-2');

    expect(outbox1.isLiveDb()).toBe(true);
    expect(outbox2.isLiveDb()).toBe(true);

    // Fetch existing valid donor profile IDs from PostgreSQL
    const existingDonors = await db.select({ id: donorProfiles.id }).from(donorProfiles).limit(3);
    expect(existingDonors.length).toBeGreaterThanOrEqual(1);
    testDonor1 = existingDonors[0].id;
    testDonor2 = existingDonors[1]?.id || existingDonors[0].id;
    testDonor3 = existingDonors[2]?.id || existingDonors[0].id;

    // Ensure test donors have registered push tokens for outbox dispatch tests
    await db.insert(donorPushSubscriptions).values({
      donorId: testDonor1,
      fcmToken: 'test-token-recovery-' + testDonor1,
      platform: 'web',
    }).onConflictDoNothing();

    // Clean up any previous test data
    await db.delete(donorNotifications).where(inArray(donorNotifications.requestId, [testRequestId, testTerminalReqId]));
    await db.delete(bloodRequests).where(inArray(bloodRequests.id, [testRequestId, testTerminalReqId]));

    // Seed test blood requests
    await db.insert(bloodRequests).values([
      {
        id: testRequestId,
        bloodGroupNeeded: 'B+',
        unitsNeeded: 2,
        patientName: 'Outbox Test Patient',
        patientAge: 40,
        emergencyType: 'accident',
        hospitalName: 'AIIMS New Delhi',
        latitude: 28.5672,
        longitude: 77.2100,
        status: 'donors_notified',
        createdAt: new Date(),
      },
      {
        id: testTerminalReqId,
        bloodGroupNeeded: 'O+',
        unitsNeeded: 1,
        patientName: 'Terminal Patient',
        patientAge: 30,
        emergencyType: 'surgery',
        hospitalName: 'Safdarjung Hospital',
        latitude: 28.5700,
        longitude: 77.2100,
        status: 'cancelled', // already cancelled
        createdAt: new Date(),
      },
    ]);
  }, 30000);

  afterAll(async () => {
    try {
      await db.delete(donorNotifications).where(inArray(donorNotifications.requestId, [testRequestId, testTerminalReqId]));
      await db.delete(bloodRequests).where(inArray(bloodRequests.id, [testRequestId, testTerminalReqId]));
      await db.delete(donorPushSubscriptions).where(eq(donorPushSubscriptions.fcmToken, 'test-token-recovery-' + testDonor1));
    } catch {}
    delete process.env.TEST_LIVE_DB;
  }, 30000);

  test('1. Pending notification records are recoverable from PostgreSQL after restart', async () => {
    const notifId = 'notif-recover-001';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    try {
      await db.insert(donorNotifications).values({
        id: notifId,
        requestId: testRequestId,
        donorId: testDonor1,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 5000), // ready for claiming
      });

      // Simulate API process restart: create a new worker instance
      const freshWorker = new NotificationOutboxService();
      freshWorker.setWorkerId('restarted-api-worker');

      const claimed = await freshWorker.claimBatch('restarted-api-worker', 10);
      const target = claimed.find((c) => c.id === notifId);

      expect(target).toBeDefined();
      expect(target?.status).toBe('processing');
      expect(target?.attempts).toBe(1);

      // Verify in database that status is now 'processing' and locked
      const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
      expect(row.status).toBe('processing');
      expect(row.lockedBy).toBe('restarted-api-worker');
    } finally {
      await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));
    }
  }, 25000);

  test('2. Multiple concurrent workers atomically claim non-overlapping batches via SKIP LOCKED', async () => {
    const notifIdA = 'notif-concurrent-A';
    const notifIdB = 'notif-concurrent-B';

    await db.delete(donorNotifications).where(inArray(donorNotifications.id, [notifIdA, notifIdB]));

    try {
      await db.insert(donorNotifications).values([
        {
          id: notifIdA,
          requestId: testRequestId,
          donorId: testDonor1,
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          nextRetryAt: new Date(Date.now() - 5000),
        },
        {
          id: notifIdB,
          requestId: testRequestId,
          donorId: testDonor2,
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          nextRetryAt: new Date(Date.now() - 5000),
        },
      ]);

      // Both workers claim batches
      const claimed1 = await outbox1.claimBatch('worker-1', 1);
      const claimed2 = await outbox2.claimBatch('worker-2', 1);

      const ids1 = claimed1.map((c) => c.id);
      const ids2 = claimed2.map((c) => c.id);

      // Both workers claimed exactly 1 item
      expect(ids1.length).toBe(1);
      expect(ids2.length).toBe(1);

      // ZERO overlap between Worker 1 and Worker 2 claims (FOR UPDATE SKIP LOCKED)
      const intersection = ids1.filter((id) => ids2.includes(id));
      expect(intersection).toHaveLength(0);
    } finally {
      await db.delete(donorNotifications).where(inArray(donorNotifications.id, [notifIdA, notifIdB]));
    }
  }, 25000);

  test('3. Stale locked records abandoned by dead workers (>120s) are safely reclaimed', async () => {
    const notifIdStale = 'notif-stale-crashed-worker';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifIdStale));

    try {
      // Insert record locked 5 minutes ago by a dead worker
      const fiveMinutesAgo = new Date(Date.now() - 300000);

      await db.insert(donorNotifications).values({
        id: notifIdStale,
        requestId: testRequestId,
        donorId: testDonor3,
        status: 'processing',
        lockedBy: 'dead-worker-pid-9999',
        lockedAt: fiveMinutesAgo,
        attempts: 1,
        maxAttempts: 3,
      });

      // New active worker claims with 120s stale timeout
      const claimed = await outbox1.claimBatch('active-worker', 10, 120);
      const recovered = claimed.find((c) => c.id === notifIdStale);

      expect(recovered).toBeDefined();
      expect(recovered?.attempts).toBe(2); // incremented from 1 to 2

      const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifIdStale));
      expect(row.status).toBe('processing');
      expect(row.lockedBy).toBe('active-worker');
    } finally {
      await db.delete(donorNotifications).where(eq(donorNotifications.id, notifIdStale));
    }
  }, 25000);

  test('4. Terminal parent request status (cancelled/expired/fulfilled) suppresses donor notifications', async () => {
    const notifIdTerminal = 'notif-terminal-suppress';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifIdTerminal));

    try {
      await db.insert(donorNotifications).values({
        id: notifIdTerminal,
        requestId: testTerminalReqId, // points to cancelled request
        donorId: testDonor1,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 5000),
      });

      let pushSent = false;
      const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
      pushNotificationService.sendDonationRequest = async () => {
        pushSent = true;
        return { success: true, messageId: 'unexpected-msg' };
      };

      try {
        const claimed = await outbox1.claimBatch('worker-terminal', 10);
        const target = claimed.filter((c) => c.id === notifIdTerminal);
        expect(target).toHaveLength(1);

        const summary = await outbox1.processClaimed(target, 'worker-terminal');

        // The push dispatch must NEVER be called
        expect(pushSent).toBe(false);
        expect(summary.cancelledCount).toBe(1);

        // Database status must reflect cancellation
        const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifIdTerminal));
        expect(row.status).toBe('cancelled');
        expect(row.errorDetails).toContain('cancelled');
      } finally {
        pushNotificationService.sendDonationRequest = origSend;
      }
    } finally {
      await db.delete(donorNotifications).where(eq(donorNotifications.id, notifIdTerminal));
    }
  }, 25000);

  test('5. Max attempts policy transitions failed notifications to exhausted state', async () => {
    const notifIdExhaust = 'notif-retry-exhaust-001';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifIdExhaust));

    try {
      // Insert notification that is on its final 3rd attempt
      await db.insert(donorNotifications).values({
        id: notifIdExhaust,
        requestId: testRequestId,
        donorId: testDonor1,
        status: 'pending',
        attempts: 2, // will become 3 on claim
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 5000),
      });

      // Mock push service to return simulated transient error
      const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
      pushNotificationService.sendDonationRequest = async () => {
        return { success: false, error: 'Simulated 503 Service Unavailable' };
      };

      try {
        const claimed = await outbox1.claimBatch('worker-retry', 10);
        const target = claimed.filter((c) => c.id === notifIdExhaust);
        expect(target).toHaveLength(1);
        expect(target[0].attempts).toBe(3);

        const summary = await outbox1.processClaimed(target, 'worker-retry');
        expect(summary.exhaustedCount).toBe(1);

        const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifIdExhaust));
        expect(row.status).toBe('exhausted');
        expect(row.errorDetails).toContain('Simulated 503');
      } finally {
        pushNotificationService.sendDonationRequest = origSend;
      }
    } finally {
      await db.delete(donorNotifications).where(eq(donorNotifications.id, notifIdExhaust));
    }
  }, 25000);

  test('6. Observability: getOutboxMetrics returns aggregate counts across statuses', async () => {
    const metrics = await outbox1.getOutboxMetrics();
    expect(metrics).toHaveProperty('pending');
    expect(metrics).toHaveProperty('processing');
    expect(metrics).toHaveProperty('sent');
    expect(metrics).toHaveProperty('failed');
    expect(metrics).toHaveProperty('exhausted');
    expect(metrics).toHaveProperty('cancelled');
    expect(metrics.total).toBeGreaterThanOrEqual(1);
  }, 25000);
});
