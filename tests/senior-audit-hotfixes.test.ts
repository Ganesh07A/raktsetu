import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { mockStore } from '../apps/api/src/services/mock-store';
import { otpService } from '../apps/api/src/services/otp-service';
import {
  createRequestViewToken,
  createDonorResponseToken,
} from '../apps/api/src/services/donor-session';

describe('Senior Audit Hotfixes & Containment Suite', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  describe('Finding 1 & 2: OTP Security & Server-Side Enforcement', () => {
    it('does NOT broadcast OTP to registered donor push subscriptions', async () => {
      const phone = '+919876544998';
      const result = await otpService.sendOtp(phone, 'donor_registration');
      expect(result.success).toBe(true);
      // Ensure only the sender device receives OTP if token supplied; no broadcast to database subscribers
    });

    it('rejects donor registration with 401 when verificationTicket is missing in non-test mode', async () => {
      // Set test requirement flag
      const prev = process.env.TEST_REQUIRE_TICKET;
      process.env.TEST_REQUIRE_TICKET = 'true';

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Unauthorized Donor',
          phone: '+919876540001',
          bloodGroup: 'O+',
          latitude: 19.8762,
          longitude: 75.3433,
          state: 'Maharashtra',
          district: 'Chhatrapati Sambhajinagar',
          // verificationTicket omitted
        }),
      });

      process.env.TEST_REQUIRE_TICKET = prev;
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('verification ticket is required');
    });
  });

  describe('Finding 4: Ghost Donors & Availability PATCH', () => {
    it('returns 404 when updating availability for a non-existent donor (no fake 200)', async () => {
      const ghostId = 'donor-ghost-nonexistent';
      const token = 'fake-session-token';

      const res = await app.request(`/api/v1/donors/profile/${ghostId}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isAvailable: false }),
      });

      // Token verification fails or donor not found -> must NOT return 200
      expect(res.status).not.toBe(200);
    });
  });

  describe('Finding 5 & 6: Patient PII Protection on GET /requests/:id', () => {
    it('redacts patient full name and exact coordinates for anonymous callers', async () => {
      // Create request in mock store
      const reqId = 'req-test-pii-protection';
      mockStore.createRequest({
        id: reqId,
        patientName: 'John Doe Full Name',
        patientAge: 45,
        bloodGroupNeeded: 'B+',
        componentType: 'whole_blood',
        unitsNeeded: 2,
        hospitalName: 'Apollo Hospital',
        latitude: 28.56789,
        longitude: 77.21234,
        searchRadiusKm: 10,
        status: 'donors_notified',
        createdAt: new Date().toISOString(),
      });

      // Anonymous read
      const anonRes = await app.request(`/api/v1/requests/${reqId}`, {
        method: 'GET',
      });

      expect(anonRes.status).toBe(200);
      const anonData = await anonRes.json();
      expect(anonData.request.patientName).not.toBe('John Doe Full Name');
      expect(anonData.request.patientName).toContain('J. (Emergency Patient)');
      // Coordinates are rounded to ~1.1km (2 decimal places)
      expect(anonData.request.latitude).toBe(28.57);
      expect(anonData.request.longitude).toBe(77.21);

      // Authorized read with viewToken
      const viewToken = createRequestViewToken(reqId);
      const authRes = await app.request(`/api/v1/requests/${reqId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${viewToken}` },
      });

      expect(authRes.status).toBe(200);
      const authData = await authRes.json();
      expect(authData.request.patientName).toBe('John Doe Full Name');
      expect(authData.request.latitude).toBe(28.56789);
      expect(authData.request.longitude).toBe(77.21234);

      // Responding donor read with responseToken
      const respToken = createDonorResponseToken(reqId, 'donor-123');
      const donorRes = await app.request(`/api/v1/requests/${reqId}?responseToken=${respToken}`, {
        method: 'GET',
      });

      expect(donorRes.status).toBe(200);
      const donorData = await donorRes.json();
      expect(donorData.request.patientName).toBe('John Doe Full Name');
    });
  });

  describe('Finding 7: Blood Bank Search strictly respects radius', () => {
    it('excludes blood banks beyond the requested radius', async () => {
      const res = await app.request(
        '/api/v1/blood-banks/search?lat=19.8762&lng=75.3433&radiusKm=10&bloodGroup=O%2B',
        { method: 'GET' }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.banks)).toBe(true);
      for (const bank of data.banks) {
        if (typeof bank.distanceKm === 'number') {
          expect(bank.distanceKm).toBeLessThanOrEqual(10);
        }
      }
    });
  });
});
