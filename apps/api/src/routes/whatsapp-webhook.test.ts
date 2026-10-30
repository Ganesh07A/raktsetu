import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '../index';
import { mockStore } from '../services/mock-store';
import { computeHmacSha256 } from './whatsapp-webhook';

describe('WhatsApp Webhook Routes (/api/v1/whatsapp)', () => {
  const testSecret = 'raktkhoj_app_secret_test_xyz';

  beforeEach(() => {
    mockStore.reset();
  });

  describe('GET /webhook (Hub Challenge Verification)', () => {
    it('verifies valid subscription challenge with 200 plain text', async () => {
      const res = await app.request(
        '/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=raktkhoj_webhook_test_token_2026&hub.challenge=test_meta_challenge_123'
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
        '/api/v1/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=raktkhoj_webhook_test_token_2026&hub.challenge=test_challenge'
      );

      expect(res.status).toBe(403);
    });
  });

  describe('POST /webhook (Meta Inbound Payload)', () => {
    it('processes interactive accept button reply and updates request status to fulfilled', async () => {
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
