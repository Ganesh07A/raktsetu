import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { app } from '../apps/api/src/index';
import {
  db,
  users,
  donorProfiles,
  bloodRequests,
  donorNotifications,
  eq,
  inArray,
} from '../packages/db/src/index';
import { requestService } from '../apps/api/src/services/request-service';
import {
  createDonorResponseToken,
  createRequestViewToken,
  createRequestCloseToken,
} from '../apps/api/src/services/donor-session';

describe('Checkpoint 4.9: Complete Donor Response & Seeker Visibility Lifecycle', () => {
  // Test IDs
  const testRequestId = `req-life-test-${Date.now()}`;
  const testCancelledReqId = `req-life-cancel-${Date.now()}`;
  const testExpiredReqId = `req-life-expire-${Date.now()}`;

  const donorUser1 = `user-d1-${Date.now()}`;
  const donorUser2 = `user-d2-${Date.now()}`;
  const donorUser3 = `user-d3-${Date.now()}`;

  const donorId1 = `donor-d1-${Date.now()}`;
  const donorId2 = `donor-d2-${Date.now()}`;
  const donorId3 = `donor-d3-${Date.now()}`;

  const notifId1 = `notif-d1-${Date.now()}`;
  const notifId2 = `notif-d2-${Date.now()}`;
  const notifId3 = `notif-d3-${Date.now()}`;

  let viewToken: string;
  let closeToken: string;
  let responseToken1: string;
  let responseToken2: string;
  let responseToken3: string;

  beforeAll(async () => {
    process.env.TEST_LIVE_DB = 'true';

    // 1. Seed 3 synthetic donors in database
    await db.insert(users).values([
      {
        id: donorUser1,
        phone: '+919111111101',
        name: 'Donor One Acceptor',
        role: 'donor',
      },
      {
        id: donorUser2,
        phone: '+919111111102',
        name: 'Donor Two Decliner',
        role: 'donor',
      },
      {
        id: donorUser3,
        phone: '+919111111103',
        name: 'Donor Three Parallel',
        role: 'donor',
      },
    ]);

    await db.insert(donorProfiles).values([
      {
        id: donorId1,
        userId: donorUser1,
        bloodGroup: 'O+',
        latitude: 28.6139,
        longitude: 77.209,
        state: 'Delhi',
        district: 'New Delhi',
        isAvailable: true,
      },
      {
        id: donorId2,
        userId: donorUser2,
        bloodGroup: 'O+',
        latitude: 28.6200,
        longitude: 77.210,
        state: 'Delhi',
        district: 'New Delhi',
        isAvailable: true,
      },
      {
        id: donorId3,
        userId: donorUser3,
        bloodGroup: 'O+',
        latitude: 28.6300,
        longitude: 77.220,
        state: 'Delhi',
        district: 'New Delhi',
        isAvailable: true,
      },
    ]);

    // 2. Seed active emergency blood request
    const now = new Date();
    await db.insert(bloodRequests).values([
      {
        id: testRequestId,
        bloodGroupNeeded: 'O+',
        unitsNeeded: 2,
        patientName: 'Emergency Patient Seeker',
        hospitalName: 'Apollo Hospital New Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'New Delhi',
        status: 'donors_notified',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: testCancelledReqId,
        bloodGroupNeeded: 'O+',
        unitsNeeded: 1,
        patientName: 'Cancelled Patient',
        hospitalName: 'Safdarjung Hospital',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'New Delhi',
        status: 'cancelled',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: testExpiredReqId,
        bloodGroupNeeded: 'O+',
        unitsNeeded: 1,
        patientName: 'Expired Patient',
        hospitalName: 'Max Hospital Saket',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'New Delhi',
        status: 'expired',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 3. Seed outbox notification records in status 'sent'
    await db.insert(donorNotifications).values([
      {
        id: notifId1,
        requestId: testRequestId,
        donorId: donorId1,
        channel: 'push',
        status: 'sent',
        sentAt: now,
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: notifId2,
        requestId: testRequestId,
        donorId: donorId2,
        channel: 'push',
        status: 'sent',
        sentAt: now,
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: notifId3,
        requestId: testRequestId,
        donorId: donorId3,
        channel: 'push',
        status: 'sent',
        sentAt: now,
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // 4. Generate signed cryptographic tokens
    viewToken = createRequestViewToken(testRequestId);
    closeToken = createRequestCloseToken(testRequestId);
    responseToken1 = createDonorResponseToken(testRequestId, donorId1);
    responseToken2 = createDonorResponseToken(testRequestId, donorId2);
    responseToken3 = createDonorResponseToken(testRequestId, donorId3);
  });

  afterAll(async () => {
    try {
      await db.delete(donorNotifications).where(
        inArray(donorNotifications.requestId, [
          testRequestId,
          testCancelledReqId,
          testExpiredReqId,
        ])
      );
      await db.delete(bloodRequests).where(
        inArray(bloodRequests.id, [
          testRequestId,
          testCancelledReqId,
          testExpiredReqId,
        ])
      );
      await db.delete(donorProfiles).where(
        inArray(donorProfiles.id, [donorId1, donorId2, donorId3])
      );
      await db.delete(users).where(
        inArray(users.id, [donorUser1, donorUser2, donorUser3])
      );
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
    delete process.env.TEST_LIVE_DB;
  });

  // =========================================================================
  // PHASE 2: DONOR RESPONSE TRACKING
  // =========================================================================
  describe('Phase 2: Donor Response Tracking', () => {
    test('2.1: Donor 1 clicks "I\'m available" -> Accepted & Request Fulfilled', async () => {
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accepted',
          responseToken: responseToken1,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.status).toBe('accepted');
      expect(data.requestStatus).toBe('fulfilled');

      // Verify DB persistence in donor_notifications
      const notif = (
        await db
          .select()
          .from(donorNotifications)
          .where(eq(donorNotifications.id, notifId1))
      )[0];
      expect(notif.status).toBe('accepted');
      expect(notif.respondedAt).not.toBeNull();

      // Verify DB persistence in blood_requests
      const req = (
        await db
          .select()
          .from(bloodRequests)
          .where(eq(bloodRequests.id, testRequestId))
      )[0];
      expect(req.status).toBe('fulfilled');
      expect(req.fulfillmentSource).toBe('donor');
    });

    test('2.2: Idempotent duplicate clicks on "I\'m available" return success without error', async () => {
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accepted',
          responseToken: responseToken1,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.duplicate).toBe(true);
      expect(data.status).toBe('accepted');
      expect(data.requestStatus).toBe('fulfilled');
    });

    test('2.3: Rejection of invalid, tampered, or expired donor response tokens', async () => {
      const tamperedToken = responseToken1.slice(0, -6) + 'abcdef';
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accepted',
          responseToken: tamperedToken,
        }),
      });

      expect(res.status).toBe(401);
      const data = (await res.json()) as any;
      expect(data.error).toContain('Response link is invalid or expired');
    });

    test('2.4: Donor 2 clicks "Not available" -> Persisted as declined', async () => {
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'declined',
          responseToken: responseToken2,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.status).toBe('declined');

      // Verify DB persistence
      const notif = (
        await db
          .select()
          .from(donorNotifications)
          .where(eq(donorNotifications.id, notifId2))
      )[0];
      expect(notif.status).toBe('declined');
      expect(notif.respondedAt).not.toBeNull();
    });

    test('2.5: Donor 3 (No response) remains in "sent" status with null respondedAt', async () => {
      const notif = (
        await db
          .select()
          .from(donorNotifications)
          .where(eq(donorNotifications.id, notifId3))
      )[0];
      expect(notif.status).toBe('sent');
      expect(notif.respondedAt).toBeNull();
      expect(notif.sentAt).not.toBeNull();
    });
  });

  // =========================================================================
  // PHASE 3: SEEKER DASHBOARD VISIBILITY & PRIVACY
  // =========================================================================
  describe('Phase 3: Seeker Dashboard Visibility & Privacy Boundaries', () => {
    test('3.1: Authorized seeker with valid viewToken sees accepted donor contacts', async () => {
      const res = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.request.id).toBe(testRequestId);
      expect(data.request.status).toBe('fulfilled');

      // Verify accepted donors list
      expect(Array.isArray(data.acceptedDonors)).toBe(true);
      expect(data.acceptedDonors).toHaveLength(1);

      const donor = data.acceptedDonors[0];
      expect(donor.donorId).toBe(donorId1);
      expect(donor.name).toBe('Donor One Acceptor');
      expect(donor.phone).toBe('+919111111101');
      expect(donor.bloodGroup).toBe('O+');
      expect(donor.distanceKm).toBeDefined();
      expect(donor.directCallUrl).toBe('tel:+919111111101');
    });

    test('3.2: Declined Donor 2 and Unresponsive Donor 3 are NOT in acceptedDonors', async () => {
      const res = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });

      const data = (await res.json()) as any;
      const donorIds = data.acceptedDonors.map((d: any) => d.donorId);
      expect(donorIds).toContain(donorId1);
      expect(donorIds).not.toContain(donorId2);
      expect(donorIds).not.toContain(donorId3);
    });

    test('3.3: Anonymous user (no view token) CANNOT see accepted donor contacts', async () => {
      const res = await app.request(`/api/v1/requests/${testRequestId}`);

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      // PII must be completely stripped
      expect(data.acceptedDonors).toHaveLength(0);
      // Coordinates must be fuzzed for anonymous view
      expect(data.request.latitude).toBe(28.57);
      expect(data.request.longitude).toBe(77.21);
    });

    test('3.4: Cross-tenant seeker (view token for different request ID) CANNOT see contacts', async () => {
      const differentReqToken = createRequestViewToken('req-different-unrelated-id');
      const res = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${differentReqToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.acceptedDonors).toHaveLength(0);
    });

    test('3.5: Close token is rejected with 403 when used to view request details', async () => {
      const res = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${closeToken}` },
      });

      expect(res.status).toBe(403);
      const data = (await res.json()) as any;
      expect(data.error).toContain('Close token cannot be used to view request details');
    });

    test('3.6: Cancelled request redacts donor contacts even if authorized viewToken is provided', async () => {
      // Add accepted notification to cancelled request
      await db.insert(donorNotifications).values({
        id: `notif-cancel-${Date.now()}`,
        requestId: testCancelledReqId,
        donorId: donorId1,
        channel: 'push',
        status: 'accepted',
        sentAt: new Date(),
        respondedAt: new Date(),
      });

      const cancelViewToken = createRequestViewToken(testCancelledReqId);
      const res = await app.request(`/api/v1/requests/${testCancelledReqId}`, {
        headers: { Authorization: `Bearer ${cancelViewToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.request.status).toBe('cancelled');
      // Terminal state protection: contacts must be redacted
      expect(data.acceptedDonors).toHaveLength(0);
    });
  });

  // =========================================================================
  // PHASE 4: MULTIPLE DONOR RESPONSES & POLICY VERIFICATION
  // =========================================================================
  describe('Phase 4: Multiple Donor Responses & Business Rule Audit', () => {
    test('4.1: Second donor (Donor 3) also accepts -> Both donors visible to seeker', async () => {
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accepted',
          responseToken: responseToken3,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.status).toBe('accepted');

      // Seeker queries request details
      const detailRes = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });
      const detail = (await detailRes.json()) as any;

      // Policy verification: RaktSetu allows multiple accepted donors and presents all to seeker
      expect(detail.acceptedDonors).toHaveLength(2);
      const ids = detail.acceptedDonors.map((d: any) => d.donorId);
      expect(ids).toContain(donorId1);
      expect(ids).toContain(donorId3);
    });

    test('4.2: If one of two accepted donors declines, request remains fulfilled with remaining donor', async () => {
      // Donor 3 changes mind to declined
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'declined',
          responseToken: responseToken3,
        }),
      });

      expect(res.status).toBe(200);

      // Verify request is STILL fulfilled because Donor 1 is still accepted
      const req = (
        await db
          .select()
          .from(bloodRequests)
          .where(eq(bloodRequests.id, testRequestId))
      )[0];
      expect(req.status).toBe('fulfilled');

      const detailRes = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });
      const detail = (await detailRes.json()) as any;
      expect(detail.acceptedDonors).toHaveLength(1);
      expect(detail.acceptedDonors[0].donorId).toBe(donorId1);
    });

    test('4.3: If the sole remaining accepted donor declines, request reverts to donors_notified', async () => {
      // Donor 1 now declines
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'declined',
          responseToken: responseToken1,
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.requestStatus).toBe('donors_notified');

      // Verify DB reverted to donors_notified
      const req = (
        await db
          .select()
          .from(bloodRequests)
          .where(eq(bloodRequests.id, testRequestId))
      )[0];
      expect(req.status).toBe('donors_notified');
      expect(req.fulfillmentSource).toBeNull();

      // Accepted donors list is now empty
      const detailRes = await app.request(`/api/v1/requests/${testRequestId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });
      const detail = (await detailRes.json()) as any;
      expect(detail.acceptedDonors).toHaveLength(0);
    });

    test('4.4: Donor acceptance attempt on cancelled request is rejected with 409 Conflict', async () => {
      const cancelResponseToken = createDonorResponseToken(testCancelledReqId, donorId1);
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accepted',
          responseToken: cancelResponseToken,
        }),
      });

      expect(res.status).toBe(409);
      const data = (await res.json()) as any;
      expect(data.error).toContain('Cannot respond to a cancelled request');
    });

    test('4.5: Donor acceptance attempt on expired request is rejected with 409 Conflict', async () => {
      const expireResponseToken = createDonorResponseToken(testExpiredReqId, donorId1);
      const res = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accepted',
          responseToken: expireResponseToken,
        }),
      });

      expect(res.status).toBe(409);
      const data = (await res.json()) as any;
      expect(data.error).toContain('Cannot respond to a expired request');
    });
  });

  // =========================================================================
  // PHASE 6: REQUEST STATE MACHINE TRANSITIONS
  // =========================================================================
  describe('Phase 6: Request State Machine & Terminal State Invariants', () => {
    test('6.1: Valid state transitions succeed', async () => {
      const testSmReqId = `req-sm-${Date.now()}`;
      await db.insert(bloodRequests).values({
        id: testSmReqId,
        bloodGroupNeeded: 'B+',
        unitsNeeded: 1,
        patientName: 'State Machine Test',
        hospitalName: 'Hospital',
        latitude: 28.5,
        longitude: 77.2,
        status: 'searching',
      });

      try {
        // searching -> donors_notified
        let res = await requestService.updateRequestStatus(testSmReqId, 'donors_notified');
        expect(res.success).toBe(true);
        expect(res.requestStatus).toBe('donors_notified');

        // donors_notified -> fulfilled
        res = await requestService.updateRequestStatus(testSmReqId, 'fulfilled', 'donor');
        expect(res.success).toBe(true);
        expect(res.requestStatus).toBe('fulfilled');

        // fulfilled -> donors_notified (donor fallback)
        res = await requestService.updateRequestStatus(testSmReqId, 'donors_notified');
        expect(res.success).toBe(true);
        expect(res.requestStatus).toBe('donors_notified');

        // donors_notified -> cancelled (terminal)
        res = await requestService.updateRequestStatus(testSmReqId, 'cancelled');
        expect(res.success).toBe(true);
        expect(res.requestStatus).toBe('cancelled');
      } finally {
        await db.delete(bloodRequests).where(eq(bloodRequests.id, testSmReqId));
      }
    }, 20000);

    test('6.2: Invalid state transitions from terminal states are strictly rejected', async () => {
      const testTerminalReqId = `req-term-${Date.now()}`;
      await db.insert(bloodRequests).values({
        id: testTerminalReqId,
        bloodGroupNeeded: 'B+',
        unitsNeeded: 1,
        patientName: 'Terminal Test',
        hospitalName: 'Hospital',
        latitude: 28.5,
        longitude: 77.2,
        status: 'cancelled',
      });

      try {
        // cancelled -> fulfilled (ILLEGAL)
        let res = await requestService.updateRequestStatus(testTerminalReqId, 'fulfilled');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Illegal state transition from cancelled to fulfilled');

        // cancelled -> searching (ILLEGAL)
        res = await requestService.updateRequestStatus(testTerminalReqId, 'searching');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Illegal state transition from cancelled to searching');

        // cancelled -> donors_notified (ILLEGAL)
        res = await requestService.updateRequestStatus(testTerminalReqId, 'donors_notified');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Illegal state transition from cancelled to donors_notified');
      } finally {
        await db.delete(bloodRequests).where(eq(bloodRequests.id, testTerminalReqId));
      }
    }, 20000);
  });
});
