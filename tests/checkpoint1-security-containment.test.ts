import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { mockStore } from '../apps/api/src/services/mock-store';
import { eraktkoshProxy } from '../apps/api/src/services/eraktkosh-proxy';
import { otpService } from '../apps/api/src/services/otp-service';
import {
  createRequestCloseToken,
  createRequestViewToken,
  resetConsumedTickets,
  createOtpVerificationTicket,
} from '../apps/api/src/services/donor-session';
import { defaultRateLimitStore } from '../apps/api/src/middleware/rate-limiter';
import {
  evaluateDonorMedicalEligibility,
  calculateAgeInYears,
} from '../packages/shared/src/validation';

describe('Checkpoint 1 Security Containment Suite', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.NOTIFICATIONS_ENABLED = 'true';
    mockStore.reset();
    eraktkoshProxy.clearCache();
    otpService.clear();
    resetConsumedTickets();
    defaultRateLimitStore.clear();
  });

  describe('C-01: Eliminate Synthetic Blood-Bank Inventory', () => {
    it('returns truthful directory or verified data and includes medical disclaimer', async () => {
      const res = await app.request('/api/v1/blood-banks/search?lat=28.5672&lng=77.21&radiusKm=10');
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        banks: Array<{
          name: string;
          phone: string | null;
          stock: Array<{ bloodGroup: string; unitsAvailable: number | null }>;
          source: string;
        }>;
        disclaimer: string;
      };

      expect(json.disclaimer).toBeDefined();
      expect(json.disclaimer).toContain('Final compatibility and cross-matching must be performed');

      // Verify no fabricated phone numbers or fake math hashes exist
      for (const bank of json.banks) {
        if (bank.phone) {
          expect(bank.phone).not.toBe('+91-240-2334411'); // Old hardcoded default must be gone
        }
      }
    });

    it('returns 400 when invalid coordinates or bad radius are passed', async () => {
      const res = await app.request('/api/v1/blood-banks/search?lat=999&lng=77.21');
      expect(res.status).toBe(400);
    });
  });

  describe('C-02: Secure Emergency Request Creation', () => {
    it('creates request and returns both requestViewToken and requestCloseToken', async () => {
      const payload = {
        bloodGroupNeeded: 'O+',
        unitsNeeded: 2,
        patientName: 'Kavita Singh',
        hospitalName: 'Safdarjung Hospital',
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 10,
      };

      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        request: { id: string; status: string };
        requestViewToken: string;
        requestCloseToken: string;
      };

      expect(json.request.id).toBeDefined();
      expect(json.requestViewToken).toBeDefined();
      expect(json.requestCloseToken).toBeDefined();
      expect(json.requestViewToken).not.toBe(json.requestCloseToken);
    });

    it('enforces idempotency via Idempotency-Key header', async () => {
      const payload = {
        bloodGroupNeeded: 'AB-',
        unitsNeeded: 1,
        patientName: 'Idempotent Seeker',
        hospitalName: 'Max Healthcare',
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 10,
      };

      const idempotencyKey = 'unique-idemp-key-test-123';

      const res1 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      expect(res1.status).toBe(201);
      const json1 = (await res1.json()) as { request: { id: string } };

      // Resubmit identical request with same key
      const res2 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      expect(res2.status).toBe(201);
      const json2 = (await res2.json()) as { request: { id: string } };

      expect(json1.request.id).toBe(json2.request.id);
    });

    it('respects notification kill switch NOTIFICATIONS_ENABLED=false', async () => {
      process.env.NOTIFICATIONS_ENABLED = 'false';

      const payload = {
        bloodGroupNeeded: 'AB-',
        unitsNeeded: 1,
        patientName: 'Kill Switch Test',
        hospitalName: 'Apollo Hospital',
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 10,
      };

      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { notificationsSent: number };
      expect(json.notificationsSent).toBe(0);
    });
  });

  describe('C-03: Protect Donor Personal Information & IDOR', () => {
    it('GET /api/v1/donors/compatible sanitizes output and strips all sensitive PII', async () => {
      const res = await app.request(
        '/api/v1/donors/compatible?bloodGroup=A+&lat=28.5672&lng=77.21&radiusKm=10'
      );
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        donors: Array<Record<string, unknown>>;
        count: number;
      };

      expect(json.donors).toBeArray();
      expect(json.count).toBeGreaterThan(0);

      for (const donor of json.donors) {
        // Must NEVER expose real phone, name, exact lat/lng, or userId in discovery
        expect(donor.phone).toBeUndefined();
        expect(donor.name).toBeUndefined();
        expect(donor.userId).toBeUndefined();
        expect(donor.latitude).toBeUndefined();
        expect(donor.longitude).toBeUndefined();
        expect(donor.id).toBeDefined();
        expect(donor.bloodGroup).toBeDefined();
        expect(donor.distanceKm).toBeDefined();
      }
    });

    it('enforces a hard radius limit of 50 km on discovery queries', async () => {
      const res = await app.request(
        '/api/v1/donors/compatible?bloodGroup=A+&lat=28.5672&lng=77.21&radiusKm=100'
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Search radius cannot exceed 50 km');
    });

    it('GET /api/v1/requests/:id redacts exact patient coordinates', async () => {
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'O+',
          unitsNeeded: 1,
          patientName: 'Confidential Patient',
          hospitalName: 'AIIMS',
          latitude: 28.56729182,
          longitude: 77.21048291,
          searchRadiusKm: 10,
        }),
      });

      const { request } = (await createRes.json()) as { request: { id: string } };

      const res = await app.request(`/api/v1/requests/${request.id}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { request: { latitude: number; longitude: number } };

      // Exact floating point coordinates must be rounded/truncated
      expect(data.request.latitude).toBe(28.57);
      expect(data.request.longitude).toBe(77.21);
    });

    it('rejects using requestCloseToken to view request details', async () => {
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'O+',
          unitsNeeded: 1,
          patientName: 'Token Test Patient',
          hospitalName: 'AIIMS',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });
      const { request, requestCloseToken } = (await createRes.json()) as {
        request: { id: string };
        requestCloseToken: string;
      };

      const res = await app.request(`/api/v1/requests/${request.id}`, {
        headers: { Authorization: `Bearer ${requestCloseToken}` },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Close token cannot be used');
    });
  });

  describe('C-04: Genuine Server-Side OTP Verification', () => {
    it('dispatches OTP and verifies it to issue a single-use verification ticket', async () => {
      const phone = '+919123456780';

      // 1. Send OTP
      const sendRes = await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'donor_registration' }),
      });
      expect(sendRes.status).toBe(200);

      // In test mode, retrieve generated OTP from test inspector
      const otp = otpService.getTestOtp(phone, 'donor_registration');
      expect(otp).toBeDefined();
      expect(otp?.length).toBe(6);

      // 2. Reject incorrect OTP
      const wrongVerify = await app.request('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: '000000', purpose: 'donor_registration' }),
      });
      expect(wrongVerify.status).toBe(400);

      // 3. Verify correct OTP
      const verifyRes = await app.request('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, purpose: 'donor_registration' }),
      });
      expect(verifyRes.status).toBe(200);
      const verifyData = (await verifyRes.json()) as { verificationTicket: string };
      expect(verifyData.verificationTicket).toBeDefined();

      // 4. Use ticket to register donor
      const regRes = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: 'Verified OTP Donor',
          bloodGroup: 'B+',
          latitude: 28.5672,
          longitude: 77.21,
          state: 'Delhi',
          district: 'South Delhi',
          verificationTicket: verifyData.verificationTicket,
        }),
      });
      expect(regRes.status).toBe(201);

      // 5. Replay attempt: Consuming the same ticket twice must be rejected
      const replayRes = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+919123456781',
          name: 'Replay Attacker',
          bloodGroup: 'B+',
          latitude: 28.5672,
          longitude: 77.21,
          state: 'Delhi',
          district: 'South Delhi',
          verificationTicket: verifyData.verificationTicket,
        }),
      });
      expect(replayRes.status).toBe(401);
    });

    it('enforces 60-second cooldown on repeated OTP send requests', async () => {
      const phone = '+919876500001';

      const res1 = await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'donor_registration' }),
      });
      expect(res1.status).toBe(200);

      const res2 = await app.request('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'donor_registration' }),
      });
      expect(res2.status).toBe(429);
      const data2 = (await res2.json()) as { error: string };
      expect(data2.error).toContain('wait');
    });
  });

  describe('C-05: Server-Side Medical Eligibility Enforcement', () => {
    it('rejects donor registration if donor is underage (<18)', async () => {
      const underageDob = new Date();
      underageDob.setFullYear(underageDob.getFullYear() - 17); // 17 years old
      const dobStr = underageDob.toISOString().slice(0, 10);

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+919876511111',
          name: 'Young Donor',
          bloodGroup: 'O+',
          latitude: 28.5672,
          longitude: 77.21,
          state: 'Delhi',
          district: 'South Delhi',
          dateOfBirth: dobStr,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Donor age must be between 18 and 65 years');
    });

    it('rejects donor registration if weight is under 45 kg', async () => {
      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+919876522222',
          name: 'Underweight Donor',
          bloodGroup: 'O+',
          latitude: 28.5672,
          longitude: 77.21,
          state: 'Delhi',
          district: 'South Delhi',
          weightKg: 42,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Minimum weight for donation is 45 kg');
    });

    it('rejects future last donation dates', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+919876533333',
          name: 'Time Traveler Donor',
          bloodGroup: 'O+',
          latitude: 28.5672,
          longitude: 77.21,
          state: 'Delhi',
          district: 'South Delhi',
          lastDonationDate: futureDate,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Last donation date cannot be in the future');
    });
  });

  describe('H-05: Protection of Request Status and Actions', () => {
    it('rejects unauthenticated PATCH /api/v1/requests/:id/status updates', async () => {
      const res = await app.request('/api/v1/requests/req-sample-01/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fulfilled' }),
      });

      expect(res.status).toBe(401);
    });

    it('accepts status update when valid requestCloseToken is provided', async () => {
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'O+',
          unitsNeeded: 1,
          patientName: 'Authorized Close Patient',
          hospitalName: 'AIIMS',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });

      const { request, requestCloseToken } = (await createRes.json()) as {
        request: { id: string };
        requestCloseToken: string;
      };

      const res = await app.request(`/api/v1/requests/${request.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-close-token': requestCloseToken,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; updatedStatus: string };
      expect(json.success).toBe(true);
      expect(json.updatedStatus).toBe('cancelled');
    });
  });

  describe('H-06: Centralized API Rate Limiting', () => {
    it('returns 429 and Retry-After header when rate limit is exceeded', async () => {
      // Send 11 requests with x-enforce-rate-limit to trigger limit of 10 on requests endpoint
      let lastRes;

      for (let i = 0; i < 11; i++) {
        lastRes = await app.request('/api/v1/requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-enforce-rate-limit': 'true',
          },
          body: JSON.stringify({
            bloodGroupNeeded: 'O+',
            unitsNeeded: 1,
            patientName: `Rate Limit Test ${i}`,
            hospitalName: 'AIIMS',
            latitude: 28.5672,
            longitude: 77.21,
            searchRadiusKm: 10,
          }),
        });
      }

      expect(lastRes?.status).toBe(429);
      expect(lastRes?.headers.get('Retry-After')).toBeDefined();
      expect(lastRes?.headers.get('RateLimit-Limit')).toBe('10');
      const data = (await lastRes?.json()) as { status: number; error: string };
      expect(data.status).toBe(429);
    });
  });
});
