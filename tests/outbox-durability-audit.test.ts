import { describe, expect, test, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { mockStore } from '../apps/api/src/services/mock-store';
import { notificationOutbox, type OutboxDispatchItem } from '../apps/api/src/services/notification-outbox';
import { requestService } from '../apps/api/src/services/request-service';
import { pushNotificationService } from '../apps/api/src/services/push-notifications';
import type { BloodRequest } from '@repo/shared';

describe('Checkpoint 4.1: Notification Outbox Durability & Crash Recovery Audit', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  // =========================================================================
  // CRASH SCENARIO 1: CRASH AFTER REQUEST PERSISTENCE BUT BEFORE OUTBOX ENQUEUE
  // =========================================================================
  test('Crash Point 1: Request is safely preserved, but notifications are not dispatched', async () => {
    const requestId = 'req-crash-point-1';
    const request: BloodRequest = {
      id: requestId,
      requesterId: null,
      bloodGroupNeeded: 'O+',
      componentType: 'whole_blood',
      unitsNeeded: 2,
      patientName: 'Patient Crash 1',
      patientAge: 35,
      emergencyType: 'accident',
      hospitalName: 'Safdarjung Hospital',
      latitude: 28.57,
      longitude: 77.21,
      state: 'Delhi',
      district: 'New Delhi',
      searchRadiusKm: 10,
      status: 'donors_notified',
      fulfillmentSource: null,
      matchedBankId: null,
      matchedBankName: null,
      matchedBankPhone: null,
      matchedBankAddress: null,
      matchedBankDistanceKm: null,
      matchedBankProvenance: null,
      matchedBankVerificationStatus: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    // 1. Request persistence succeeds
    await requestService.createRequest(request);

    // 2. Simulate process crash before notificationOutbox.enqueue() is reached
    // Process exits or restarts here

    // 3. Post-crash audit verification:
    // Request must NOT be lost:
    const fetched = await requestService.getRequestWithDetails(requestId);
    expect(fetched).toBeDefined();
    expect(fetched!.request.id).toBe(requestId);
    expect(fetched!.request.status).toBe('donors_notified');

    // Notifications were never enqueued:
    expect(fetched!.notifications).toHaveLength(0);

    // AUDIT FINDING: Request is durable, but without an active outbox supervisor,
    // notifications for crashed requests require external reconciliation.
  });

  // =========================================================================
  // CRASH SCENARIO 2: CRASH AFTER NOTIFICATION ROW PERSISTENCE BUT BEFORE FCM
  // =========================================================================
  test('Crash Point 2: Notifications are durable in pending status, but in-memory queue is lost on restart', async () => {
    const requestId = 'req-crash-point-2';
    await requestService.createRequest({
      id: requestId,
      requesterId: null,
      bloodGroupNeeded: 'O+',
      componentType: 'whole_blood',
      unitsNeeded: 1,
      patientName: 'Patient Crash 2',
      patientAge: null,
      emergencyType: 'surgery',
      hospitalName: 'Hospital 2',
      latitude: 28.57,
      longitude: 77.21,
      state: 'Delhi',
      district: 'New Delhi',
      searchRadiusKm: 10,
      status: 'donors_notified',
      fulfillmentSource: null,
      matchedBankId: null,
      matchedBankName: null,
      matchedBankPhone: null,
      matchedBankAddress: null,
      matchedBankDistanceKm: null,
      matchedBankProvenance: null,
      matchedBankVerificationStatus: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const dispatchItem: OutboxDispatchItem = {
      requestId,
      bloodGroupNeeded: 'O+',
      donors: [
        {
          id: 'donor-crash-1',
          name: 'Donor Crash 1',
          phone: '+919876543211',
          bloodGroup: 'O+',
          distanceKm: 3.5,
        },
      ],
    };

    // 1. Simulate enqueueing in durable store
    await requestService.recordNotification({
      id: `notif-${requestId}-donor-crash-1`,
      requestId,
      donorId: 'donor-crash-1',
      status: 'pending',
      donorName: 'Donor Crash 1',
      donorBloodGroup: 'O+',
      donorPhoneMasked: '+91 98****3211',
      sentAt: new Date().toISOString(),
    });

    // 2. Simulate process death before FCM dispatch completes
    // In-memory queue lost

    // 3. Post-crash audit verification:
    const fetched = await requestService.getRequestWithDetails(requestId);
    expect(fetched!.notifications).toHaveLength(1);
    expect(fetched!.notifications[0].status).toBe('pending');
  });

  // =========================================================================
  // CRASH SCENARIO 3: CRASH AFTER FCM DISPATCH BUT BEFORE DB ACKNOWLEDGEMENT
  // =========================================================================
  test('Crash Point 3: FCM dispatch succeeds, crash before DB status update creates duplicate risk on naive retry', async () => {
    const requestId = 'req-crash-point-3';
    const donorId = 'donor-crash-3';
    let fcmDispatchCount = 0;

    await requestService.createRequest({
      id: requestId,
      requesterId: null,
      bloodGroupNeeded: 'A+',
      componentType: 'whole_blood',
      unitsNeeded: 1,
      patientName: 'Patient Crash 3',
      patientAge: null,
      emergencyType: 'surgery',
      hospitalName: 'Hospital 3',
      latitude: 28.57,
      longitude: 77.21,
      state: 'Delhi',
      district: 'New Delhi',
      searchRadiusKm: 10,
      status: 'donors_notified',
      fulfillmentSource: null,
      matchedBankId: null,
      matchedBankName: null,
      matchedBankPhone: null,
      matchedBankAddress: null,
      matchedBankDistanceKm: null,
      matchedBankProvenance: null,
      matchedBankVerificationStatus: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    // Seed mock donor push token
    mockStore.addPushSubscription(donorId, 'fcm-device-token-123');

    // Mock push service to track dispatch count and simulate crash immediately after
    const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
    pushNotificationService.sendDonationRequest = async (params: any) => {
      fcmDispatchCount++;
      return { success: true, messageId: `fcm-msg-${fcmDispatchCount}` };
    };

    try {
      const item: OutboxDispatchItem = {
        requestId,
        bloodGroupNeeded: 'A+',
        donors: [
          {
            id: donorId,
            name: 'Donor Crash 3',
            phone: '+919876543213',
            bloodGroup: 'A+',
            distanceKm: 2.1,
          },
        ],
      };

      // 1. Initial enqueue and dispatch runs
      const res1 = await notificationOutbox.enqueue(item);
      expect(res1.sentCount).toBe(1);
      expect(fcmDispatchCount).toBe(1);

      // Verify status updated to 'sent'
      const fetched1 = await requestService.getRequestWithDetails(requestId);
      expect(fetched1!.notifications).toHaveLength(1);
      expect(fetched1!.notifications[0].status).toBe('sent');

      // 2. If a crash had occurred before status update (simulated: status remained 'pending'):
      mockStore.setNotificationDelivery(requestId, donorId, 'pending');
      // If a naive re-try processes the same item again:
      const res2 = await notificationOutbox.processBatch(item);
      expect(fcmDispatchCount).toBe(2);

      // AUDIT FINDING: Outbox must check existing notification status before re-dispatching
      // to guarantee at-most-once or idempotent push notification delivery.
    } finally {
      pushNotificationService.sendDonationRequest = origSend;
    }
  });

  // =========================================================================
  // CRASH SCENARIO 4: DUPLICATE WORKER EXECUTION ACROSS REPLICAS
  // =========================================================================
  test('Crash Point 4: Concurrent worker execution without distributed lock risks duplicate delivery', async () => {
    const requestId = 'req-crash-point-4';
    const donorId = 'donor-crash-4';
    let dispatchCount = 0;

    mockStore.addPushSubscription(donorId, 'fcm-token-444');

    const origSend = pushNotificationService.sendDonationRequest.bind(pushNotificationService);
    pushNotificationService.sendDonationRequest = async (params: any) => {
      dispatchCount++;
      return { success: true, messageId: `msg-${dispatchCount}` };
    };

    try {
      const item: OutboxDispatchItem = {
        requestId,
        bloodGroupNeeded: 'B+',
        donors: [
          {
            id: donorId,
            name: 'Donor 4',
            phone: '+919876543214',
            bloodGroup: 'B+',
            distanceKm: 1.5,
          },
        ],
      };

      // Two workers simultaneously execute processBatch
      await Promise.all([
        notificationOutbox.processBatch(item),
        notificationOutbox.processBatch(item),
      ]);

      // Both workers executed dispatch
      expect(dispatchCount).toBe(2);

      // AUDIT FINDING: Without distributed row locking (e.g. pg_try_advisory_lock or SELECT FOR UPDATE SKIP LOCKED),
      // running multiple background outbox workers concurrently across containers can duplicate push notifications.
    } finally {
      pushNotificationService.sendDonationRequest = origSend;
    }
  });
});
