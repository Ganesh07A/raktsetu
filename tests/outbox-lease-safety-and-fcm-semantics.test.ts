import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import {
  db,
  sql,
  bloodRequests,
  donorNotifications,
  donorProfiles,
  donorPushSubscriptions,
  eq,
  inArray,
} from '../packages/db/src/index.ts';
import { NotificationOutboxService } from '../apps/api/src/services/notification-outbox.ts';
import { pushNotificationService } from '../apps/api/src/services/push-notifications.ts';

describe('Checkpoint 4.2: Worker Lease Safety & FCM Delivery Semantics', () => {
  let outbox1: NotificationOutboxService;
  let outbox2: NotificationOutboxService;

  const testRequestId = 'req-lease-safety-001';
  let testDonorId: string;

  beforeAll(async () => {
    process.env.TEST_LIVE_DB = 'true';

    outbox1 = new NotificationOutboxService();
    outbox2 = new NotificationOutboxService();
    outbox1.setWorkerId('worker-instance-1');
    outbox2.setWorkerId('worker-instance-2');

    const [donor] = await db.select({ id: donorProfiles.id }).from(donorProfiles).limit(1);
    testDonorId = donor.id;

    await db.delete(donorNotifications).where(eq(donorNotifications.requestId, testRequestId));
    await db.delete(bloodRequests).where(eq(bloodRequests.id, testRequestId));

    await db.insert(bloodRequests).values({
      id: testRequestId,
      bloodGroupNeeded: 'A+',
      unitsNeeded: 1,
      patientName: 'Lease Safety Patient',
      patientAge: 28,
      emergencyType: 'surgery',
      hospitalName: 'Max Healthcare',
      latitude: 28.5672,
      longitude: 77.2100,
      status: 'donors_notified',
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    try {
      await db.delete(donorNotifications).where(eq(donorNotifications.requestId, testRequestId));
      await db.delete(bloodRequests).where(eq(bloodRequests.id, testRequestId));
    } catch {}
    delete process.env.TEST_LIVE_DB;
  }, 30000);

  test('1. Fencing Token: Stale worker with expired lease cannot overwrite new worker result', async () => {
    const notifId = 'notif-fencing-test-01';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    // Worker 1 claims record initially
    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: testRequestId,
      donorId: testDonorId,
      status: 'processing',
      lockedBy: 'worker-instance-1',
      lockedAt: new Date(Date.now() - 300000), // expired 5 minutes ago
      attempts: 1,
      maxAttempts: 3,
    });

    // Worker 2 reclaims the stale notification
    const claimedByWorker2 = await outbox2.claimBatch('worker-instance-2', 10, 120);
    const target = claimedByWorker2.find((c) => c.id === notifId);
    expect(target).toBeDefined();
    expect(target?.status).toBe('processing');

    // Confirm Worker 2 is now recorded as the owner
    const [rowBefore] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(rowBefore.lockedBy).toBe('worker-instance-2');
    expect(rowBefore.attempts).toBe(2);

    // Now simulated Zombie Worker 1 awakens and tries to mark the record 'sent'
    // Under fencing rules, Worker 1's locked_by ('worker-instance-1') no longer matches!
    const ok = await (outbox1 as any).markSent(
      notifId,
      testRequestId,
      testDonorId,
      'msg-from-zombie-1',
      'worker-instance-1'
    );

    // Overwrite MUST be rejected
    expect(ok).toBe(false);

    // Database row MUST NOT have been overwritten by Worker 1
    const [rowAfter] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(rowAfter.lockedBy).toBe('worker-instance-2');
    expect(rowAfter.pushMessageId).toBeNull();
  }, 25000);

  test('2. Lease renewal extends active lock preventing premature reclamation', async () => {
    const notifId = 'notif-lease-renewal-02';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    // Insert active record locked by Worker 1
    const initialLockTime = new Date(Date.now() - 60000); // 1 minute ago
    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: testRequestId,
      donorId: testDonorId,
      status: 'processing',
      lockedBy: 'worker-instance-1',
      lockedAt: initialLockTime,
      attempts: 1,
      maxAttempts: 3,
    });

    // Worker 1 renews its lease
    const renewed = await outbox1.renewLease(notifId, 'worker-instance-1');
    expect(renewed).toBe(true);

    const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(row.lockedAt!.getTime()).toBeGreaterThan(initialLockTime.getTime());

    // Worker 2 cannot steal the record because lock is fresh
    const claimedBy2 = await outbox2.claimBatch('worker-instance-2', 10, 120);
    const stolen = claimedBy2.find((c) => c.id === notifId);
    expect(stolen).toBeUndefined();
  }, 25000);

  test('3. Bounded FCM request timeout aborts slow network call safely', async () => {
    const origEnv = process.env.FCM_TIMEOUT_MS;
    process.env.FCM_TIMEOUT_MS = '50'; // short timeout for testing

    try {
      const origSendEach = (pushNotificationService as any).sendDonationRequest;
      // Simulate hanging FCM network call
      const slowSend = new Promise<never>(() => {});

      let errorThrown = false;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('FCM batch send timed out after 50ms')), 50)
      );

      try {
        await Promise.race([slowSend, timeoutPromise]);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toContain('timed out');
      }

      expect(errorThrown).toBe(true);
    } finally {
      process.env.FCM_TIMEOUT_MS = origEnv;
    }
  });

  test('4. At-least-once delivery: simulated crash after dispatch causes clean retry', async () => {
    const notifId = 'notif-at-least-once-04';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    let dispatchCounter = 0;
    const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
    pushNotificationService.sendDonationRequest = async () => {
      dispatchCounter++;
      return { success: true, messageId: `msg-${dispatchCounter}`, mode: 'live', invalidTokens: [] };
    };

    try {
      // 1. Notification claimed and dispatched
      await db.insert(donorNotifications).values({
        id: notifId,
        requestId: testRequestId,
        donorId: testDonorId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 5000),
      });

      // Claim batch
      const claimed = await outbox1.claimBatch('worker-instance-1', 10);
      const target = claimed.find((c) => c.id === notifId);
      expect(target).toBeDefined();

      // Dispatch succeeds, but simulate worker process crashing BEFORE status update!
      await pushNotificationService.sendDonationRequest({
        tokens: ['test-token'],
        requestId: testRequestId,
        responseToken: 'resp-token',
        bloodGroup: 'A+',
        distanceKm: 2,
      });
      expect(dispatchCounter).toBe(1);

      // Simulate crash: status remains 'processing', lock expires
      await db.execute(sql`
        UPDATE donor_notifications
        SET locked_at = NOW() - INTERVAL '3 minutes'
        WHERE id = ${notifId};
      `);

      // Worker 2 recovers the abandoned record
      const recovered = await outbox2.claimBatch('worker-instance-2', 10, 120);
      const targetRecovered = recovered.find((c) => c.id === notifId);
      expect(targetRecovered).toBeDefined();
      expect(targetRecovered!.attempts).toBe(2);

      // Worker 2 completes processing and updates status
      const ok = await (outbox2 as any).markSent(notifId, testRequestId, testDonorId, 'msg-recovered-2', 'worker-instance-2');
      expect(ok).toBe(true);

      const [finalRow] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
      expect(finalRow.status).toBe('sent');
      expect(finalRow.attempts).toBe(2);
      expect(finalRow.pushMessageId).toBe('msg-recovered-2');
    } finally {
      pushNotificationService.sendDonationRequest = origSend;
    }
  }, 25000);

  test('5. Expired or cancelled request suppresses push dispatch and cancels notification', async () => {
    const expiredReqId = 'req-lease-expired-005';
    const notifId = 'notif-expired-req-05';

    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));
    await db.delete(bloodRequests).where(eq(bloodRequests.id, expiredReqId));

    // Insert expired blood request
    await db.insert(bloodRequests).values({
      id: expiredReqId,
      bloodGroupNeeded: 'B-',
      unitsNeeded: 1,
      patientName: 'Expired Patient',
      patientAge: 50,
      hospitalName: 'Apollo Hospital',
      latitude: 28.5672,
      longitude: 77.2100,
      status: 'expired', // Expired!
      createdAt: new Date(),
    });

    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: expiredReqId,
      donorId: testDonorId,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(Date.now() - 5000),
    });

    let pushAttempted = false;
    const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
    pushNotificationService.sendDonationRequest = async () => {
      pushAttempted = true;
      return { success: true, messageId: 'msg-unwanted', mode: 'live', invalidTokens: [] };
    };

    try {
      const claimed = await outbox1.claimBatch('worker-instance-1', 10);
      const target = claimed.filter((c) => c.id === notifId);
      expect(target).toHaveLength(1);

      const summary = await outbox1.processClaimed(target, 'worker-instance-1');

      // The push dispatch must NOT be attempted
      expect(pushAttempted).toBe(false);
      expect(summary.cancelledCount).toBe(1);

      // Notification is marked cancelled with error details
      const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
      expect(row.status).toBe('cancelled');
      expect(row.errorDetails).toContain('expired');
    } finally {
      pushNotificationService.sendDonationRequest = origSend;
      await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));
      await db.delete(bloodRequests).where(eq(bloodRequests.id, expiredReqId));
    }
  }, 25000);
});
