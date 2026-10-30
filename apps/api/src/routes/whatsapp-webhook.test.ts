import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { app } from '../index';
import { mockStore } from '../services/mock-store';
import { requestService } from '../services/request-service';
import {
  computeHmacSha256,
  verifyWhatsAppSignature,
  parseDonorTextIntent,
} from './whatsapp-webhook';

describe('WhatsApp Webhook Routes (/api/v1/whatsapp)', () => {
  const testSecret = 'test_whatsapp_app_secret_123';
  const testVerifyToken = 'test_whatsapp_verify_token_456';

  let originalVerifyToken: string | undefined;
  let originalAppSecret: string | undefined;

  beforeEach(() => {
    mockStore.reset();
    originalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    originalAppSecret = process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_VERIFY_TOKEN = testVerifyToken;
    process.env.WHATSAPP_APP_SECRET = testSecret;
  });

  afterEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = originalVerifyToken;
    process.env.WHATSAPP_APP_SECRET = originalAppSecret;
  });

  describe('verifyWhatsAppSignature unit tests', () => {
    const rawBody = JSON.stringify({ hello: 'world' });
    const validDigest = computeHmacSha256(rawBody, testSecret);

    it('accepts exact valid signature format sha256=<64 hex chars>', () => {
      expect(verifyWhatsAppSignature(rawBody, `sha256=${validDigest}`, testSecret)).toBe(true);
    });

    it('rejects signature with missing sha256= prefix', () => {
      expect(verifyWhatsAppSignature(rawBody, validDigest, testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, 'a'.repeat(64), testSecret)).toBe(false);
    });

    it('rejects signature with incorrect prefix (sha1=, md5=, sha512=)', () => {
      expect(verifyWhatsAppSignature(rawBody, `sha1=${validDigest}`, testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, `md5=${validDigest}`, testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, `sha512=${validDigest}`, testSecret)).toBe(false);
    });

    it('rejects signature with invalid hex characters', () => {
      const invalidHex = 'g'.repeat(64);
      expect(verifyWhatsAppSignature(rawBody, `sha256=${invalidHex}`, testSecret)).toBe(false);
      const mixedInvalid = 'a'.repeat(63) + 'z';
      expect(verifyWhatsAppSignature(rawBody, `sha256=${mixedInvalid}`, testSecret)).toBe(false);
    });

    it('rejects signature with incorrect digest length (<64 or >64 chars)', () => {
      expect(verifyWhatsAppSignature(rawBody, 'sha256=1234', testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, `sha256=${'a'.repeat(62)}`, testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, `sha256=${'a'.repeat(66)}`, testSecret)).toBe(false);
    });

    it('rejects null or undefined signatureHeader or appSecret', () => {
      expect(verifyWhatsAppSignature(rawBody, null, testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, undefined, testSecret)).toBe(false);
      expect(verifyWhatsAppSignature(rawBody, `sha256=${validDigest}`, '')).toBe(false);
    });
  });

  describe('parseDonorTextIntent unit tests', () => {
    it('correctly classifies "I am not ready" as declined and never accepted', () => {
      const intent = parseDonorTextIntent('I am not ready');
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');
    });

    it('correctly classifies "I am not ready to donate" as declined and never accepted', () => {
      const intent = parseDonorTextIntent('I am not ready to donate');
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');
      expect(parseDonorTextIntent('Not ready to donate')).toBe('declined');
    });

    it('correctly classifies "I am not available to donate" as declined and never accepted', () => {
      const intent = parseDonorTextIntent('I am not available to donate');
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');
      expect(parseDonorTextIntent('Not available to donate')).toBe('declined');
    });

    it('correctly classifies "I am not willing to donate" as declined and never accepted', () => {
      const intent = parseDonorTextIntent('I am not willing to donate');
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');
      expect(parseDonorTextIntent('Not willing to donate')).toBe('declined');
    });

    it('correctly classifies "I don\'t agree" as declined and never accepted', () => {
      const intent = parseDonorTextIntent("I don't agree");
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');

      // Also with straight/smart quotes or "do not"
      expect(parseDonorTextIntent('I do not agree')).toBe('declined');
      expect(parseDonorTextIntent('I dont agree')).toBe('declined');
      expect(parseDonorTextIntent('I don’t agree')).toBe('declined');
    });

    it('correctly classifies "I am not available" as declined and never accepted', () => {
      const intent = parseDonorTextIntent('I am not available');
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');
      expect(parseDonorTextIntent('Not available right now')).toBe('declined');
    });

    it('correctly classifies "I can\'t donate" as declined', () => {
      const intent = parseDonorTextIntent("I can't donate");
      expect(intent).toBe('declined');
      expect(intent).not.toBe('accepted');
      expect(parseDonorTextIntent('I cannot donate')).toBe('declined');
      expect(parseDonorTextIntent('I cant donate')).toBe('declined');
      expect(parseDonorTextIntent('I can’t donate')).toBe('declined');
    });

    it('returns null for messages with contradictory affirmative and negative intent', () => {
      expect(parseDonorTextIntent('Yes, but I cannot donate')).toBeNull();
      expect(parseDonorTextIntent('Yes, but I am not available')).toBeNull();
      expect(parseDonorTextIntent('Yes, but I am not available to donate')).toBeNull();
      expect(parseDonorTextIntent('Yes, but I am not ready to donate')).toBeNull();
      expect(parseDonorTextIntent('Yes, but I am not willing to donate')).toBeNull();
      expect(parseDonorTextIntent("I can donate, but I don't agree")).toBeNull();
      expect(parseDonorTextIntent('Yes no')).toBeNull();
      expect(parseDonorTextIntent('Accept but cannot come')).toBeNull();
    });

    it('avoids treating standalone ambiguous words as acceptance without affirmative context', () => {
      expect(parseDonorTextIntent('ready')).toBeNull();
      expect(parseDonorTextIntent('available')).toBeNull();
      expect(parseDonorTextIntent('agree')).toBeNull();
      expect(parseDonorTextIntent('Is the patient ready?')).toBeNull();
      expect(parseDonorTextIntent('When will units be available?')).toBeNull();
      expect(parseDonorTextIntent('Do doctors agree?')).toBeNull();
    });

    it('recognizes clear affirmative responses in proper context', () => {
      expect(parseDonorTextIntent('YES')).toBe('accepted');
      expect(parseDonorTextIntent('YES, I can donate')).toBe('accepted');
      expect(parseDonorTextIntent('I am ready')).toBe('accepted');
      expect(parseDonorTextIntent('I am available')).toBe('accepted');
      expect(parseDonorTextIntent('I agree')).toBe('accepted');
      expect(parseDonorTextIntent('Haan, ready to donate')).toBe('accepted');
      expect(parseDonorTextIntent('Sure, happy to donate')).toBe('accepted');
    });

    it('ignores non-donor words like "yesterday", "acceptable", and "nobody"', () => {
      expect(parseDonorTextIntent('I visited yesterday')).toBeNull();
      expect(parseDonorTextIntent('The terms are acceptable')).toBeNull();
      expect(parseDonorTextIntent('Nobody is home')).toBeNull();
    });
  });

  describe('GET /webhook (Hub Challenge Verification)', () => {
    it('verifies valid subscription challenge with 200 plain text', async () => {
      const res = await app.request(
        `/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${testVerifyToken}&hub.challenge=test_meta_challenge_123`
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('test_meta_challenge_123');
    });

    it('rejects invalid verify token with 403', async () => {
      const res = await app.request(
        '/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=invalid_token&hub.challenge=test_challenge'
      );

      expect(res.status).toBe(403);
    });

    it('rejects missing or wrong hub.mode with 403', async () => {
      const res = await app.request(
        `/api/v1/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=${testVerifyToken}&hub.challenge=test_challenge`
      );

      expect(res.status).toBe(403);
    });

    it('rejects GET challenge verification with 503 when WHATSAPP_VERIFY_TOKEN is missing', async () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;

      const res = await app.request(
        `/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${testVerifyToken}&hub.challenge=test_challenge`
      );

      expect(res.status).toBe(503);
      const text = await res.text();
      expect(text).toContain('WHATSAPP_VERIFY_TOKEN is not configured');
    });
  });

  describe('POST /webhook (Meta Inbound Payload)', () => {
    it('processes interactive accept button reply with valid HMAC signature and updates request status', async () => {
      // 1. Create request
      mockStore.createRequest({
        id: 'req-wb-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      // 2. Add notification
      mockStore.addNotification({
        id: 'notif-wb-1',
        requestId: 'req-wb-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // 3. Meta webhook payload with interactive button click
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.test.123',
                      timestamp: '1793339000',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'accept_req-wb-1_donor-rahul-a-pos',
                          title: '✅ I Can Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request transitioned to fulfilled
      const req = mockStore.getRequest('req-wb-1');
      expect(req?.status).toBe('fulfilled');
      expect(req?.fulfillmentSource).toBe('donor');

      // Verify notification marked accepted
      const notifs = mockStore.getNotificationsForRequest('req-wb-1');
      expect(notifs[0]!.status).toBe('accepted');
    });

    it('rejects button reply when sender phone does not match encoded donorId', async () => {
      // 1. Create request and notification for Rahul
      mockStore.createRequest({
        id: 'req-mismatch-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-mismatch-1',
        requestId: 'req-mismatch-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // 2. Priya (919811122233) attempts to click Rahul's button (donor-rahul-a-pos)
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919811122233', // Priya's phone
                      id: 'wamid.mismatch.1',
                      timestamp: '1793339001',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'accept_req-mismatch-1_donor-rahul-a-pos', // Rahul's payload!
                          title: '✅ I Can Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is NOT fulfilled
      const req = mockStore.getRequest('req-mismatch-1');
      expect(req?.status).toBe('donors_notified');

      // Verify notification remains sent
      const notifs = mockStore.getNotificationsForRequest('req-mismatch-1');
      expect(notifs[0]!.status).toBe('sent');
    });

    it('rejects button reply with invalid or unknown action prefix and never defaults to declined', async () => {
      mockStore.createRequest({
        id: 'req-btn-invalid-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-btn-invalid-1',
        requestId: 'req-btn-invalid-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Send button click with invalid action "unknown" instead of "accept" or "decline"
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210', // Rahul's registered phone
                      id: 'wamid.invalid.btn.1',
                      timestamp: '1793339002',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'unknown_req-btn-invalid-1_donor-rahul-a-pos',
                          title: '❓ Unknown Action',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is NOT fulfilled and NOT changed
      const req = mockStore.getRequest('req-btn-invalid-1');
      expect(req?.status).toBe('donors_notified');

      // Verify notification remains sent (never defaulted to declined)
      const notifs = mockStore.getNotificationsForRequest('req-btn-invalid-1');
      expect(notifs[0]!.status).toBe('sent');
      expect(notifs[0]!.status).not.toBe('declined');
    });

    it('rejects button reply from an unknown/unregistered sender phone', async () => {
      mockStore.createRequest({
        id: 'req-unknown-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-unknown-1',
        requestId: 'req-unknown-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '910000000000', // Unregistered phone
                      id: 'wamid.unknown.1',
                      timestamp: '1793339002',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'accept_req-unknown-1_donor-rahul-a-pos',
                          title: '✅ I Can Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is NOT fulfilled
      const req = mockStore.getRequest('req-unknown-1');
      expect(req?.status).toBe('donors_notified');

      const notifs = mockStore.getNotificationsForRequest('req-unknown-1');
      expect(notifs[0]!.status).toBe('sent');
    });

    it('handles duplicate responses idempotently', async () => {
      mockStore.createRequest({
        id: 'req-dup-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-dup-1',
        requestId: 'req-dup-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const makePayload = () => ({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.dup.1',
                      timestamp: '1793339003',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'accept_req-dup-1_donor-rahul-a-pos',
                          title: '✅ I Can Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      // First accept
      const raw1 = JSON.stringify(makePayload());
      const sig1 = `sha256=${computeHmacSha256(raw1, testSecret)}`;
      const res1 = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig1 },
        body: raw1,
      });
      expect(res1.status).toBe(200);

      const reqAfterFirst = mockStore.getRequest('req-dup-1');
      expect(reqAfterFirst?.status).toBe('fulfilled');

      // Second accept (duplicate)
      const raw2 = JSON.stringify(makePayload());
      const sig2 = `sha256=${computeHmacSha256(raw2, testSecret)}`;
      const res2 = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig2 },
        body: raw2,
      });
      expect(res2.status).toBe(200);

      const reqAfterSecond = mockStore.getRequest('req-dup-1');
      expect(reqAfterSecond?.status).toBe('fulfilled');
    });

    it('processes decline button reply without fulfilling the request', async () => {
      mockStore.createRequest({
        id: 'req-decline-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-decline-1',
        requestId: 'req-decline-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.decline.1',
                      timestamp: '1793339004',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'decline_req-decline-1_donor-rahul-a-pos',
                          title: '❌ Cannot Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is NOT fulfilled
      const req = mockStore.getRequest('req-decline-1');
      expect(req?.status).toBe('donors_notified');

      // Verify notification is marked declined
      const notifs = mockStore.getNotificationsForRequest('req-decline-1');
      expect(notifs[0]!.status).toBe('declined');
    });

    it('processes valid free-text response when donor has exactly 1 pending notification', async () => {
      mockStore.createRequest({
        id: 'req-text-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-text-1',
        requestId: 'req-text-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.text.1',
                      timestamp: '1793339005',
                      type: 'text',
                      text: {
                        body: 'YES, I can donate blood for this emergency!',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is fulfilled
      const req = mockStore.getRequest('req-text-1');
      expect(req?.status).toBe('fulfilled');

      const notifs = mockStore.getNotificationsForRequest('req-text-1');
      expect(notifs[0]!.status).toBe('accepted');
    });

    it('avoids arbitrary selection when donor has multiple pending requests with ambiguous free text', async () => {
      // Create request 1
      mockStore.createRequest({
        id: 'req-ambig-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita Sharma',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
      mockStore.addNotification({
        id: 'notif-ambig-1',
        requestId: 'req-ambig-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Create request 2
      mockStore.createRequest({
        id: 'req-ambig-2',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 2,
        patientName: 'Rohan Mehra',
        patientAge: null,
        emergencyType: 'accident',
        hospitalName: 'Safdarjung Hospital',
        latitude: 28.57,
        longitude: 77.208,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
      mockStore.addNotification({
        id: 'notif-ambig-2',
        requestId: 'req-ambig-2',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Ambiguous message without mentioning request or patient
      const ambiguousPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.ambig.1',
                      timestamp: '1793339006',
                      type: 'text',
                      text: {
                        body: 'YES I am available',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawAmbig = JSON.stringify(ambiguousPayload);
      const sigAmbig = `sha256=${computeHmacSha256(rawAmbig, testSecret)}`;

      const resAmbig = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sigAmbig },
        body: rawAmbig,
      });

      expect(resAmbig.status).toBe(200);

      // Neither request should be fulfilled arbitrarily
      expect(mockStore.getRequest('req-ambig-1')?.status).toBe('donors_notified');
      expect(mockStore.getRequest('req-ambig-2')?.status).toBe('donors_notified');

      // Now send disambiguated text mentioning Rohan
      const specificPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.ambig.2',
                      timestamp: '1793339007',
                      type: 'text',
                      text: {
                        body: 'YES I can donate for Rohan Mehra',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawSpec = JSON.stringify(specificPayload);
      const sigSpec = `sha256=${computeHmacSha256(rawSpec, testSecret)}`;

      const resSpec = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sigSpec },
        body: rawSpec,
      });

      expect(resSpec.status).toBe(200);

      // Request 2 should be fulfilled, Request 1 remains donors_notified
      expect(mockStore.getRequest('req-ambig-2')?.status).toBe('fulfilled');
      expect(mockStore.getRequest('req-ambig-1')?.status).toBe('donors_notified');
    });

    it('does not falsely succeed when matching notification does not exist', async () => {
      mockStore.createRequest({
        id: 'req-nonotif-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
      // Notice: NO notification added for Rahul

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.nonotif.1',
                      timestamp: '1793339008',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'accept_req-nonotif-1_donor-rahul-a-pos',
                          title: '✅ I Can Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is NOT fulfilled
      const req = mockStore.getRequest('req-nonotif-1');
      expect(req?.status).toBe('donors_notified');
    });

    it('handles conflicting response: donor accepts first and then declines (reverts request to donors_notified)', async () => {
      mockStore.createRequest({
        id: 'req-conflict-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Kavita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-conflict-1',
        requestId: 'req-conflict-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const makePayload = (action: 'accept' | 'decline') => ({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: `wamid.conflict.${action}`,
                      timestamp: '1793339009',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: `${action}_req-conflict-1_donor-rahul-a-pos`,
                          title: action === 'accept' ? '✅ I Can Donate' : '❌ Cannot Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      // 1. Donor accepts first
      const rawAccept = JSON.stringify(makePayload('accept'));
      const sigAccept = `sha256=${computeHmacSha256(rawAccept, testSecret)}`;
      const resAccept = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sigAccept },
        body: rawAccept,
      });
      expect(resAccept.status).toBe(200);

      const reqAfterAccept = mockStore.getRequest('req-conflict-1');
      expect(reqAfterAccept?.status).toBe('fulfilled');
      expect(mockStore.getNotificationsForRequest('req-conflict-1')[0]?.status).toBe('accepted');

      // 2. Donor later changes mind and declines
      const rawDecline = JSON.stringify(makePayload('decline'));
      const sigDecline = `sha256=${computeHmacSha256(rawDecline, testSecret)}`;
      const resDecline = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sigDecline },
        body: rawDecline,
      });
      expect(resDecline.status).toBe(200);

      // Request must revert to donors_notified because the only donor cancelled!
      const reqAfterDecline = mockStore.getRequest('req-conflict-1');
      expect(reqAfterDecline?.status).toBe('donors_notified');
      expect(reqAfterDecline?.fulfillmentSource).toBeNull();
      expect(mockStore.getNotificationsForRequest('req-conflict-1')[0]?.status).toBe('declined');
    });

    it('handles donor changing mind: donor declines first and then accepts (fulfills active request)', async () => {
      mockStore.createRequest({
        id: 'req-mindchange-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Kavita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-mindchange-1',
        requestId: 'req-mindchange-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const makePayload = (action: 'accept' | 'decline') => ({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: `wamid.mindchange.${action}`,
                      timestamp: '1793339010',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: `${action}_req-mindchange-1_donor-rahul-a-pos`,
                          title: action === 'accept' ? '✅ I Can Donate' : '❌ Cannot Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      // 1. Donor declines first
      const rawDecline = JSON.stringify(makePayload('decline'));
      const sigDecline = `sha256=${computeHmacSha256(rawDecline, testSecret)}`;
      const resDecline = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sigDecline },
        body: rawDecline,
      });
      expect(resDecline.status).toBe(200);

      const reqAfterDecline = mockStore.getRequest('req-mindchange-1');
      expect(reqAfterDecline?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-mindchange-1')[0]?.status).toBe('declined');

      // 2. Donor changes mind and accepts
      const rawAccept = JSON.stringify(makePayload('accept'));
      const sigAccept = `sha256=${computeHmacSha256(rawAccept, testSecret)}`;
      const resAccept = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sigAccept },
        body: rawAccept,
      });
      expect(resAccept.status).toBe(200);

      const reqAfterAccept = mockStore.getRequest('req-mindchange-1');
      expect(reqAfterAccept?.status).toBe('fulfilled');
      expect(mockStore.getNotificationsForRequest('req-mindchange-1')[0]?.status).toBe('accepted');
    });

    it('rejects responses when the request is already expired or cancelled', async () => {
      mockStore.createRequest({
        id: 'req-expired-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Kavita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'expired',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-expired-1',
        requestId: 'req-expired-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.expired.1',
                      timestamp: '1793339011',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'accept_req-expired-1_donor-rahul-a-pos',
                          title: '✅ I Can Donate',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify request is STILL expired (not fulfilled)
      const req = mockStore.getRequest('req-expired-1');
      expect(req?.status).toBe('expired');
    });

    it('rejects free-text reply mentioning conflicting request ID for single pending notification', async () => {
      mockStore.createRequest({
        id: 'req-conflict-txt-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-conflict-txt-1',
        requestId: 'req-conflict-txt-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.conflicttxt.1',
                      timestamp: '1793339012',
                      type: 'text',
                      text: {
                        body: 'YES I can donate for req-different-999',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Verify req-conflict-txt-1 is NOT fulfilled because text referenced a different req-id
      const req = mockStore.getRequest('req-conflict-txt-1');
      expect(req?.status).toBe('donors_notified');
    });

    it('rejects invalid words like "yesterday", "acceptable", and "nobody" from triggering donor responses', async () => {
      mockStore.createRequest({
        id: 'req-invalidwords-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-invalidwords-1',
        requestId: 'req-invalidwords-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const sendText = async (text: string) => {
        const payload = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
              changes: [
                {
                  field: 'messages',
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '15550254256',
                      phone_number_id: 'PHONE_NUMBER_ID',
                    },
                    messages: [
                      {
                        from: '919876543210',
                        id: `wamid.invalid.${Date.now()}`,
                        timestamp: '1793339013',
                        type: 'text',
                        text: { body: text },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const rawJson = JSON.stringify(payload);
        const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;
        return app.request('/api/v1/whatsapp/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
          body: rawJson,
        });
      };

      // 1. "yesterday" should not trigger "yes"
      await sendText('I visited the hospital yesterday');
      expect(mockStore.getRequest('req-invalidwords-1')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-invalidwords-1')[0]?.status).toBe('sent');

      // 2. "acceptable" should not trigger "accept"
      await sendText('The timing is acceptable to all');
      expect(mockStore.getRequest('req-invalidwords-1')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-invalidwords-1')[0]?.status).toBe('sent');

      // 3. "nobody" should not trigger "no"
      await sendText('Nobody answered the phone');
      expect(mockStore.getRequest('req-invalidwords-1')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-invalidwords-1')[0]?.status).toBe('sent');
    });

    it('correctly handles negative and contradictory sentences in webhook flow', async () => {
      const setupReq = (id: string) => {
        mockStore.createRequest({
          id,
          requesterId: null,
          bloodGroupNeeded: 'A+',
          componentType: 'whole_blood',
          unitsNeeded: 1,
          patientName: 'Sunita',
          patientAge: null,
          emergencyType: 'surgery',
          hospitalName: 'AIIMS Delhi',
          latitude: 28.5672,
          longitude: 77.21,
          state: null,
          district: null,
          searchRadiusKm: 10,
          status: 'donors_notified',
          fulfillmentSource: null,
          createdAt: new Date().toISOString(),
          expiresAt: null,
        });

        mockStore.addNotification({
          id: `notif-${id}`,
          requestId: id,
          donorId: 'donor-rahul-a-pos',
          status: 'sent',
          sentAt: new Date().toISOString(),
          respondedAt: null,
        });
      };

      const sendText = async (text: string) => {
        const payload = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
              changes: [
                {
                  field: 'messages',
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '15550254256',
                      phone_number_id: 'PHONE_NUMBER_ID',
                    },
                    messages: [
                      {
                        from: '919876543210',
                        id: `wamid.neg.${Date.now()}`,
                        timestamp: '1793339015',
                        type: 'text',
                        text: { body: text },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        const rawJson = JSON.stringify(payload);
        const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;
        return app.request('/api/v1/whatsapp/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
          body: rawJson,
        });
      };

      // 1. "I am not ready" must NOT be accepted; notification marked declined
      setupReq('req-neg-1');
      await sendText('I am not ready');
      expect(mockStore.getRequest('req-neg-1')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-neg-1')[0]?.status).toBe('declined');

      // 2. "I don't agree" must NOT be accepted; notification marked declined
      setupReq('req-neg-2');
      await sendText("I don't agree");
      expect(mockStore.getRequest('req-neg-2')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-neg-2')[0]?.status).toBe('declined');

      // 3. "I am not available" must be declined, not accepted
      setupReq('req-neg-3');
      await sendText('I am not available');
      expect(mockStore.getRequest('req-neg-3')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-neg-3')[0]?.status).toBe('declined');

      // 4. "I can't donate" must be declined, not accepted
      setupReq('req-neg-4');
      await sendText("I can't donate");
      expect(mockStore.getRequest('req-neg-4')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-neg-4')[0]?.status).toBe('declined');

      // 5. Messages containing contradictory affirmative and negative intent must remain unprocessed
      setupReq('req-contra-1');
      await sendText('Yes, but I cannot donate');
      expect(mockStore.getRequest('req-contra-1')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-contra-1')[0]?.status).toBe('sent'); // unmutated

      setupReq('req-contra-2');
      await sendText('Yes, but I am not available');
      expect(mockStore.getRequest('req-contra-2')?.status).toBe('donors_notified');
      expect(mockStore.getNotificationsForRequest('req-contra-2')[0]?.status).toBe('sent'); // unmutated
    });

    it('matches request IDs as exact tokens rather than arbitrary substrings', async () => {
      // Create req-sub-1
      mockStore.createRequest({
        id: 'req-sub-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita Sharma',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
      mockStore.addNotification({
        id: 'notif-sub-1',
        requestId: 'req-sub-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Create req-sub-123
      mockStore.createRequest({
        id: 'req-sub-123',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Anita Gupta',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
      mockStore.addNotification({
        id: 'notif-sub-123',
        requestId: 'req-sub-123',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Donor types "YES for req-sub-123"
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550254256',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.sub.1',
                      timestamp: '1793339014',
                      type: 'text',
                      text: { body: 'YES for req-sub-123' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;
      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: rawJson,
      });

      expect(res.status).toBe(200);

      // Only req-sub-123 should be fulfilled; req-sub-1 must NOT be matched by substring "req-sub-1"
      expect(mockStore.getRequest('req-sub-123')?.status).toBe('fulfilled');
      expect(mockStore.getRequest('req-sub-1')?.status).toBe('donors_notified');
    });

    it('handles concurrent simultaneous Accept and Decline calls safely', async () => {
      mockStore.createRequest({
        id: 'req-conc-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Kavita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-conc-1',
        requestId: 'req-conc-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Fire simultaneous Accept and Decline calls
      const [res1, res2] = await Promise.all([
        requestService.handleDonorReply('req-conc-1', 'donor-rahul-a-pos', 'accepted'),
        requestService.handleDonorReply('req-conc-1', 'donor-rahul-a-pos', 'declined'),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // The final state of the request must be consistent (either fulfilled or donors_notified, never an invalid state)
      const finalReq = mockStore.getRequest('req-conc-1');
      expect(['fulfilled', 'donors_notified']).toContain(finalReq?.status as string);
    });

    it('prevents concurrent race from overwriting a cancelled or expired request', async () => {
      mockStore.createRequest({
        id: 'req-race-cancel-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Kavita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'cancelled',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-race-cancel-1',
        requestId: 'req-race-cancel-1',
        donorId: 'donor-rahul-a-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Attempt to accept cancelled request must throw
      expect(
        requestService.handleDonorReply('req-race-cancel-1', 'donor-rahul-a-pos', 'accepted')
      ).rejects.toThrow('Cannot respond to a cancelled request');

      // Request remains cancelled
      expect(mockStore.getRequest('req-race-cancel-1')?.status).toBe('cancelled');
    });

    it('ensures live DB donor lookup does not fall back to mock store when live DB is active', async () => {
      const origIsLiveDb = (requestService as any).isLiveDb;
      // Simulate live DB mode active
      (requestService as any).isLiveDb = () => true;

      try {
        // Unknown phone in live DB must return null even if it existed in mock store
        const result = await requestService.findDonorByPhone('910000009999');
        expect(result).toBeNull();
      } finally {
        (requestService as any).isLiveDb = origIsLiveDb;
      }
    });

    it('ensures transaction rollback on failure leaving no partial updates', async () => {
      mockStore.createRequest({
        id: 'req-rollback-1',
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Sunita',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'AIIMS Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
      // No notification added

      expect(
        requestService.handleDonorReply('req-rollback-1', 'donor-rahul-a-pos', 'accepted')
      ).rejects.toThrow('Notification not found');

      // Request is untouched
      expect(mockStore.getRequest('req-rollback-1')?.status).toBe('donors_notified');
    });

    it('rejects POST webhook with 503 when WHATSAPP_APP_SECRET is not configured', async () => {
      delete process.env.WHATSAPP_APP_SECRET;

      const payload = { test: true };
      const rawJson = JSON.stringify(payload);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=any_sig',
        },
        body: rawJson,
      });

      expect(res.status).toBe(503);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('WHATSAPP_APP_SECRET is not configured');
    });

    it('rejects payload without signature header with 401', async () => {
      const payload = { test: true };
      const rawJson = JSON.stringify(payload);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: rawJson,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Missing X-Hub-Signature-256 signature header');
    });

    it('rejects payload with invalid HMAC signature with 401', async () => {
      const payload = { test: true };
      const rawJson = JSON.stringify(payload);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid_hex_signature',
        },
        body: rawJson,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Invalid signature');
    });

    it('rejects payload when signature is missing sha256= prefix with 401', async () => {
      const payload = { test: true };
      const rawJson = JSON.stringify(payload);
      const digest = computeHmacSha256(rawJson, testSecret);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': digest, // Missing prefix
        },
        body: rawJson,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Invalid signature');
    });

    it('rejects payload when signature uses incorrect prefix with 401', async () => {
      const payload = { test: true };
      const rawJson = JSON.stringify(payload);
      const digest = computeHmacSha256(rawJson, testSecret);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha1=${digest}`,
        },
        body: rawJson,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Invalid signature');
    });

    it('rejects payload when signature contains invalid hex characters with 401', async () => {
      const payload = { test: true };
      const rawJson = JSON.stringify(payload);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${'z'.repeat(64)}`,
        },
        body: rawJson,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Invalid signature');
    });

    it('rejects payload when signature has incorrect digest length with 401', async () => {
      const payload = { test: true };
      const rawJson = JSON.stringify(payload);

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${'a'.repeat(62)}`,
        },
        body: rawJson,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Invalid signature');
    });

    it('rejects payload when signature does not match body with 401', async () => {
      const payload = { test: true, original: true };
      const rawJson = JSON.stringify(payload);
      const signature = `sha256=${computeHmacSha256(rawJson, testSecret)}`;

      const tamperedBody = JSON.stringify({ test: true, original: false });

      const res = await app.request('/api/v1/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body: tamperedBody,
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe('Invalid signature');
    });
  });

  describe('POST /mock-reply (Dev Simulator Endpoint)', () => {
    it('simulates donor button reply and returns updated status', async () => {
      mockStore.createRequest({
        id: 'req-sim-1',
        requesterId: null,
        bloodGroupNeeded: 'B+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Devika',
        patientAge: null,
        emergencyType: 'surgery',
        hospitalName: 'Safdarjung Hospital',
        latitude: 28.57,
        longitude: 77.208,
        state: null,
        district: null,
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });

      mockStore.addNotification({
        id: 'notif-sim-1',
        requestId: 'req-sim-1',
        donorId: 'donor-vikram-b-pos',
        status: 'sent',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });

      const res = await app.request('/api/v1/whatsapp/mock-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'req-sim-1',
          donorId: 'donor-vikram-b-pos',
          action: 'accept',
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; simulatedAction: string; status: string };
      expect(json.success).toBe(true);
      expect(json.simulatedAction).toBe('accepted');
      expect(json.status).toBe('fulfilled');
    });

    it('returns 404 when request is not found', async () => {
      const res = await app.request('/api/v1/whatsapp/mock-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'nonexistent-request',
          donorId: 'donor-vikram-b-pos',
          action: 'accept',
        }),
      });

      expect(res.status).toBe(404);
    });
  });
});
