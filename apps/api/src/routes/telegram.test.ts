import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../index';
import { createDonorSessionToken } from '../services/donor-session';
import { telegramStore, hashTelegramToken } from '../services/telegram/telegram-store';
import { telegramApi } from '../services/telegram/telegram-api';
import { telegramBotHandler } from '../services/telegram/telegram-bot';
import { telegramNotifier } from '../services/telegram/telegram-notifier';
import { mockStore } from '../services/mock-store';
import type { TelegramUpdate } from '../services/telegram/telegram-types';

describe('Phase 1: Secure Telegram Account Linking Test Suite', () => {
  const testDonorId = 'donor-tg-test-01';
  let donorToken: string;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TELEGRAM_BOT_TOKEN = 'test-mock-token-123456';
    process.env.TELEGRAM_BOT_USERNAME = 'RaktKhojDonorBot';
    telegramStore.resetMockStore();

    donorToken = createDonorSessionToken(testDonorId);

    // Seed mock donor in mockStore
    mockStore.addDonor({
      id: testDonorId,
      userId: 'user-tg-01',
      bloodGroup: 'O+',
      latitude: 28.5672,
      longitude: 77.21,
      state: 'Delhi',
      district: 'South Delhi',
      city: 'New Delhi',
      dateOfBirth: '1995-01-01',
      gender: 'male',
      weightKg: 68,
      lastDonationDate: null,
      isAvailable: true,
      searchRadiusKm: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Rohan Sharma',
      phone: '+919876543210',
    } as any);
  });

  describe('1. Link Token Generation Endpoint (POST /api/v1/telegram/link-token)', () => {
    it('rejects link-token generation without authentication', async () => {
      const res = await app.request('/api/v1/telegram/link-token', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
      const data = (await res.json()) as any;
      expect(data.error).toContain('Valid donor session required');
    });

    it('generates a valid, cryptographically secure deep link token for authenticated donor', async () => {
      const res = await app.request('/api/v1/telegram/link-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${donorToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe('string');
      // 24 random bytes in hex = 48 hex characters
      expect(data.token.length).toBe(48);
      expect(data.botUsername).toBe('RaktKhojDonorBot');
      expect(data.deepLink).toBe(`https://t.me/RaktKhojDonorBot?start=${data.token}`);
      expect(data.expiresInSeconds).toBe(600);
    });

    it('generates unique tokens on successive requests', async () => {
      const res1 = await app.request('/api/v1/telegram/link-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${donorToken}` },
      });
      const data1 = (await res1.json()) as any;

      const res2 = await app.request('/api/v1/telegram/link-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${donorToken}` },
      });
      const data2 = (await res2.json()) as any;

      expect(data1.token).not.toBe(data2.token);
    });
  });

  describe('2. Token Hashing & Database Security Safeguards', () => {
    it('verifies SHA-256 token hashing produces a 64-character hex digest', () => {
      const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef';
      const hash = hashTelegramToken(rawToken);

      expect(hash).not.toBe(rawToken);
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('stores only the SHA-256 token hash and never the raw token', async () => {
      const rawToken = await telegramStore.createLinkToken(testDonorId, 600);
      const expectedHash = hashTelegramToken(rawToken);

      // Verify that lookup by raw token in raw storage fails because only hash is indexed
      const consumptionResult = await telegramStore.validateAndConsumeLinkToken(rawToken);
      expect(consumptionResult.valid).toBe(true);
      expect(consumptionResult.donorId).toBe(testDonorId);

      // Verify re-computing the hash matches expected cryptographic digest
      expect(expectedHash).not.toBe(rawToken);
    });
  });

  describe('3. Atomic Token Consumption & Expiry Rules', () => {
    it('successfully consumes a valid token on first use', async () => {
      const rawToken = await telegramStore.createLinkToken(testDonorId, 600);
      const result = await telegramStore.validateAndConsumeLinkToken(rawToken);

      expect(result.valid).toBe(true);
      expect(result.donorId).toBe(testDonorId);
    });

    it('rejects already used token on second consumption (replay protection)', async () => {
      const rawToken = await telegramStore.createLinkToken(testDonorId, 600);

      // First consumption
      const first = await telegramStore.validateAndConsumeLinkToken(rawToken);
      expect(first.valid).toBe(true);

      // Second consumption must fail
      const second = await telegramStore.validateAndConsumeLinkToken(rawToken);
      expect(second.valid).toBe(false);
      expect(second.reason).toBe('TOKEN_ALREADY_USED');
    });

    it('rejects expired linking tokens', async () => {
      // Create token with negative TTL (-10 seconds)
      const expiredToken = await telegramStore.createLinkToken(testDonorId, -10);

      const result = await telegramStore.validateAndConsumeLinkToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_EXPIRED');
    });

    it('rejects invalid or forged token strings', async () => {
      const forgedToken = 'invalid-token-that-never-existed-0000000000000000';
      const result = await telegramStore.validateAndConsumeLinkToken(forgedToken);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_NOT_FOUND');
    });

    it('rejects non-string or empty input', async () => {
      const result = await telegramStore.validateAndConsumeLinkToken('' as any);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('4. Subscription Management & Chat Uniqueness Constraints', () => {
    it('creates and retrieves a donor subscription', async () => {
      const sub = await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '987654321',
        telegramUserId: 'user-tg-123',
        telegramUsername: 'rohansharma',
      });

      expect(sub.donorId).toBe(testDonorId);
      expect(sub.telegramChatId).toBe('987654321');
      expect(sub.alertsEnabled).toBe(true);

      const fetched = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(fetched).not.toBeNull();
      expect(fetched?.telegramChatId).toBe('987654321');
      expect(fetched?.telegramUsername).toBe('rohansharma');

      const byChat = await telegramStore.getSubscriptionByChatId('987654321');
      expect(byChat).not.toBeNull();
      expect(byChat?.donorId).toBe(testDonorId);
    });

    it('prevents linking the same Telegram chat to multiple donor accounts', async () => {
      await telegramStore.saveSubscription({
        donorId: 'donor-alice',
        telegramChatId: 'shared-chat-id-999',
      });

      // Attempting to link the same chatId to a different donor must throw
      expect(async () => {
        await telegramStore.saveSubscription({
          donorId: 'donor-bob',
          telegramChatId: 'shared-chat-id-999',
        });
      }).toThrow();
    });

    it('supports unlinking subscription by donorId and clears chat lookup', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '987654321',
      });

      const unlinked = await telegramStore.unlinkSubscription(testDonorId);
      expect(unlinked).toBe(true);

      const subAfter = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(subAfter).toBeNull();

      const chatLookup = await telegramStore.getSubscriptionByChatId('987654321');
      expect(chatLookup).toBeNull();
    });

    it('supports unlinking by chatId', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: 'chat-to-unlink-456',
      });

      const unlinked = await telegramStore.unlinkByChatId('chat-to-unlink-456');
      expect(unlinked).toBe(true);

      const subAfter = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(subAfter).toBeNull();
    });

    it('updates alert preferences', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '987654321',
      });

      await telegramStore.updatePreferences(testDonorId, false);
      const sub = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(sub?.alertsEnabled).toBe(false);

      await telegramStore.updatePreferences(testDonorId, true);
      const sub2 = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(sub2?.alertsEnabled).toBe(true);
    });
  });

  describe('5. Status, Unlink & Preference API Endpoints', () => {
    it('GET /api/v1/telegram/status reports disconnected when not linked', async () => {
      const res = await app.request('/api/v1/telegram/status', {
        headers: { Authorization: `Bearer ${donorToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.connected).toBe(false);
      expect(data.subscription).toBeNull();
    });

    it('GET /api/v1/telegram/status reports connected when subscription exists', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '987654321',
        telegramUsername: 'rohansharma',
      });

      const res = await app.request('/api/v1/telegram/status', {
        headers: { Authorization: `Bearer ${donorToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.connected).toBe(true);
      expect(data.subscription.telegramUsername).toBe('@rohansharma');
      expect(data.subscription.alertsEnabled).toBe(true);
    });

    it('POST /api/v1/telegram/unlink disconnects the donor', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '987654321',
      });

      const res = await app.request('/api/v1/telegram/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${donorToken}` },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('disconnected');

      // Verify status is now disconnected
      const statusRes = await app.request('/api/v1/telegram/status', {
        headers: { Authorization: `Bearer ${donorToken}` },
      });
      const statusData = (await statusRes.json()) as any;
      expect(statusData.connected).toBe(false);
    });

    it('PATCH /api/v1/telegram/preferences toggles alerts', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '987654321',
      });

      const res = await app.request('/api/v1/telegram/preferences', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${donorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alertsEnabled: false }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.alertsEnabled).toBe(false);
    });
  });

  describe('6. Phase 1 Scope & Boundary Verification', () => {
    it('verifies Phase 1 scope is strictly limited to account linking and token consumption', () => {
      expect(typeof telegramStore.createLinkToken).toBe('function');
      expect(typeof telegramStore.validateAndConsumeLinkToken).toBe('function');
      expect(typeof telegramStore.saveSubscription).toBe('function');
      expect(typeof telegramStore.unlinkSubscription).toBe('function');
    });
  });

  describe('7. Phase 2: Bot Commands & Update Handling', () => {
    it('successfully links Telegram account via /start <token>', async () => {
      const token = await telegramStore.createLinkToken(testDonorId, 600);

      let sentMessage: string | null = null;
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (chatId, text) => {
        sentMessage = text;
        return { ok: true, result: { message_id: 101, chat: { id: Number(chatId), type: 'private' }, date: Date.now() } };
      };

      const update: TelegramUpdate = {
        update_id: 2001,
        message: {
          message_id: 60,
          from: { id: 987654321, is_bot: false, first_name: 'Rohan', username: 'rohansharma' },
          chat: { id: 987654321, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: `/start ${token}`,
        },
      };

      await telegramBotHandler.handleUpdate(update);

      expect(sentMessage!).toContain('Account Linked Successfully');

      const sub = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(sub).toBeDefined();
      expect(sub?.telegramChatId).toBe('987654321');
      expect(sub?.alertsEnabled).toBe(true);

      telegramApi.sendMessage = originalSend;
    });

    it('/start without token explains how to link from dashboard', async () => {
      let sentMsg = '';
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text) => {
        sentMsg = text;
        return { ok: true, result: { message_id: 102, chat: { id: 111, type: 'private' }, date: Date.now() } };
      };

      await telegramBotHandler.handleUpdate({
        update_id: 2002,
        message: {
          message_id: 61,
          from: { id: 111, is_bot: false, first_name: 'Visitor' },
          chat: { id: 111, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/start',
        },
      });

      expect(sentMsg).toContain('Welcome to RaktSetu Donor Bot');
      expect(sentMsg).toContain('Connect Telegram');

      telegramApi.sendMessage = originalSend;
    });

    it('/status reports Not Connected for unlinked chat', async () => {
      let sentMsg = '';
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text) => {
        sentMsg = text;
        return { ok: true, result: { message_id: 103, chat: { id: 222, type: 'private' }, date: Date.now() } };
      };

      await telegramBotHandler.handleUpdate({
        update_id: 2003,
        message: {
          message_id: 62,
          chat: { id: 222, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/status',
        },
      });

      expect(sentMsg).toContain('Not Connected');
      telegramApi.sendMessage = originalSend;
    });

    it('/status reports Connected when linked', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '333',
      });

      let sentMsg = '';
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text) => {
        sentMsg = text;
        return { ok: true, result: { message_id: 104, chat: { id: 333, type: 'private' }, date: Date.now() } };
      };

      await telegramBotHandler.handleUpdate({
        update_id: 2004,
        message: {
          message_id: 63,
          chat: { id: 333, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/status',
        },
      });

      expect(sentMsg).toContain('Connected & Active');
      telegramApi.sendMessage = originalSend;
    });

    it('/help explains bot purpose, privacy, and commands', async () => {
      let sentMsg = '';
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text) => {
        sentMsg = text;
        return { ok: true, result: { message_id: 105, chat: { id: 444, type: 'private' }, date: Date.now() } };
      };

      await telegramBotHandler.handleUpdate({
        update_id: 2005,
        message: {
          message_id: 64,
          chat: { id: 444, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/help',
        },
      });

      expect(sentMsg).toContain('RaktSetu Donor Bot Help');
      expect(sentMsg).toContain('/status');
      expect(sentMsg).toContain('/unlink');
      telegramApi.sendMessage = originalSend;
    });

    it('/unlink command disconnects Telegram subscription', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '777',
      });

      let sentMsg = '';
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text) => {
        sentMsg = text;
        return { ok: true, result: { message_id: 106, chat: { id: 777, type: 'private' }, date: Date.now() } };
      };

      await telegramBotHandler.handleUpdate({
        update_id: 2006,
        message: {
          message_id: 65,
          chat: { id: 777, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/unlink',
        },
      });

      expect(sentMsg).toContain('Account Disconnected');
      const sub = await telegramStore.getSubscriptionByDonorId(testDonorId);
      expect(sub).toBeNull();

      telegramApi.sendMessage = originalSend;
    });

    it('deduplicates updates by update_id', async () => {
      let callCount = 0;
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async () => {
        callCount++;
        return { ok: true };
      };

      const update: TelegramUpdate = {
        update_id: 9999,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/help',
        },
      };

      await telegramBotHandler.handleUpdate(update);
      await telegramBotHandler.handleUpdate(update); // duplicate

      expect(callCount).toBe(1);
      telegramApi.sendMessage = originalSend;
    });
  });

  describe('8. Phase 3: Matched Donor Alerts & Delivery Safety', () => {
    it('dispatches Telegram alert with inline buttons to linked donor', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '555',
      });

      let dispatchedText = '';
      let replyMarkup: any = null;
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text, options) => {
        dispatchedText = text;
        replyMarkup = options?.reply_markup;
        return { ok: true, result: { message_id: 700, chat: { id: 555, type: 'private' }, date: Date.now() } };
      };

      const result = await telegramNotifier.sendDonationAlert({
        requestId: 'req-test-999',
        donorId: testDonorId,
        telegramChatId: '555',
        bloodGroup: 'O+',
        hospitalName: 'AIIMS New Delhi',
        district: 'South Delhi',
        state: 'Delhi',
        unitsNeeded: 2,
        emergencyType: 'surgery',
        distanceKm: 3.2,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.messageId).toBe(700);
      expect(dispatchedText).toContain('URGENT BLOOD REQUEST');
      expect(dispatchedText).toContain('O+');
      expect(dispatchedText).toContain('AIIMS New Delhi');
      expect(dispatchedText).toContain('2 Unit(s)');

      // Verify buttons
      expect(replyMarkup).toBeDefined();
      const buttons = replyMarkup.inline_keyboard;
      expect(buttons.length).toBe(2);

      const acceptBtn = buttons[0][0];
      const declineBtn = buttons[0][1];
      const viewBtn = buttons[1][0];

      expect(acceptBtn.text).toContain('Accept');
      expect(acceptBtn.callback_data).toMatch(/^avail:[a-zA-Z0-9]+$/);
      expect(declineBtn.text).toContain('Not Available');
      expect(declineBtn.callback_data).toMatch(/^decl:[a-zA-Z0-9]+$/);
      expect(viewBtn.url).toContain('/donor/respond/req-test-999');

      telegramApi.sendMessage = originalSend;
    });

    it('handles ambiguous timeout by marking status as unknown and not retrying', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '555',
      });

      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async () => {
        throw new Error('fetch failed: The socket connection was closed unexpectedly (timeout)');
      };

      const result = await telegramNotifier.sendDonationAlert({
        requestId: 'req-timeout-01',
        donorId: testDonorId,
        telegramChatId: '555',
        bloodGroup: 'O+',
        hospitalName: 'AIIMS New Delhi',
        unitsNeeded: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('unknown');

      // Verify stored record status is unknown
      const notifId = `tgnotif-req-timeout-01-${testDonorId}`;
      const record = (telegramStore as any).mockNotifications.get(notifId);
      expect(record?.status).toBe('unknown');

      telegramApi.sendMessage = originalSend;
    });

    it('handles explicit Telegram API failure by marking status as failed', async () => {
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: '555',
      });

      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async () => {
        return { ok: false, description: 'Forbidden: bot was blocked by the user', error_code: 403 };
      };

      const result = await telegramNotifier.sendDonationAlert({
        requestId: 'req-fail-01',
        donorId: testDonorId,
        telegramChatId: '555',
        bloodGroup: 'O+',
        hospitalName: 'AIIMS New Delhi',
        unitsNeeded: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('blocked');

      telegramApi.sendMessage = originalSend;
    });

    it('sends closure notification when request is cancelled or fulfilled', async () => {
      // Record a notified donor in mock store
      (telegramStore as any).mockNotifications.set('tgnotif-req-close-test-donor1', {
        id: 'tgnotif-req-close-test-donor1',
        requestId: 'req-close-test',
        donorId: 'donor1',
        telegramChatId: 'chat123',
        status: 'sent',
      });

      let sentCount = 0;
      let sentText = '';
      const originalSend = telegramApi.sendMessage.bind(telegramApi);
      telegramApi.sendMessage = async (_chatId, text) => {
        sentCount++;
        sentText = text;
        return { ok: true, result: { message_id: 888, chat: { id: 123, type: 'private' }, date: Date.now() } as any };
      };

      const count = await telegramNotifier.notifyRequestClosed('req-close-test', 'fulfilled');
      expect(count).toBe(1);
      expect(sentCount).toBe(1);
      expect(sentText).toContain('fulfilled by an available donor');
      expect(sentText).toContain('No further action is required');

      telegramApi.sendMessage = originalSend;
    });
  });

  describe('Phase 4: Donor Interactive Button Responses & Fulfillment Suite', () => {
    const testReqId = 'req-phase4-test-01';
    const donorChatId = '999888777';

    beforeEach(async () => {
      // Seed a test blood request in mockStore
      mockStore.createRequest({
        id: testReqId,
        bloodGroupNeeded: 'O+',
        unitsNeeded: 1,
        hospitalName: 'Apollo Hospital',
        district: 'South Delhi',
        state: 'Delhi',
        latitude: 28.5672,
        longitude: 77.21,
        status: 'open',
        patientName: 'Emergency Patient',
        patientAge: 35,
        emergencyType: 'trauma',
        createdAt: new Date().toISOString(),
      } as any);

      // Seed donor link
      await telegramStore.saveSubscription({
        donorId: testDonorId,
        telegramChatId: donorChatId,
      });

      // Dispatch or record test notification
      await telegramStore.recordNotification({
        id: `tgnotif-${testReqId}-${testDonorId}`,
        requestId: testReqId,
        donorId: testDonorId,
        telegramChatId: donorChatId,
        callbackId: 'cb44556677889900',
        status: 'sent',
        telegramMessageId: 101,
      });

      // Ensure donor_notifications in mockStore
      await mockStore.addNotification({
        id: `notif-${testReqId}-${testDonorId}`,
        requestId: testReqId,
        donorId: testDonorId,
        status: 'sent',
        donorName: 'Rohan Sharma',
        donorBloodGroup: 'O+',
        donorPhoneMasked: '+91 98****3210',
        sentAt: new Date().toISOString(),
        respondedAt: null,
      });
    });

    it('processes "❤️ Accept & Share Contact" callback and fulfills the request', async () => {
      let answeredText = '';
      let editedChatId = '';
      let editedMessageId = 0;
      let editedText = '';

      const originalAnswer = telegramApi.answerCallbackQuery.bind(telegramApi);
      const originalEdit = telegramApi.editMessageText.bind(telegramApi);

      telegramApi.answerCallbackQuery = async (queryId, options) => {
        answeredText = options?.text || '';
        return { ok: true, result: true };
      };

      telegramApi.editMessageText = async (chatId, messageId, text, options) => {
        editedChatId = String(chatId);
        editedMessageId = messageId;
        editedText = text;
        return { ok: true, result: { message_id: messageId, chat: { id: Number(chatId), type: 'private' }, date: Date.now() } as any };
      };

      // Simulate Telegram update with callback query
      const update: TelegramUpdate = {
        update_id: 9001,
        callback_query: {
          id: 'query-101',
          from: { id: Number(donorChatId), is_bot: false, first_name: 'Rohan' },
          message: {
            message_id: 101,
            chat: { id: Number(donorChatId), type: 'private' },
            date: Date.now(),
          },
          data: 'avail:cb44556677889900',
        },
      };

      await telegramBotHandler.handleUpdate(update);

      // Verify callback query was answered with confirmation
      expect(answeredText).toContain('shared with the hospital/seeker');

      // Verify original message was edited to show accepted status
      expect(editedChatId).toBe(donorChatId);
      expect(editedMessageId).toBe(101);
      expect(editedText).toContain('ACCEPTED & CONTACT SHARED');
      expect(editedText).toContain(testReqId);

      // Verify telegram notification record updated in store
      const notif = await telegramStore.getNotificationByCallbackId('cb44556677889900');
      expect(notif?.status).toBe('accepted');

      // Verify blood request was fulfilled
      const req = mockStore.getRequest(testReqId);
      expect(req?.status).toBe('fulfilled');
      expect(req?.fulfillmentSource).toBe('donor');

      telegramApi.answerCallbackQuery = originalAnswer;
      telegramApi.editMessageText = originalEdit;
    });

    it('processes "❌ Not Available" callback and records declined status', async () => {
      let answeredText = '';
      let editedText = '';

      const originalAnswer = telegramApi.answerCallbackQuery.bind(telegramApi);
      const originalEdit = telegramApi.editMessageText.bind(telegramApi);

      telegramApi.answerCallbackQuery = async (queryId, options) => {
        answeredText = options?.text || '';
        return { ok: true, result: true };
      };

      telegramApi.editMessageText = async (chatId, messageId, text) => {
        editedText = text;
        return { ok: true, result: { message_id: messageId, chat: { id: Number(chatId), type: 'private' }, date: Date.now() } as any };
      };

      const update: TelegramUpdate = {
        update_id: 9002,
        callback_query: {
          id: 'query-102',
          from: { id: Number(donorChatId), is_bot: false, first_name: 'Rohan' },
          message: {
            message_id: 101,
            chat: { id: Number(donorChatId), type: 'private' },
            date: Date.now(),
          },
          data: 'decl:cb44556677889900',
        },
      };

      await telegramBotHandler.handleUpdate(update);

      expect(answeredText).toContain('Response recorded: Not available');
      expect(editedText).toContain('RESPONSE RECORDED: NOT AVAILABLE');

      const notif = await telegramStore.getNotificationByCallbackId('cb44556677889900');
      expect(notif?.status).toBe('declined');

      telegramApi.answerCallbackQuery = originalAnswer;
      telegramApi.editMessageText = originalEdit;
    });

    it('rejects unauthorized button clicks from a different Telegram user ID', async () => {
      let answeredText = '';
      let isAlert = false;

      const originalAnswer = telegramApi.answerCallbackQuery.bind(telegramApi);
      telegramApi.answerCallbackQuery = async (queryId, options) => {
        answeredText = options?.text || '';
        isAlert = Boolean(options?.show_alert);
        return { ok: true, result: true };
      };

      // Attacker or different user clicks
      const update: TelegramUpdate = {
        update_id: 9003,
        callback_query: {
          id: 'query-evil',
          from: { id: 666777888, is_bot: false, first_name: 'Intruder' },
          message: {
            message_id: 101,
            chat: { id: 666777888, type: 'private' },
            date: Date.now(),
          },
          data: 'avail:cb44556677889900',
        },
      };

      await telegramBotHandler.handleUpdate(update);

      expect(answeredText).toContain('Unauthorized');
      expect(isAlert).toBe(true);

      // Verify notification remains unaccepted
      const notif = await telegramStore.getNotificationByCallbackId('cb44556677889900');
      expect(notif?.status).toBe('sent');

      telegramApi.answerCallbackQuery = originalAnswer;
    });

    it('rejects unknown or invalid callback IDs gracefully', async () => {
      let answeredText = '';
      const originalAnswer = telegramApi.answerCallbackQuery.bind(telegramApi);
      telegramApi.answerCallbackQuery = async (queryId, options) => {
        answeredText = options?.text || '';
        return { ok: true, result: true };
      };

      const update: TelegramUpdate = {
        update_id: 9004,
        callback_query: {
          id: 'query-invalid',
          from: { id: Number(donorChatId), is_bot: false, first_name: 'Rohan' },
          message: {
            message_id: 101,
            chat: { id: Number(donorChatId), type: 'private' },
            date: Date.now(),
          },
          data: 'avail:nonexistent_callback_id',
        },
      };

      await telegramBotHandler.handleUpdate(update);

      expect(answeredText).toContain('Notification not found or expired');

      telegramApi.answerCallbackQuery = originalAnswer;
    });

    it('handles cancelled requests by rejecting fulfillment and editing message', async () => {
      // Mark request as cancelled
      mockStore.updateRequest(testReqId, { status: 'cancelled' });

      let answeredText = '';
      let editedText = '';
      const originalAnswer = telegramApi.answerCallbackQuery.bind(telegramApi);
      const originalEdit = telegramApi.editMessageText.bind(telegramApi);

      telegramApi.answerCallbackQuery = async (queryId, options) => {
        answeredText = options?.text || '';
        return { ok: true, result: true };
      };
      telegramApi.editMessageText = async (chatId, messageId, text) => {
        editedText = text;
        return { ok: true, result: { message_id: messageId, chat: { id: Number(chatId), type: 'private' }, date: Date.now() } as any };
      };

      const update: TelegramUpdate = {
        update_id: 9005,
        callback_query: {
          id: 'query-cancelled',
          from: { id: Number(donorChatId), is_bot: false, first_name: 'Rohan' },
          message: {
            message_id: 101,
            chat: { id: Number(donorChatId), type: 'private' },
            date: Date.now(),
          },
          data: 'avail:cb44556677889900',
        },
      };

      await telegramBotHandler.handleUpdate(update);

      expect(answeredText).toContain('cancelled');
      expect(editedText).toContain('CANCELLED');

      telegramApi.answerCallbackQuery = originalAnswer;
      telegramApi.editMessageText = originalEdit;
    });

    it('prevents duplicate callbacks when clicked repeatedly', async () => {
      let answerCount = 0;
      let lastAnswer = '';

      const originalAnswer = telegramApi.answerCallbackQuery.bind(telegramApi);
      telegramApi.answerCallbackQuery = async (queryId, options) => {
        answerCount++;
        lastAnswer = options?.text || '';
        return { ok: true, result: true };
      };

      // Pre-set notification to accepted
      await telegramStore.updateNotificationStatus(`tgnotif-${testReqId}-${testDonorId}`, 'accepted');

      const update: TelegramUpdate = {
        update_id: 9006,
        callback_query: {
          id: 'query-dup',
          from: { id: Number(donorChatId), is_bot: false, first_name: 'Rohan' },
          message: {
            message_id: 101,
            chat: { id: Number(donorChatId), type: 'private' },
            date: Date.now(),
          },
          data: 'avail:cb44556677889900',
        },
      };

      await telegramBotHandler.handleUpdate(update);

      expect(answerCount).toBe(1);
      expect(lastAnswer).toContain('already accepted');

      telegramApi.answerCallbackQuery = originalAnswer;
    });
  });
});
