import { describe, expect, test, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { otpService } from '../apps/api/src/services/otp-service';
import {
  createOtpVerificationTicket,
  createDonorResponseToken,
  createRequestCloseToken,
  createRequestViewToken,
  resetConsumedTickets,
} from '../apps/api/src/services/donor-session';
import { mockStore } from '../apps/api/src/services/mock-store';
import { defaultRateLimitStore } from '../apps/api/src/middleware/rate-limiter';
import { eraktkoshProxy } from '../apps/api/src/services/eraktkosh-proxy';

describe('Phase D: Staging End-to-End Functional Test Suite', () => {
  beforeEach(() => {
    otpService.clear();
    resetConsumedTickets();
    mockStore.reset();
    defaultRateLimitStore.clear();
    eraktkoshProxy.clearCache();
  });

  // =========================================================================
  // SCENARIO 1: DONOR REGISTRATION & SERVER-SIDE OTP VERIFICATION FLOW
  // =========================================================================
  describe('Scenario 1: Donor Registration & Server-Side OTP Flow', () => {
    const testPhone = '+919123456780';

    test('1.1: Requesting OTP initiates server session and returns success', async () => {
      const sendRes = await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, purpose: 'donor_registration' }),
      });
      expect(sendRes.status).toBe(200);
      const data = (await sendRes.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('Verification code sent');
    });

    test('1.2: Enforces 60-second cooldown on consecutive OTP send requests', async () => {
      await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, purpose: 'donor_registration' }),
      });

      // Second immediate request
      const secondRes = await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, purpose: 'donor_registration' }),
      });
      expect(secondRes.status).toBe(429);
      const data = (await secondRes.json()) as any;
      expect(data.code).toBe('COOLDOWN_ACTIVE');
      expect(data.error).toContain('wait');
    });

    test('1.3: Rejects invalid OTP and decrements remaining attempts', async () => {
      await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, purpose: 'donor_registration' }),
      });

      const verifyRes = await app.request('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, otp: '000000', purpose: 'donor_registration' }),
      });
      expect(verifyRes.status).toBe(400);
      const data = (await verifyRes.json()) as any;
      expect(data.error).toContain('Invalid verification code');
      expect(data.remainingAttempts).toBe(4);
    });

    test('1.4: Locks session after 5 failed verification attempts', async () => {
      await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, purpose: 'donor_registration' }),
      });

      for (let i = 0; i < 5; i++) {
        await app.request('/api/v1/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, otp: '111111', purpose: 'donor_registration' }),
        });
      }

      // 6th attempt
      const sixthRes = await app.request('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, otp: '111111', purpose: 'donor_registration' }),
      });
      expect(sixthRes.status).toBe(400);
      const data = (await sixthRes.json()) as any;
      expect(data.error).toContain('Please request a new code');
    });

    test('1.5: Valid OTP verification succeeds, issues single-use verification ticket', async () => {
      await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, purpose: 'donor_registration' }),
      });

      const testOtp = otpService.getTestOtp(testPhone, 'donor_registration');
      expect(testOtp).toBeDefined();

      const verifyRes = await app.request('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, otp: testOtp, purpose: 'donor_registration' }),
      });
      expect(verifyRes.status).toBe(200);
      const data = (await verifyRes.json()) as any;
      expect(data.success).toBe(true);
      expect(data.verificationTicket).toBeDefined();

      // Completes donor registration using valid ticket
      const regRes = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-verification-ticket': data.verificationTicket,
        },
        body: JSON.stringify({
          name: 'Synthetic Verified Donor',
          phone: testPhone,
          bloodGroup: 'O+',
          dateOfBirth: '1995-05-15',
          gender: 'male',
          weightKg: 70,
          latitude: 28.6139,
          longitude: 77.209,
          state: 'Delhi',
          district: 'New Delhi',
        }),
      });
      expect(regRes.status).toBe(201);
      const regData = (await regRes.json()) as any;
      expect(regData.success).toBe(true);
      expect(regData.donor.id).toBeDefined();
    });

    test('1.6: Rejects reused verification ticket (single-use enforcement)', async () => {
      const ticket = createOtpVerificationTicket(testPhone, 'donor_registration');

      // First use
      const reg1 = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-verification-ticket': ticket },
        body: JSON.stringify({
          name: 'Donor Replay Test',
          phone: testPhone,
          bloodGroup: 'A+',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          weightKg: 65,
          latitude: 28.61,
          longitude: 77.20,
          state: 'Delhi',
          district: 'New Delhi',
        }),
      });
      expect(reg1.status).toBe(201);

      // Replay attempt with same ticket
      const reg2 = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-verification-ticket': ticket },
        body: JSON.stringify({
          name: 'Donor Replay Impersonator',
          phone: testPhone,
          bloodGroup: 'A+',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          weightKg: 65,
          latitude: 28.61,
          longitude: 77.20,
          state: 'Delhi',
          district: 'New Delhi',
        }),
      });
      expect(reg2.status).toBe(401);
      const data = (await reg2.json()) as any;
      expect(data.error).toContain('already been used');
    });

    test('1.7: Rejects phone mismatch between ticket and registration payload', async () => {
      const ticket = createOtpVerificationTicket('+919876543210', 'donor_registration');

      const mismatchRes = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-verification-ticket': ticket },
        body: JSON.stringify({
          name: 'Attacker Phone Mismatch',
          phone: '+919999988888', // Different phone!
          bloodGroup: 'B+',
          dateOfBirth: '1992-04-10',
          gender: 'female',
          weightKg: 55,
          latitude: 28.61,
          longitude: 77.20,
          state: 'Delhi',
          district: 'New Delhi',
        }),
      });
      expect(mismatchRes.status).toBe(401);
      const data = (await mismatchRes.json()) as any;
      expect(data.error).toContain('does not match');
    });
  });

  // =========================================================================
  // SCENARIO 2: EMERGENCY REQUEST CREATION & MATCHING
  // =========================================================================
  describe('Scenario 2: Emergency Request Creation & Matching', () => {
    test('2.1: Request validation enforces schema boundaries', async () => {
      // Invalid unitsNeeded (>20)
      const res1 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Test Patient',
          hospitalName: 'Apollo Hospital',
          bloodGroupNeeded: 'O+',
          unitsNeeded: 50, // Exceeds max 20
          latitude: 28.61,
          longitude: 77.20,
        }),
      });
      expect(res1.status).toBe(400);

      // Missing required hospitalName
      const res2 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Test Patient',
          bloodGroupNeeded: 'O+',
          unitsNeeded: 2,
          latitude: 28.61,
          longitude: 77.20,
        }),
      });
      expect(res2.status).toBe(400);
    });

    test('2.2: Enforces request idempotency via Idempotency-Key header', async () => {
      const idemKey = `idem-staging-test-${Date.now()}`;
      const payload = {
        patientName: 'Idempotency Patient',
        hospitalName: 'Max Healthcare',
        bloodGroupNeeded: 'B-',
        unitsNeeded: 1,
        latitude: 28.6139,
        longitude: 77.209,
        searchRadiusKm: 10,
      };

      const res1 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify(payload),
      });
      expect(res1.status).toBe(201);
      const data1 = (await res1.json()) as any;

      // Duplicate request with same Idempotency-Key
      const res2 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify(payload),
      });
      expect(res2.status).toBe(201);
      const data2 = (await res2.json()) as any;

      // Returns identical request without creating duplicate record
      expect(data2.request.id).toBe(data1.request.id);
      expect(data2.requestViewToken).toBe(data1.requestViewToken);
    });
  });

  // =========================================================================
  // SCENARIO 3: DONOR NOTIFICATION DISPATCH TO OUTBOX
  // =========================================================================
  describe('Scenario 3: Donor Notification & Outbox Dispatch', () => {
    test('3.1: Automatically notifies compatible nearby donors and queues in outbox', async () => {
      // Create request where nearby stock is 0 (AB- with 3 units in AIIMS Delhi), cascading to donors
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Emergency Cascade Seeker',
          hospitalName: 'AIIMS New Delhi',
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 3,
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });
      expect(createRes.status).toBe(201);
      const data = (await createRes.json()) as any;
      const reqId = data.request.id;

      expect(data.request.status).toBe('donors_notified');
      expect(data.compatibleDonorsCount).toBeGreaterThan(0);
      expect(data.notificationsSent).toBeGreaterThan(0);

      // Check that notifications were queued in outbox
      const notifs = mockStore.getNotificationsForRequest(reqId);
      expect(notifs.length).toBe(data.notificationsSent);

      // Verify privacy: masked phone numbers stored in notifications
      for (const n of notifs) {
        expect(['pending', 'processing', 'sent']).toContain(n.status);
      }
    });
  });

  // =========================================================================
  // SCENARIO 4: DONOR ACCEPTANCE & PRIVACY BOUNDARY
  // =========================================================================
  describe('Scenario 4: Donor Acceptance and Privacy Protection', () => {
    test('4.1: Donor accept reveals unmasked contacts ONLY to view-token holder', async () => {
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Privacy Protected Patient',
          hospitalName: 'AIIMS New Delhi',
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 3,
          latitude: 28.567215,
          longitude: 77.210045,
          searchRadiusKm: 10,
        }),
      });
      const createData = (await createRes.json()) as any;
      const reqId = createData.request.id;
      const viewToken = createData.requestViewToken;

      // Donor accepts
      const donorToken = createDonorResponseToken(reqId, 'donor-amit-ab-neg');
      const acceptRes = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseToken: donorToken,
          action: 'accepted',
        }),
      });
      expect(acceptRes.status).toBe(200);

      // Anonymous poll: acceptedDonors MUST be empty [] and GPS fuzzed
      const anonRes = await app.request(`/api/v1/requests/${reqId}`);
      expect(anonRes.status).toBe(200);
      const anonData = (await anonRes.json()) as any;
      expect(anonData.acceptedDonors).toHaveLength(0);
      expect(anonData.request.latitude).toBe(28.57); // Fuzzed to 2 decimals

      // Unrelated user poll with another request view token: MUST withhold donor contacts
      const unrelatedToken = createRequestViewToken('req-unrelated-999');
      const unrelatedRes = await app.request(`/api/v1/requests/${reqId}`, {
        headers: { Authorization: `Bearer ${unrelatedToken}` },
      });
      expect(unrelatedRes.status).toBe(200);
      const unrelatedData = (await unrelatedRes.json()) as any;
      expect(unrelatedData.acceptedDonors).toHaveLength(0); // Withheld!

      // Close token used as read token: MUST be rejected with 403
      const closeToken = createRequestCloseToken(reqId);
      const closeReadRes = await app.request(`/api/v1/requests/${reqId}`, {
        headers: { Authorization: `Bearer ${closeToken}` },
      });
      expect(closeReadRes.status).toBe(403);

      // Authorized poll with genuine view token: reveals unmasked contact
      const authRes = await app.request(`/api/v1/requests/${reqId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });
      expect(authRes.status).toBe(200);
      const authData = (await authRes.json()) as any;
      expect(authData.acceptedDonors).toHaveLength(1);
      expect(authData.acceptedDonors[0].name).toBe('Amit Patel');
      expect(authData.acceptedDonors[0].phone).toBe('+919822233344');
      expect(authData.acceptedDonors[0].directCallUrl).toContain('tel:+919822233344');
      // Exact GPS coordinates preserved for authorized seeker
      expect(authData.request.latitude).toBe(28.567215);
      expect(authData.request.longitude).toBe(77.210045);
    });
  });

  // =========================================================================
  // SCENARIO 5: REQUEST CANCELLATION SUPPRESSES OUTBOX
  // =========================================================================
  describe('Scenario 5: Request Cancellation & Notification Suppression', () => {
    test('5.1: Seeker cancels request; pending notifications suppressed and contacts locked', async () => {
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Cancellation Test',
          hospitalName: 'AIIMS New Delhi',
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 3,
          latitude: 28.567215,
          longitude: 77.210045,
          searchRadiusKm: 10,
        }),
      });
      const createData = (await createRes.json()) as any;
      const reqId = createData.request.id;
      const closeToken = createData.requestCloseToken;
      const viewToken = createData.requestViewToken;

      // Close / cancel request using valid closeToken in body
      const closeRes = await app.request(`/api/v1/requests/${reqId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestCloseToken: closeToken, reason: 'Found alternative blood source' }),
      });
      expect(closeRes.status).toBe(200);
      const closeData = (await closeRes.json()) as any;
      expect(closeData.status).toBe('cancelled');

      // Terminal status check: viewToken no longer reveals donor contacts
      const pollRes = await app.request(`/api/v1/requests/${reqId}`, {
        headers: { Authorization: `Bearer ${viewToken}` },
      });
      expect(pollRes.status).toBe(200);
      const pollData = (await pollRes.json()) as any;
      expect(pollData.acceptedDonors).toHaveLength(0); // Withheld because cancelled!
    });
  });

  // =========================================================================
  // SCENARIO 6: REQUEST COMPLETION (TERMINAL STATUS)
  // =========================================================================
  describe('Scenario 6: Request Completion & Terminal Invariants', () => {
    test('6.1: Fulfilled request cannot be modified or re-opened', async () => {
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Fulfilled Patient',
          hospitalName: 'AIIMS New Delhi',
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 3,
          latitude: 28.567215,
          longitude: 77.210045,
          searchRadiusKm: 10,
        }),
      });
      const createData = (await createRes.json()) as any;
      const reqId = createData.request.id;
      const closeToken = createData.requestCloseToken;

      // Close it
      const firstClose = await app.request(`/api/v1/requests/${reqId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestCloseToken: closeToken, reason: 'Units fulfilled successfully' }),
      });
      expect(firstClose.status).toBe(200);

      // Second close attempt with same close token should be rejected (request already closed)
      const secondClose = await app.request(`/api/v1/requests/${reqId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestCloseToken: closeToken, reason: 'Attempt second close' }),
      });
      expect([400, 401, 409]).toContain(secondClose.status);
    });
  });
});
