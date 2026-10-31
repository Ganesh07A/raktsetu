import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '../index';
import { mockStore } from '../services/mock-store';
import { createDonorResponseToken } from '../services/donor-session';

describe('Blood Requests Lifecycle API (/api/v1/requests)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    mockStore.reset();
  });

  describe('POST / (Create Blood Request)', () => {
    it('returns 400 when patientName is missing or too short', async () => {
      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'A+',
          patientName: 'A', // Too short
          hospitalName: 'AIIMS Delhi',
          latitude: 28.5672,
          longitude: 77.21,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Patient name must be at least 2 characters');
    });

    it('returns 400 when hospitalName is missing', async () => {
      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'A+',
          patientName: 'Patient Name',
          hospitalName: '',
          latitude: 28.5672,
          longitude: 77.21,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Hospital name must be at least 2 characters');
    });

    it('returns 400 when blood group is invalid', async () => {
      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'XYZ',
          patientName: 'Patient Name',
          hospitalName: 'AIIMS',
          latitude: 28.5672,
          longitude: 77.21,
        }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid blood group needed');
    });

    it('sets status to bank_found when institutional stock exists', async () => {
      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'A+',
          unitsNeeded: 1, // AIIMS Delhi has 5 units of A+
          patientName: 'Geeta Devi',
          hospitalName: 'AIIMS New Delhi',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        request: { id: string; status: string; fulfillmentSource: string };
        compatibleDonorsCount: number;
        notificationsSent: number;
      };

      expect(json.request.status).toBe('bank_found');
      expect(json.request.fulfillmentSource).toBe('blood_bank');
      expect(json.compatibleDonorsCount).toBe(0);
      expect(json.notificationsSent).toBe(0);
    });

    it('automatically cascades to donors when nearby banks have 0 units of requested blood group', async () => {
      const res = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'AB-', // Rare group with 0 stock in AIIMS & Safdarjung
          unitsNeeded: 3,
          patientName: 'Manoj Bajpayee',
          hospitalName: 'AIIMS New Delhi',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        request: { id: string; status: string; bloodGroupNeeded: string };
        compatibleDonorsCount: number;
        notificationsSent: number;
      };

      expect(json.request.status).toBe('donors_notified');
      expect(json.compatibleDonorsCount).toBeGreaterThan(0);
      expect(json.notificationsSent).toBeGreaterThan(0);

      // Verify notifications were created
      const notifs = mockStore.getNotificationsForRequest(json.request.id);
      expect(notifs.length).toBe(json.notificationsSent);

      // Verify privacy: masked phone numbers stored in notifications
      for (const n of notifs) {
        expect((n as any).donorPhoneMasked).toContain('****');
      }

      // Verify push messages were queued
      const msgs = mockStore.getOutboundPushMessages();
      expect(msgs.some((m) => m.requestId === json.request.id)).toBe(true);
    });
  });

  describe('GET /:id and Waiting Room Flow', () => {
    it('returns 404 for nonexistent request ID', async () => {
      const res = await app.request('/api/v1/requests/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('returns waiting room details with masked contacts when pending and unmasked when accepted', async () => {
      // 1. Create cascading request
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 1,
          patientName: 'Rameshwar Dayal',
          hospitalName: 'AIIMS New Delhi',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });
      const created = (await createRes.json()) as { request: { id: string } };
      const reqId = created.request.id;

      // 2. Initial state: No donor has accepted yet
      const initRes = await app.request(`/api/v1/requests/${reqId}`);
      expect(initRes.status).toBe(200);
      const initJson = (await initRes.json()) as {
        request: { status: string };
        acceptedDonors: unknown[];
        notifications: Array<{ id: string; status: string; donorId?: string; donorPhoneMasked?: string; donorName?: string }>;
      };
      expect(initJson.request.status).toBe('donors_notified');
      expect(initJson.acceptedDonors.length).toBe(0);
      expect(initJson.notifications.length).toBeGreaterThan(0);
      expect(initJson.notifications[0]!.status).toBe('sent');
      // Pending donor identity and contact details must remain private.
      expect(initJson.notifications[0]!.donorId).toBeUndefined();
      expect(initJson.notifications[0]!.donorPhoneMasked).toBeUndefined();
      expect(initJson.notifications[0]!.donorName).toBeUndefined();

      // 3. Donor accepts via deep link respond endpoint
      const respondRes = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseToken: createDonorResponseToken(reqId, 'donor-amit-ab-neg'),
          action: 'accepted',
          responseNote: 'On my way to AIIMS, will arrive in 20 minutes',
        }),
      });
      expect(respondRes.status).toBe(200);

      // 4. Waiting room unlocks unmasked contact details after acceptance
      const acceptedRes = await app.request(`/api/v1/requests/${reqId}`);
      expect(acceptedRes.status).toBe(200);

      const acceptedJson = (await acceptedRes.json()) as {
        request: { status: string; fulfillmentSource: string };
        acceptedDonors: Array<{
          donorId: string;
          name: string;
          phone: string;
          directCallUrl: string;
        }>;
      };

      expect(acceptedJson.request.status).toBe('fulfilled');
      expect(acceptedJson.request.fulfillmentSource).toBe('donor');
      expect(acceptedJson.acceptedDonors.length).toBe(1);

      const donor = acceptedJson.acceptedDonors[0]!;
      expect(donor.donorId).toBe('donor-amit-ab-neg');
      expect(donor.phone).toBe('+919822233344');
      expect(donor.directCallUrl).toBe('tel:+919822233344');
    });

    it('donor decline marks notification declined without fulfilling request', async () => {
      // 1. Create cascading request
      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 1,
          patientName: 'Test Patient',
          hospitalName: 'AIIMS New Delhi',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });
      const created = (await createRes.json()) as { request: { id: string } };
      const reqId = created.request.id;

      // 2. Donor declines
      const respondRes = await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseToken: createDonorResponseToken(reqId, 'donor-amit-ab-neg'),
          action: 'declined',
          responseNote: 'Out of town',
        }),
      });
      expect(respondRes.status).toBe(200);

      // 3. Request should NOT be fulfilled
      const getRes = await app.request(`/api/v1/requests/${reqId}`);
      const getJson = (await getRes.json()) as {
        request: { status: string };
        notifications: Array<{ id: string; status: string }>;
      };

      expect(getJson.request.status).toBe('donors_notified');
      expect(getJson.notifications).toHaveLength(1);
      expect(getJson.notifications[0]!.status).toBe('declined');
    });
  });
});
