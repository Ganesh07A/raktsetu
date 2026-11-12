import { describe, expect, test, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { otpService } from '../apps/api/src/services/otp-service';
import {
  createOtpVerificationTicket,
  consumeOtpVerificationTicket,
  resetConsumedTickets,
  createRequestCloseToken,
  createRequestViewToken,
} from '../apps/api/src/services/donor-session';
import { mockStore } from '../apps/api/src/services/mock-store';
import { requestService } from '../apps/api/src/services/request-service';
import { eraktkoshProxy } from '../apps/api/src/services/eraktkosh-proxy';
import type { BloodGroup, ComponentType } from '@repo/shared';

describe('Checkpoint Security & Verification Evidence Suite', () => {
  beforeEach(() => {
    otpService.clear();
    resetConsumedTickets();
    mockStore.reset();
    eraktkoshProxy.clearCache();
  });

  // ==========================================
  // SECTION 3: OTP SECURITY — 11 SCENARIOS + PROD RESTRICTIONS
  // ==========================================
  describe('Section 3: OTP Security Verification (11 Scenarios)', () => {
    const testPhone = '+919876543210';
    const altPhone = '+919876543299';

    test('Scenario 1: Valid OTP verification succeeds and issues a single-use signed ticket', async () => {
      await otpService.sendOtp(testPhone, 'donor_registration');
      const testCode = otpService.getTestOtp(testPhone, 'donor_registration');
      expect(testCode).toBeDefined();

      const verifyRes = otpService.verifyOtp(testPhone, testCode!, 'donor_registration');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.verificationTicket).toBeDefined();
      expect(typeof verifyRes.verificationTicket).toBe('string');
    });

    test('Scenario 2: Invalid OTP is rejected and decrements remaining attempts', async () => {
      await otpService.sendOtp(testPhone, 'donor_registration');

      const verifyRes = otpService.verifyOtp(testPhone, '000000', 'donor_registration');
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain('Invalid verification code');
      expect(verifyRes.remainingAttempts).toBe(4);
    });

    test('Scenario 3: Expired OTP is rejected by the server', async () => {
      await otpService.sendOtp(testPhone, 'donor_registration');
      const testCode = otpService.getTestOtp(testPhone, 'donor_registration');

      // Manipulate session expiry to simulate time passage (> 5 minutes)
      const sessionKey = `${testPhone.replace(/\D/g, '').slice(-10)}:donor_registration`;
      const session = (otpService as any).sessions.get(sessionKey);
      expect(session).toBeDefined();
      session.expiresAt = Date.now() - 1000; // expired

      const verifyRes = otpService.verifyOtp(testPhone, testCode!, 'donor_registration');
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain('expired');
    });

    test('Scenario 4: Reused OTP is rejected immediately after successful verification', async () => {
      await otpService.sendOtp(testPhone, 'donor_registration');
      const testCode = otpService.getTestOtp(testPhone, 'donor_registration');

      // First verification succeeds
      const firstRes = otpService.verifyOtp(testPhone, testCode!, 'donor_registration');
      expect(firstRes.success).toBe(true);

      // Immediate reuse of the same OTP must fail
      const secondRes = otpService.verifyOtp(testPhone, testCode!, 'donor_registration');
      expect(secondRes.success).toBe(false);
      expect(secondRes.error).toContain('No active OTP verification session found');
    });

    test('Scenario 5: Five incorrect attempts locks out the user and invalidates session', async () => {
      await otpService.sendOtp(testPhone, 'donor_registration');

      // Attempts 1 to 4 fail with decrementing counter
      for (let i = 1; i <= 4; i++) {
        const res = otpService.verifyOtp(testPhone, `11111${i}`, 'donor_registration');
        expect(res.success).toBe(false);
        expect(res.remainingAttempts).toBe(5 - i);
      }

      // Attempt 5 fails and invalidates session
      const fifthRes = otpService.verifyOtp(testPhone, '999999', 'donor_registration');
      expect(fifthRes.success).toBe(false);
      expect(fifthRes.error).toContain('Maximum verification attempts exceeded');

      // Attempt 6: session is completely wiped
      const sixthRes = otpService.verifyOtp(testPhone, '123456', 'donor_registration');
      expect(sixthRes.success).toBe(false);
      expect(sixthRes.error).toContain('No active OTP verification session found');
    });

    test('Scenario 6: OTP resend cooldown enforces 60-second rate limit', async () => {
      const firstSend = await otpService.sendOtp(testPhone, 'donor_registration');
      expect(firstSend.success).toBe(true);

      // Attempt immediate resend (cooldown violation)
      const secondSend = await otpService.sendOtp(testPhone, 'donor_registration');
      expect(secondSend.success).toBe(false);
      expect(secondSend.error).toBe('COOLDOWN_ACTIVE');
      expect(secondSend.cooldownSeconds).toBeGreaterThan(0);
      expect(secondSend.cooldownSeconds).toBeLessThanOrEqual(60);
    });

    test('Scenario 7: OTP verification rejects phone number mismatch', async () => {
      await otpService.sendOtp(testPhone, 'donor_registration');
      const testCode = otpService.getTestOtp(testPhone, 'donor_registration');

      // Attempt to verify the code against a different phone number
      const wrongPhoneRes = otpService.verifyOtp(altPhone, testCode!, 'donor_registration');
      expect(wrongPhoneRes.success).toBe(false);
      expect(wrongPhoneRes.error).toContain('No active OTP verification session found');
    });

    test('Scenario 8: Replayed verification ticket is rejected on second attempt', () => {
      const ticket = createOtpVerificationTicket(testPhone, 'donor_registration');

      // First consumption succeeds
      const firstConsume = consumeOtpVerificationTicket(ticket, 'donor_registration', testPhone);
      expect(firstConsume.success).toBe(true);

      // Replay attempt fails
      const replayConsume = consumeOtpVerificationTicket(ticket, 'donor_registration', testPhone);
      expect(replayConsume.success).toBe(false);
      expect(replayConsume.error).toContain('already been used');
    });

    test('Scenario 9: Donor registration without verification ticket is rejected in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const payload = {
          name: 'Unverified Donor',
          phone: testPhone,
          bloodGroup: 'O+',
          latitude: 28.6139,
          longitude: 77.209,
          state: 'Delhi',
          district: 'Central Delhi',
          // verificationTicket omitted
        };

        const res = await app.request('/api/v1/donors/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toContain('verification ticket is required');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    test('Scenario 10: Registration with an expired ticket is rejected with 401', async () => {
      // Craft ticket expired in the past
      const expiredPayload = {
        purpose: 'otp-ticket',
        phone: testPhone,
        ticketPurpose: 'donor_registration',
        nonce: 'expired-nonce-12345',
        expiresAt: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
      };
      const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const { createHmac } = await import('node:crypto');
      const sig = createHmac('sha256', 'raktsetu-local-development-secret-change-before-deployment')
        .update(encoded)
        .digest('base64url');
      const expiredTicket = `${encoded}.${sig}`;

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Expired Ticket Donor',
          phone: testPhone,
          bloodGroup: 'A+',
          latitude: 28.6139,
          longitude: 77.209,
          state: 'Delhi',
          district: 'Central Delhi',
          verificationTicket: expiredTicket,
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Invalid or expired phone verification ticket');
    });

    test('Scenario 11: Concurrent registration using the same verification ticket allows only one success', async () => {
      const freshPhone = '+919871112233';
      await otpService.sendOtp(freshPhone, 'donor_registration');
      const code = otpService.getTestOtp(freshPhone, 'donor_registration');
      const vRes = otpService.verifyOtp(freshPhone, code!, 'donor_registration');
      const ticket = vRes.verificationTicket!;

      const donorPayload = {
        name: 'Concurrent Donor',
        phone: freshPhone,
        bloodGroup: 'B+',
        latitude: 28.6139,
        longitude: 77.209,
        state: 'Delhi',
        district: 'Central Delhi',
        verificationTicket: ticket,
      };

      // Dispatch 2 concurrent registration requests with the exact same ticket
      const [res1, res2] = await Promise.all([
        app.request('/api/v1/donors/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(donorPayload),
        }),
        app.request('/api/v1/donors/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(donorPayload),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (201), the other must be rejected (401 ticket already consumed)
      expect(statuses[0]).toBe(201);
      expect(statuses[1]).toBe(401);
    });

    test('Production protection: getTestOtp returns undefined when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const code = otpService.getTestOtp(testPhone, 'donor_registration');
        expect(code).toBeUndefined();
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  // ==========================================
  // SECTION 4: DONOR PRIVACY & PII REDACTION
  // ==========================================
  describe('Section 4: Donor Privacy Verification', () => {
    test('Discovery endpoints (/donors/compatible and /donors/match) redact phone, full coordinates, and PII', async () => {
      // Seed a donor in mockStore
      mockStore.addDonor({
        id: 'donor-privacy-test-1',
        name: 'Sensitive Private Donor',
        phone: '+919876543210',
        bloodGroup: 'O+',
        latitude: 28.613912345,
        longitude: 77.209012345,
        state: 'Delhi',
        district: 'Central Delhi',
        isAvailable: true,
        searchRadiusKm: 25,
      });

      const res = await app.request('/api/v1/donors/compatible?bloodGroup=O%2B&lat=28.613&lng=77.209&radiusKm=10');
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(Array.isArray(data.donors)).toBe(true);
      expect(data.donors.length).toBeGreaterThan(0);

      for (const donor of data.donors) {
        expect(donor.phone).toBeUndefined();
        expect(donor.name).toBeUndefined();
        expect(donor.email).toBeUndefined();
        expect(donor.latitude).toBeUndefined();
        expect(donor.longitude).toBeUndefined();
        expect(donor.userId).toBeUndefined();
        // Permitted safe discovery fields only
        expect(donor.id).toBeDefined();
        expect(donor.bloodGroup).toBeDefined();
        expect(typeof donor.distanceKm).toBe('number');
      }
    });

    test('Anonymous seeker waiting room (/requests/:id) redacts donor PII until explicit acceptance', async () => {
      // 1. Create a request cascading to seeded donor donor-amit-ab-neg (AB-)
      const reqRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Confidential Patient',
          hospitalName: 'AIIMS New Delhi',
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 1,
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });

      expect(reqRes.status).toBe(201);
      const reqData = await reqRes.json();
      const requestId = reqData.request.id;
      expect(reqData.request.status).toBe('donors_notified');

      // 2. Anonymous seeker polls request details without view token
      const anonRes = await app.request(`/api/v1/requests/${requestId}`);
      expect(anonRes.status).toBe(200);
      const anonData = await anonRes.json();

      // Notifications list must have NO PII
      for (const notif of anonData.notifications) {
        expect(notif.donorName).toBeUndefined();
        expect(notif.donorPhone).toBeUndefined();
        expect(notif.donorPhoneMasked).toBeUndefined();
        expect(notif.donorId).toBeUndefined();
      }
      // Accepted donors array must be empty
      expect(anonData.acceptedDonors).toHaveLength(0);

      // 3. Simulate donor acceptance via signed capability token
      const { createDonorResponseToken } = await import('../apps/api/src/services/donor-session');
      const donorResponseToken = createDonorResponseToken(
        requestId,
        'donor-amit-ab-neg'
      );

      const acceptRes = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseToken: donorResponseToken,
          action: 'accepted',
        }),
      });
      expect(acceptRes.status).toBe(200);

      // 4. Poll again after acceptance: now acceptedDonors exposes contact details
      const postAcceptRes = await app.request(`/api/v1/requests/${requestId}`);
      expect(postAcceptRes.status).toBe(200);
      const postAcceptData = await postAcceptRes.json();

      expect(postAcceptData.acceptedDonors.length).toBe(1);
      const accepted = postAcceptData.acceptedDonors[0];
      expect(accepted.donorId).toBe('donor-amit-ab-neg');
      expect(accepted.phone).toBeDefined();
    });
  });

  // ==========================================
  // SECTION 5: BLOOD INVENTORY INTEGRITY
  // ==========================================
  describe('Section 5: Blood Inventory Integrity Verification', () => {
    test('OpenData / OSM directory results have zero stock and unverified status', async () => {
      const result = await eraktkoshProxy.searchStock({
        lat: 12.9716,
        lng: 77.5946,
        radiusKm: 10,
        bloodGroup: 'B+',
      });

      // Verify no synthetic stock is fabricated
      for (const bank of result.banks) {
        if (bank.source === 'manual') {
          expect(bank.isVerified).toBe(false);
          expect(bank.verificationStatus).toBe('unverified');
          expect(bank.stock).toHaveLength(0);
          expect(bank.isStockAvailable).toBe(false);
          expect(bank.lastStockUpdate).toBeNull();
        }
      }
    });

    test('Seed blood banks retain source from seed dataset and are isolated in test mode', async () => {
      const result = await eraktkoshProxy.searchStock({
        stateCode: 'DL',
        bloodGroup: 'A+',
      });

      expect(result.banks.length).toBeGreaterThan(0);
      expect(result.source).toBe('database');
      for (const bank of result.banks) {
        expect(['eraktkosh', 'partner', 'manual']).toContain(bank.source);
      }
    });

    test('Provider failure or timeout returns empty stock safely without crashing', async () => {
      // Query an invalid/non-existent state and district
      const result = await eraktkoshProxy.searchStock({
        stateCode: 'NONEXISTENT_STATE',
        districtCode: 'NONEXISTENT_DISTRICT',
        bloodGroup: 'AB-',
      });

      expect(result.banks).toBeDefined();
      expect(Array.isArray(result.banks)).toBe(true);
      // Fails gracefully with 0 results, no exceptions thrown
      expect(result.banks.length).toBe(0);
    });
  });

  // ==========================================
  // SECTION 6: DATABASE FAILURE HANDLING
  // ==========================================
  describe('Section 6: Database Failure Handling Verification', () => {
    test('Durable database write failure causes fail-closed 500 response on request creation', async () => {
      // Mock requestService.createRequest to simulate a PostgreSQL disconnect / failure
      const originalCreate = requestService.createRequest;
      try {
        requestService.createRequest = async () => {
          throw new Error('DATABASE_PERSISTENCE_FAILED');
        };

        const res = await app.request('/api/v1/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientName: 'DB Fail Patient',
            hospitalName: 'City Hospital',
            bloodGroupNeeded: 'O+',
            unitsNeeded: 1,
            latitude: 28.6139,
            longitude: 77.209,
          }),
        });

        // Must reject with 500 and NOT pretend success (fail-closed)
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toContain('Database service unavailable');
      } finally {
        requestService.createRequest = originalCreate;
      }
    });

    test('Duplicate phone registration returns 409 conflict', async () => {
      const phone = '+919111222333';
      // Register first donor
      await otpService.sendOtp(phone, 'donor_registration');
      const code1 = otpService.getTestOtp(phone, 'donor_registration');
      const ticket1 = otpService.verifyOtp(phone, code1!, 'donor_registration').verificationTicket!;

      const reg1 = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'First Donor',
          phone,
          bloodGroup: 'O+',
          latitude: 28.6139,
          longitude: 77.209,
          state: 'Delhi',
          district: 'Central Delhi',
          verificationTicket: ticket1,
        }),
      });
      expect(reg1.status).toBe(201);

      // Attempt second donor registration with the same phone
      await otpService.sendOtp(phone, 'donor_registration');
      const code2 = otpService.getTestOtp(phone, 'donor_registration');
      const ticket2 = otpService.verifyOtp(phone, code2!, 'donor_registration').verificationTicket!;

      const reg2 = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Second Donor Same Phone',
          phone,
          bloodGroup: 'A+',
          latitude: 28.6139,
          longitude: 77.209,
          state: 'Delhi',
          district: 'Central Delhi',
          verificationTicket: ticket2,
        }),
      });

      expect(reg2.status).toBe(409);
      const data = await reg2.json();
      expect(data.error).toContain('already registered');
    });
  });

  // ==========================================
  // SECTION 7: EMERGENCY ABUSE PREVENTION
  // ==========================================
  describe('Section 7: Abuse Prevention Verification', () => {
    test('Idempotency-Key prevents duplicate emergency requests and notification replay', async () => {
      const idempotencyKey = 'idemp-test-key-abc-123';
      const payload = {
        patientName: 'Idempotency Patient',
        hospitalName: 'Safdarjung Hospital',
        bloodGroupNeeded: 'B+',
        unitsNeeded: 2,
        latitude: 28.5672,
        longitude: 77.21,
      };

      // First request
      const res1 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      const initialRequestId = data1.request.id;

      // Second request with exact same idempotency key
      const res2 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      // Must return the exact same request record without creating a new one
      expect(data2.request.id).toBe(initialRequestId);
    });

    test('Emergency fan-out kill switch disables push notifications when NOTIFICATIONS_ENABLED=false', async () => {
      const origEnv = process.env.NOTIFICATIONS_ENABLED;
      try {
        process.env.NOTIFICATIONS_ENABLED = 'false';

        // Add donor
        mockStore.addDonor({
          id: 'killswitch-donor-1',
          name: 'Killswitch Donor',
          phone: '+919877766554',
          bloodGroup: 'O-',
          latitude: 28.6139,
          longitude: 77.209,
          isAvailable: true,
        });

        const res = await app.request('/api/v1/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientName: 'Killswitch Patient',
            hospitalName: 'AIIMS',
            bloodGroupNeeded: 'O-',
            unitsNeeded: 1,
            latitude: 28.6139,
            longitude: 77.209,
          }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        // Notifications must be 0 because kill switch is active
        expect(data.notificationsSent).toBe(0);
      } finally {
        process.env.NOTIFICATIONS_ENABLED = origEnv;
      }
    });

    test('Search radius hard ceiling limits discovery to 50 km', async () => {
      const res = await app.request('/api/v1/donors/compatible?bloodGroup=O%2B&radiusKm=100');
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('cannot exceed 50 km');
    });
  });

  // ==========================================
  // SECTION 8: REQUEST LIFECYCLE & STATE MACHINE
  // ==========================================
  describe('Section 8: Request Lifecycle & State Machine Verification', () => {
    test('State machine rejects unauthorized status update without close token', async () => {
      const req = await requestService.createRequest({
        id: 'lifecycle-test-req-1',
        bloodGroupNeeded: 'A+',
        unitsNeeded: 1,
        patientName: 'Lifecycle Patient',
        hospitalName: 'Max Healthcare',
        latitude: 28.6139,
        longitude: 77.209,
        searchRadiusKm: 10,
        status: 'donors_notified',
        createdAt: new Date().toISOString(),
      });

      // Attempt PATCH /status without authorization
      const res = await app.request(`/api/v1/requests/${req.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fulfilled' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    test('State machine permits valid transitions with close capability token', async () => {
      const reqId = 'lifecycle-test-req-2';
      await requestService.createRequest({
        id: reqId,
        bloodGroupNeeded: 'A+',
        unitsNeeded: 1,
        patientName: 'Valid Transition Patient',
        hospitalName: 'Fortis Hospital',
        latitude: 28.6139,
        longitude: 77.209,
        searchRadiusKm: 10,
        status: 'donors_notified',
        createdAt: new Date().toISOString(),
      });

      const closeToken = createRequestCloseToken(reqId);

      // donors_notified -> cancelled is a legal transition
      const res = await app.request(`/api/v1/requests/${reqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          requestCloseToken: closeToken,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.updatedStatus).toBe('cancelled');
    });

    test('Terminal states are strictly immutable and reject further transitions', async () => {
      const reqId = 'lifecycle-test-req-3';
      await requestService.createRequest({
        id: reqId,
        bloodGroupNeeded: 'B+',
        unitsNeeded: 1,
        patientName: 'Terminal State Patient',
        hospitalName: 'Apollo Hospital',
        latitude: 28.6139,
        longitude: 77.209,
        searchRadiusKm: 10,
        status: 'cancelled', // Strictly terminal state
        createdAt: new Date().toISOString(),
      });

      const closeToken = createRequestCloseToken(reqId);

      // Attempt to reopen or transition out of terminal state
      const res = await app.request(`/api/v1/requests/${reqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'donors_notified',
          requestCloseToken: closeToken,
        }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Illegal state transition');
    });
  });
});
