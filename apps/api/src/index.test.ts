import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from './index';
import { mockStore } from './services/mock-store';
import { createDonorResponseToken } from './services/donor-session';

describe('API Server Endpoints', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('GET /health returns status ok with ISO timestamp', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('GET /api/v1/blood-banks/search validates missing coordinates with 400', async () => {
    const res = await app.request('/api/v1/blood-banks/search');
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Missing latitude or longitude');
  });

  it('GET /api/v1/blood-banks/search returns nearby blood banks', async () => {
    const res = await app.request(
      '/api/v1/blood-banks/search?lat=28.5672&lng=77.21&radiusKm=10&bloodGroup=A+'
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      banks: Array<{ name: string; distanceKm: number }>;
      totalCount: number;
      source: string;
    };
    expect(body.banks).toBeArray();
    expect(body.totalCount).toBeGreaterThan(0);
    expect(body.banks[0]!.distanceKm).toBeLessThanOrEqual(10);
  });

  it('GET /api/v1/blood-banks/states returns Indian states list', async () => {
    const res = await app.request('/api/v1/blood-banks/states');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { states: Array<{ code: string; name: string }> };
    expect(body.states).toBeArray();
    expect(body.states.some((s) => s.code === 'DL' && s.name === 'Delhi')).toBe(true);
  });

  it('GET /api/v1/blood-banks/districts/:stateCode returns districts for state', async () => {
    const res = await app.request('/api/v1/blood-banks/districts/DL');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { districts: Array<{ code: string; name: string }> };
    expect(body.districts).toBeArray();
    expect(body.districts.some((d) => d.name === 'South Delhi')).toBe(true);
  });

  it('GET /api/v1/blood-banks/districts/:stateCode returns 404 for invalid state', async () => {
    const res = await app.request('/api/v1/blood-banks/districts/INVALID_STATE');
    expect(res.status).toBe(404);
  });

  it('does not expose the retired WhatsApp webhook endpoint', async () => {
    const res = await app.request(
      '/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=arbitrary&hub.challenge=test_challenge'
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/donors/register registers a volunteer donor', async () => {
    const payload = {
      name: 'Rohan Mehra',
      phone: '+919988776655',
      bloodGroup: 'B+',
      latitude: 28.5672,
      longitude: 77.21,
      state: 'Delhi',
      district: 'South Delhi',
      preferredLanguage: 'en',
    };

    const res = await app.request('/api/v1/donors/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; donor: { id: string; name: string } };
    expect(body.success).toBe(true);
    expect(body.donor.id).toBeDefined();
  });

  it('POST /api/v1/requests creates blood request and handles bank hit', async () => {
    const payload = {
      bloodGroupNeeded: 'A+',
      unitsNeeded: 1,
      patientName: 'Kavita Singh',
      hospitalName: 'AIIMS New Delhi',
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
    const body = (await res.json()) as {
      request: { id: string; status: string; fulfillmentSource: string };
      compatibleDonorsCount: number;
    };
    expect(body.request.status).toBe('bank_found');
    expect(body.request.fulfillmentSource).toBe('blood_bank');
  });

  it('POST /api/v1/requests cascades to donors when blood banks have no stock', async () => {
    const payload = {
      bloodGroupNeeded: 'AB-',
      unitsNeeded: 5, // Bank has 0 units of AB-
      patientName: 'Sameer Sen',
      hospitalName: 'AIIMS New Delhi',
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
    const body = (await res.json()) as {
      request: { id: string; status: string };
      compatibleDonorsCount: number;
      notificationsSent: number;
    };
    expect(body.request.status).toBe('donors_notified');
    expect(body.compatibleDonorsCount).toBeGreaterThan(0);
    expect(body.notificationsSent).toBeGreaterThan(0);
  });

  it('GET /api/v1/requests/:id returns request waiting room status and unlocks accepted donor', async () => {
    // 1. Create request that notifies donors
    const createRes = await app.request('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bloodGroupNeeded: 'AB-',
        unitsNeeded: 2,
        patientName: 'Dev Sharma',
        hospitalName: 'AIIMS New Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 10,
      }),
    });
    const created = (await createRes.json()) as { request: { id: string } };
    const requestId = created.request.id;

    // 2. Respond through the signed push-response token (the legacy client-supplied donorId route is removed)
    const donorId = 'donor-amit-ab-neg';
    const respondRes = await app.request('/api/v1/push/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseToken: createDonorResponseToken(requestId, donorId),
        action: 'accepted',
      }),
    });
    expect(respondRes.status).toBe(200);

    // 3. Check waiting room state
    const waitingRes = await app.request(`/api/v1/requests/${requestId}`);
    expect(waitingRes.status).toBe(200);

    const waitingBody = (await waitingRes.json()) as {
      request: { status: string; fulfillmentSource: string };
      acceptedDonors: Array<{ name: string; phone: string; directCallUrl: string }>;
    };
    expect(waitingBody.request.status).toBe('fulfilled');
    expect(waitingBody.request.fulfillmentSource).toBe('donor');
    expect(waitingBody.acceptedDonors.length).toBeGreaterThan(0);
    expect(waitingBody.acceptedDonors[0]!.phone).toContain('+91');
    expect(waitingBody.acceptedDonors[0]!.directCallUrl).toContain('tel:');
  });
});
