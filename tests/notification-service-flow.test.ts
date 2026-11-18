import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { mockStore } from '../apps/api/src/services/mock-store';
import { inspectConfig } from '../apps/api/src/lib/config';
import { createDonorSessionToken, createDonorResponseToken } from '../apps/api/src/services/donor-session';

describe('RaktSetu — Full Notification Service End-to-End Flow Audit', () => {
  const donorId = 'donor-amit-ab-neg';
  const testFcmToken = 'fcm-device-token-' + 'x'.repeat(64);

  beforeEach(() => {
    mockStore.reset();
  });

  // STEP 1: Firebase Configuration & FCM Service Readiness
  it('Step 1: Firebase Cloud Messaging configuration and Admin SDK are active', () => {
    const config = inspectConfig();
    expect(config.push.configured).toBe(true);
    expect(config.push.projectId).toBe('raktsetu-be5fb');
    expect(config.push.credentialSource).toBe('GOOGLE_APPLICATION_CREDENTIALS');
    expect(config.push.fcmLinkUsable).toBe(true);
  });

  // STEP 2: Donor Push Token Registration
  it('Step 2: Donor registers device push token via POST /api/v1/push/register', async () => {
    const sessionToken = createDonorSessionToken(donorId);

    const res = await app.request('/api/v1/push/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ fcmToken: testFcmToken }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean };
    expect(data.success).toBe(true);

    const tokens = mockStore.getPushTokensForDonor(donorId);
    expect(tokens).toContain(testFcmToken);
  });

  // STEP 3: Emergency Blood Request Creation & Automated Donor Cascade
  it('Step 3: Creating an emergency blood request triggers automated outbox notification cascade', async () => {
    // Seed device token for donor-amit-ab-neg (AB- donor in New Delhi)
    mockStore.addPushSubscription(donorId, testFcmToken);

    // Request AB- blood at AIIMS New Delhi (institutional stock is 0 units -> triggers immediate donor cascade)
    const res = await app.request('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bloodGroupNeeded: 'AB-',
        unitsNeeded: 2,
        patientName: 'Kavita Krishnan',
        hospitalName: 'AIIMS New Delhi',
        latitude: 28.5672,
        longitude: 77.2100,
        searchRadiusKm: 10,
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      request: { id: string; status: string; bloodGroupNeeded: string };
      compatibleDonorsCount: number;
      notificationsSent: number;
      requestViewToken?: string;
    };

    expect(data.request.status).toBe('donors_notified');
    expect(data.compatibleDonorsCount).toBeGreaterThanOrEqual(1);
    expect(data.notificationsSent).toBeGreaterThanOrEqual(1);
    expect(data.requestViewToken).toBeDefined();

    // Verify notification record exists in outbox
    const notifs = mockStore.getNotificationsForRequest(data.request.id);
    expect(notifs.length).toBeGreaterThanOrEqual(1);

    const targetNotif = notifs.find((n) => n.donorId === donorId);
    expect(targetNotif).toBeDefined();
    expect(targetNotif?.status).toBe('sent');

    // Verify outbound push message was recorded
    const pushMsgs = mockStore.getOutboundPushMessages();
    const requestPush = pushMsgs.find((m) => m.requestId === data.request.id);
    expect(requestPush).toBeDefined();
    expect(requestPush?.recipientCount).toBeGreaterThanOrEqual(1);
  });

  // STEP 4: Complete Lifecycle from Notification Action Click to Seeker Dashboard
  it('Step 4: Donor clicks "I\'m available" -> Request fulfilled -> Seeker sees contact -> Anonymous redacted', async () => {
    // 1. Create request
    mockStore.addPushSubscription(donorId, testFcmToken);
    const createRes = await app.request('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bloodGroupNeeded: 'AB-',
        unitsNeeded: 1,
        patientName: 'Sunil Rao',
        hospitalName: 'Safdarjung Hospital',
        latitude: 28.5700,
        longitude: 77.2100,
        searchRadiusKm: 10,
      }),
    });

    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    const reqId = createData.request.id;
    const requestViewToken = createData.requestViewToken;
    expect(requestViewToken).toBeDefined();

    // 2. Generate signed donor response token (as included in push notification deep link)
    const responseToken = createDonorResponseToken(reqId, donorId);

    // 3. Donor responds "I'm available" via POST /api/v1/push/respond
    const respondRes = await app.request('/api/v1/push/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'accepted',
        responseToken,
      }),
    });

    expect(respondRes.status).toBe(200);
    const respondData = (await respondRes.json()) as any;
    expect(respondData.success).toBe(true);
    expect(respondData.status).toBe('accepted');
    expect(respondData.requestStatus).toBe('fulfilled');

    // 4. Verify request status in store is now fulfilled
    const updatedReq = mockStore.getRequest(reqId);
    expect(updatedReq?.status).toBe('fulfilled');

    // 5. Authorized Seeker views request (with requestViewToken) -> Accepted donor contact is revealed
    const authSeekerRes = await app.request(`/api/v1/requests/${reqId}`, {
      headers: { Authorization: `Bearer ${requestViewToken}` },
    });
    expect(authSeekerRes.status).toBe(200);
    const authSeekerData = (await authSeekerRes.json()) as any;
    expect(authSeekerData.acceptedDonors).toBeDefined();
    expect(authSeekerData.acceptedDonors.length).toBe(1);
    expect(authSeekerData.acceptedDonors[0].donorId).toBe(donorId);
    expect(authSeekerData.acceptedDonors[0].phone).toBe('+919822233344');
    expect(authSeekerData.acceptedDonors[0].directCallUrl).toBe('tel:+919822233344');

    // 6. Anonymous Public views request (without viewToken) -> Accepted donor contact is strictly empty/redacted
    const anonRes = await app.request(`/api/v1/requests/${reqId}`);
    expect(anonRes.status).toBe(200);
    const anonData = (await anonRes.json()) as any;
    expect(anonData.acceptedDonors.length).toBe(0);

    // 7. Duplicate acceptance on fulfilled request is safely handled
    const dupRes = await app.request('/api/v1/push/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'accepted',
        responseToken,
      }),
    });
    expect(dupRes.status).toBe(200);
    const dupData = (await dupRes.json()) as any;
    expect(dupData.duplicate).toBe(true);
  });
});
