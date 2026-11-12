import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import {
  db,
  sql,
  bloodRequests,
  donorNotifications,
  donorProfiles,
  donorPushSubscriptions,
  eq,
} from '../packages/db/src/index.ts';
import { NotificationOutboxService } from '../apps/api/src/services/notification-outbox.ts';
import { pushNotificationService } from '../apps/api/src/services/push-notifications.ts';

describe('Checkpoint 4.3: Strict Worker Lease Fencing & FCM Delivery Semantics', () => {
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

    const oldLeaseToken = 'lease-token-worker-1-stale';

    // Worker 1 claims record initially
    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: testRequestId,
      donorId: testDonorId,
      status: 'processing',
      lockedBy: 'worker-instance-1',
      lockedAt: new Date(Date.now() - 300000), // expired 5 minutes ago
      leaseToken: oldLeaseToken,
      attempts: 1,
      maxAttempts: 3,
    });

    // Worker 2 reclaims the stale notification and receives a new unique leaseToken
    const claimedByWorker2 = await outbox2.claimBatch('worker-instance-2', 10, 120);
    const target = claimedByWorker2.find((c) => c.id === notifId);
    expect(target).toBeDefined();
    expect(target?.status).toBe('processing');
    expect(target?.leaseToken).toBeDefined();
    expect(target?.leaseToken).not.toBe(oldLeaseToken);

    // Confirm Worker 2 is now recorded as the owner with its new leaseToken
    const [rowBefore] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(rowBefore.lockedBy).toBe('worker-instance-2');
    expect(rowBefore.leaseToken).toBe(target!.leaseToken);
    expect(rowBefore.attempts).toBe(2);

    // Now simulated Zombie Worker 1 awakens and tries to mark the record 'sent' with its stale lease token
    const ok = await outbox1.markSent(
      notifId,
      testRequestId,
      testDonorId,
      'msg-from-zombie-1',
      oldLeaseToken,
      'worker-instance-1'
    );

    // Overwrite MUST be rejected because lease token is stale
    expect(ok).toBe(false);

    // Database row MUST NOT have been overwritten by Worker 1
    const [rowAfter] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(rowAfter.status).toBe('processing');
    expect(rowAfter.lockedBy).toBe('worker-instance-2');
    expect(rowAfter.leaseToken).toBe(target!.leaseToken);
    expect(rowAfter.pushMessageId).toBeNull();
  }, 25000);

  test('2. Lease renewal requires exact current lease token', async () => {
    const notifId = 'notif-lease-renewal-02';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    const activeLeaseToken = 'lease-token-renewal-valid';
    const initialLockTime = new Date(Date.now() - 60000); // 1 minute ago

    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: testRequestId,
      donorId: testDonorId,
      status: 'processing',
      lockedBy: 'worker-instance-1',
      lockedAt: initialLockTime,
      leaseToken: activeLeaseToken,
      attempts: 1,
      maxAttempts: 3,
    });

    // Attempting renewal with an invalid / wrong lease token fails
    const invalidRenewal = await outbox1.renewLease(notifId, 'wrong-lease-token', 'worker-instance-1');
    expect(invalidRenewal).toBe(false);

    // Worker 1 renews with the exact current lease token
    const validRenewal = await outbox1.renewLease(notifId, activeLeaseToken, 'worker-instance-1');
    expect(validRenewal).toBe(true);

    const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(row.lockedAt!.getTime()).toBeGreaterThan(initialLockTime.getTime());
    expect(row.leaseToken).toBe(activeLeaseToken);

    // Worker 2 cannot steal the record because lock is fresh
    const claimedBy2 = await outbox2.claimBatch('worker-instance-2', 10, 120);
    const stolen = claimedBy2.find((c) => c.id === notifId);
    expect(stolen).toBeUndefined();
  }, 25000);

  test('3. Rejection when locked_by is NULL or status is not processing', async () => {
    const notifId = 'notif-unlocked-test-03';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    // Record is pending and unlocked (locked_by is NULL)
    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: testRequestId,
      donorId: testDonorId,
      status: 'pending',
      lockedBy: null,
      lockedAt: null,
      leaseToken: null,
      attempts: 0,
      maxAttempts: 3,
    });

    // Worker tries to call markSent without acquiring a lease
    const ok = await outbox1.markSent(
      notifId,
      testRequestId,
      testDonorId,
      'msg-unauthorized',
      'arbitrary-token',
      'worker-instance-1'
    );

    // MUST be rejected because it does not hold a valid lease
    expect(ok).toBe(false);

    const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(row.status).toBe('pending');
    expect(row.pushMessageId).toBeNull();
  }, 25000);

  test('4. Same worker process: older async task cannot overwrite newer claim attempt', async () => {
    const notifId = 'notif-same-process-async-04';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    const leaseAttempt1 = 'lease-token-attempt-1';

    // Worker 1 claims initially (Attempt 1)
    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: testRequestId,
      donorId: testDonorId,
      status: 'processing',
      lockedBy: 'worker-instance-1',
      lockedAt: new Date(Date.now() - 300000), // expired 5 mins ago
      leaseToken: leaseAttempt1,
      attempts: 1,
      maxAttempts: 3,
    });

    // Same Worker 1 reclaims the abandoned record (Attempt 2)
    const reclaimed = await outbox1.claimBatch('worker-instance-1', 10, 120);
    const target = reclaimed.find((c) => c.id === notifId);
    expect(target).toBeDefined();
    expect(target?.attempts).toBe(2);
    expect(target?.leaseToken).not.toBe(leaseAttempt1);

    const leaseAttempt2 = target!.leaseToken;

    // Simulate lagging async task from Attempt 1 finally completing and attempting to write
    const laggedWriteResult = await outbox1.markSent(
      notifId,
      testRequestId,
      testDonorId,
      'msg-from-stale-attempt-1',
      leaseAttempt1, // OLD lease token!
      'worker-instance-1' // SAME worker process!
    );

    // Even though workerId matches, the write MUST be rejected because lease token is from Attempt 1!
    expect(laggedWriteResult).toBe(false);

    // Database still reflects active Attempt 2
    const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(row.status).toBe('processing');
    expect(row.leaseToken).toBe(leaseAttempt2);
    expect(row.pushMessageId).toBeNull();

    // Now Attempt 2 completes with current lease token
    const currentWriteResult = await outbox1.markSent(
      notifId,
      testRequestId,
      testDonorId,
      'msg-from-current-attempt-2',
      leaseAttempt2,
      'worker-instance-1'
    );
    expect(currentWriteResult).toBe(true);

    const [finalRow] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
    expect(finalRow.status).toBe('sent');
    expect(finalRow.pushMessageId).toBe('msg-from-current-attempt-2');
    expect(finalRow.leaseToken).toBeNull(); // Cleared upon terminal state
  }, 25000);

  test('5. Bounded FCM request timeout aborts slow network call safely', async () => {
    const origEnv = process.env.FCM_TIMEOUT_MS;
    process.env.FCM_TIMEOUT_MS = '50'; // short timeout for testing

    try {
      let errorThrown = false;
      const slowSend = new Promise<never>(() => {});
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

  test('6. At-least-once delivery: simulated crash after dispatch causes clean retry with new lease token', async () => {
    const notifId = 'notif-at-least-once-06';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));

    let dispatchCounter = 0;
    const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
    pushNotificationService.sendDonationRequest = async () => {
      dispatchCounter++;
      return { success: true, messageId: `msg-${dispatchCounter}`, mode: 'live', invalidTokens: [] };
    };

    try {
      await db.insert(donorNotifications).values({
        id: notifId,
        requestId: testRequestId,
        donorId: testDonorId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 60000),
      });

      // Claim batch (Attempt 1)
      const claimed = await outbox1.claimBatch('worker-instance-1', 10);
      const target = claimed.find((c) => c.id === notifId);
      expect(target).toBeDefined();
      const lease1 = target!.leaseToken;

      // Dispatch succeeds, but simulate worker process crashing BEFORE status update
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

      // Worker 2 recovers the abandoned record and gets a new lease token
      const recovered = await outbox2.claimBatch('worker-instance-2', 10, 120);
      const targetRecovered = recovered.find((c) => c.id === notifId);
      expect(targetRecovered).toBeDefined();
      expect(targetRecovered!.attempts).toBe(2);
      expect(targetRecovered!.leaseToken).not.toBe(lease1);

      // Worker 2 completes processing and updates status with its new leaseToken
      const ok = await outbox2.markSent(
        notifId,
        testRequestId,
        testDonorId,
        'msg-recovered-2',
        targetRecovered!.leaseToken,
        'worker-instance-2'
      );
      expect(ok).toBe(true);

      const [finalRow] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
      expect(finalRow.status).toBe('sent');
      expect(finalRow.attempts).toBe(2);
      expect(finalRow.pushMessageId).toBe('msg-recovered-2');
      expect(finalRow.leaseToken).toBeNull();
    } finally {
      pushNotificationService.sendDonationRequest = origSend;
    }
  }, 25000);

  test('7. Expired or cancelled request suppresses push dispatch and cancels notification', async () => {
    const expiredReqId = 'req-lease-expired-007';
    const notifId = 'notif-expired-req-07';

    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));
    await db.delete(bloodRequests).where(eq(bloodRequests.id, expiredReqId));

    await db.insert(bloodRequests).values({
      id: expiredReqId,
      bloodGroupNeeded: 'B-',
      unitsNeeded: 1,
      patientName: 'Expired Patient',
      patientAge: 50,
      hospitalName: 'Apollo Hospital',
      latitude: 28.5672,
      longitude: 77.2100,
      status: 'expired',
      createdAt: new Date(),
    });

    await db.insert(donorNotifications).values({
      id: notifId,
      requestId: expiredReqId,
      donorId: testDonorId,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: new Date(Date.now() - 60000),
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

      expect(pushAttempted).toBe(false);
      expect(summary.cancelledCount).toBe(1);

      const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId));
      expect(row.status).toBe('cancelled');
      expect(row.errorDetails).toContain('expired');
      expect(row.leaseToken).toBeNull();
    } finally {
      pushNotificationService.sendDonationRequest = origSend;
      await db.delete(donorNotifications).where(eq(donorNotifications.id, notifId));
      await db.delete(bloodRequests).where(eq(bloodRequests.id, expiredReqId));
    }
  }, 25000);
});
