import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { app } from '../index';
import { mockStore } from '../services/mock-store';
import { computeHmacSha256, verifyWhatsAppSignature } from './whatsapp-webhook';

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
