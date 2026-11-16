import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db, donorPushSubscriptions, donorNotifications, bloodRequests, eq, desc } from '../packages/db/src/index';
import { pushNotificationService } from '../apps/api/src/services/push-notifications';
import { notificationOutbox } from '../apps/api/src/services/notification-outbox';

describe('Checkpoint 4.8: Interactive Chrome FCM Delivery Verification', () => {
  const syntheticDonorId = 'donor-1794841871476-947';
  let activeToken: string = '';
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMockServices = process.env.MOCK_SERVICES;

  beforeAll(async () => {
    // Enable live delivery mode for interactive tests
    process.env.NODE_ENV = 'development';
    process.env.MOCK_SERVICES = 'false';

    // Fetch the registered Chrome Web Push token from database
    const subs = await db
      .select()
      .from(donorPushSubscriptions)
      .where(eq(donorPushSubscriptions.donorId, syntheticDonorId));
    
    if (subs.length > 0 && subs[0]?.fcmToken) {
      activeToken = subs[0].fcmToken;
    }
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.MOCK_SERVICES = originalMockServices;
  });

  // =========================================================================
  // PHASE 3: TOKEN REGISTRATION VERIFICATION
  // =========================================================================
  describe('Phase 3: Browser Interactive Registration Verification', () => {
    test('3.1: Confirms real Chrome FCM token registered in PostgreSQL', () => {
      expect(activeToken.length).toBeGreaterThan(100);
      const masked = activeToken.slice(0, 10) + '...' + activeToken.slice(-10);
      console.log('Verified registered Chrome FCM token (masked):', masked);
    });

    test('3.2: Confirms token metadata and browser user-agent stored in DB', async () => {
      const sub = (await db
        .select()
        .from(donorPushSubscriptions)
        .where(eq(donorPushSubscriptions.donorId, syntheticDonorId)))[0];
      
      expect(sub).toBeDefined();
      expect(sub.platform).toBe('web');
      expect(sub.userAgent).toContain('Chrome');
      expect(sub.updatedAt).toBeDefined();
    });
  });

  // =========================================================================
  // PHASE 4: DIRECT FCM DISPATCH TEST
  // =========================================================================
  describe('Phase 4: Direct FCM Test', () => {
    test('4.1: Direct FCM dispatch of harmless test alert to Chrome', async () => {
      expect(activeToken).toBeTruthy();

      const title = 'RaktSetu FCM Test';
      const body = 'Your staging browser successfully received a test notification.';

      const result = await pushNotificationService.sendDirectTestMessage(activeToken, title, body, {
        data: {
          testType: 'phase4_direct_test',
          timestamp: new Date().toISOString(),
        },
      });

      expect(result.success).toBe(true);
      expect(typeof result.messageId).toBe('string');
      expect(result.messageId).toContain('projects/raktsetu-be5fb/messages/');
      console.log('Phase 4: Harmless test notification delivered to Chrome. Firebase Message ID:', result.messageId);
    });
  });

  // =========================================================================
  // PHASE 5: FOREGROUND & BACKGROUND FCM DELIVERY TESTS
  // =========================================================================
  describe('Phase 5: Foreground & Background Push Delivery Tests', () => {
    test('5.1: Foreground notification dispatch with custom data payload', async () => {
      const result = await pushNotificationService.sendDirectTestMessage(
        activeToken,
        'RaktSetu Foreground Alert',
        'Testing live foreground listener delivery.',
        {
          data: {
            type: 'FOREGROUND_TEST',
            timestamp: new Date().toISOString(),
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('projects/raktsetu-be5fb/messages/');
      console.log('Phase 5.1: Foreground notification dispatched. Message ID:', result.messageId);
    });

    test('5.2: Background notification dispatch with service worker action buttons', async () => {
      const result = await pushNotificationService.sendDirectTestMessage(
        activeToken,
        'RaktSetu Background Alert',
        'Testing service worker background receipt and response routing.',
        {
          actions: [
            { action: 'accept', title: "I'm available" },
            { action: 'decline', title: 'Not available' },
          ],
          data: {
            responsePath: '/en/donor/dashboard',
            requestId: 'test-req-phase-5',
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('projects/raktsetu-be5fb/messages/');
      console.log('Phase 5.2: Background notification dispatched. Message ID:', result.messageId);
    });
  });

  // =========================================================================
  // PHASE 6: DURABLE OUTBOX INTEGRATION TEST
  // =========================================================================
  describe('Phase 6: Durable Outbox Integration Test', () => {
    let syntheticRequestId: string;
    let notificationRecordId: string;

    test('6.1: Creates synthetic blood request and outbox notification row in PostgreSQL', async () => {
      const now = new Date();
      syntheticRequestId = `req-staging-fcm-${Date.now()}`;

      // Insert synthetic blood request matching donor O+ in Delhi
      await db.insert(bloodRequests).values({
        id: syntheticRequestId,
        patientName: 'Test Patient Chrome FCM',
        patientAge: 30,
        bloodGroupNeeded: 'O+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS New Delhi',
        latitude: 28.5672,
        longitude: 77.2100,
        state: 'Delhi',
        district: 'New Delhi',
        status: 'open',
        createdAt: now,
        updatedAt: now,
      });

      // Insert notification row for the synthetic donor into donor_notifications
      const notifId = `notif-staging-${Date.now()}`;
      notificationRecordId = notifId;

      await db.insert(donorNotifications).values({
        id: notifId,
        requestId: syntheticRequestId,
        donorId: syntheticDonorId,
        channel: 'push',
        status: 'pending',
        distanceKm: 5.2,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });

      const row = (await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifId)))[0];
      expect(row).toBeDefined();
      expect(row.status).toBe('pending');
      expect(row.donorId).toBe(syntheticDonorId);
    });

    test('6.2: Outbox worker claims record with strict fencing and dispatches real push notification to Chrome', async () => {
      expect(notificationRecordId).toBeTruthy();

      // Execute outbox processing pass using live Firebase service
      const summary = await notificationOutbox.processNextBatch('worker-interactive-test', 5);

      expect(summary.sentCount).toBeGreaterThanOrEqual(1);

      // Verify the outbox record transitioned to sent in PostgreSQL
      const updatedRow = (await db.select().from(donorNotifications).where(eq(donorNotifications.id, notificationRecordId)))[0];
      expect(updatedRow).toBeDefined();
      expect(updatedRow.status).toBe('sent');
      expect(updatedRow.sentAt).not.toBeNull();
      console.log('Phase 6: Outbox record successfully claimed, dispatched to Chrome, and transitioned to SENT:', {
        id: updatedRow.id,
        status: updatedRow.status,
        sentAt: updatedRow.sentAt,
      });
    });
  });
});
