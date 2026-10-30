import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '../index';
import { mockStore } from '../services/mock-store';

describe('Donor Routes (/api/v1/donors)', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  describe('POST /register', () => {
    it('successfully registers donor with valid payload and normalizes 10-digit phone', async () => {
      const payload = {
        name: 'Karan Johar',
        phone: '9899001122', // Without +91
        bloodGroup: 'O+',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'South Delhi',
        whatsappConsent: true,
        gender: 'male',
        weightKg: 70,
        preferredLanguage: 'hi',
      };

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        donor: { id: string; name: string; phone: string; bloodGroup: string };
        token: string;
      };

      expect(json.success).toBe(true);
      expect(json.donor.id).toBeDefined();
      expect(json.donor.phone).toBe('+919899001122');
      expect(json.token).toBeDefined();

      // Verify donor is now stored and retrievable
      const stored = mockStore.getDonorByPhone('+919899001122');
      expect(stored).toBeDefined();
      expect((stored as any).name).toBe('Karan Johar');
    });

    it('rejects registration without mandatory WhatsApp consent', async () => {
      const payload = {
        name: 'Amitabh Sen',
        phone: '+919899001133',
        bloodGroup: 'B+',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'South Delhi',
        whatsappConsent: false, // Refused consent
      };

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Consent to receive WhatsApp notifications is required');
    });

    it('rejects registration with invalid Indian phone number', async () => {
      const payload = {
        name: 'John Doe',
        phone: '12345',
        bloodGroup: 'A+',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'South Delhi',
        whatsappConsent: true,
      };

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid Indian mobile number');
    });

    it('rejects registration with invalid blood group', async () => {
      const payload = {
        name: 'Jane Doe',
        phone: '+919899001144',
        bloodGroup: 'C+', // Invalid
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'South Delhi',
        whatsappConsent: true,
      };

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid blood group');
    });

    it('returns 409 conflict when registering with already-registered phone', async () => {
      const payload = {
        name: 'Rahul Sharma Duplicate',
        phone: '+919876543210', // Already registered in seed
        bloodGroup: 'A+',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'South Delhi',
        whatsappConsent: true,
      };

      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('already registered');
    });
  });

  describe('GET /compatible and POST /match', () => {
    it('GET /compatible returns candidate donors within radius', async () => {
      const res = await app.request(
        '/api/v1/donors/compatible?bloodGroup=A+&lat=28.5672&lng=77.21&radiusKm=10'
      );
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        donors: Array<{ name: string; bloodGroup: string; distanceKm: number }>;
        count: number;
      };

      expect(json.donors).toBeArray();
      expect(json.count).toBeGreaterThan(0);
      for (const d of json.donors) {
        expect(['A+', 'A-', 'O+', 'O-']).toContain(d.bloodGroup);
        expect(d.distanceKm).toBeLessThanOrEqual(10);
      }
    });

    it('POST /match returns candidate donors matching ABO/Rh matrix', async () => {
      const res = await app.request('/api/v1/donors/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientBloodGroup: 'B-',
          latitude: 28.5672,
          longitude: 77.21,
          radiusKm: 10,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        donors: Array<{ bloodGroup: string }>;
        matchedCount: number;
      };

      expect(json.success).toBe(true);
      // For B-, only B- and O- are compatible
      for (const d of json.donors) {
        expect(['B-', 'O-']).toContain(d.bloodGroup);
      }
    });
  });

  describe('Availability Toggle (PATCH /profile/:id/availability)', () => {
    it('toggles donor active availability', async () => {
      const res = await app.request(
        '/api/v1/donors/profile/donor-rahul-a-pos/availability',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isAvailable: false }),
        }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { isAvailable: boolean };
      expect(json.isAvailable).toBe(false);

      const donor = mockStore.getDonorById('donor-rahul-a-pos');
      expect(donor?.isAvailable).toBe(false);
    });
  });
});
