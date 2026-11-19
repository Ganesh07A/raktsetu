import {
  db,
  donorTelegramSubscriptions,
  telegramLinkTokens,
  telegramNotifications,
  eq,
  and,
} from '@repo/db';
import crypto from 'node:crypto';
import type { TelegramSubscriptionInfo } from './telegram-types';

/**
 * Hash raw deep-link tokens with SHA-256 before persisting or querying.
 * Ensures plaintext tokens are never stored in the database.
 */
export function hashTelegramToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

export interface TelegramNotificationRecord {
  id: string;
  requestId: string;
  donorId: string;
  telegramChatId: string;
  telegramMessageId?: number | null;
  callbackId: string;
  status: 'pending' | 'sending' | 'sent' | 'unknown' | 'delivered' | 'failed' | 'accepted' | 'declined' | 'cancelled';
  errorMessage?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
}

export class TelegramStore {
  // In-memory fallbacks for unit tests, offline development, and mock mode
  private mockSubscriptions = new Map<string, TelegramSubscriptionInfo>(); // donorId -> sub
  private mockChatToDonor = new Map<string, string>(); // chatId -> donorId
  private mockLinkTokens = new Map<
    string,
    { donorId: string; expiresAt: Date; consumedAt: Date | null }
  >();
  private mockNotifications = new Map<string, TelegramNotificationRecord>(); // id -> notif
  private mockCallbackToNotif = new Map<string, string>(); // callbackId -> notifId
  private processedUpdates = new Set<number>();

  public hasMockSubscription(donorId: string): boolean {
    const sub = this.mockSubscriptions.get(donorId);
    return Boolean(sub && !sub.unlinkedAt && sub.alertsEnabled);
  }

  public isLiveDb(): boolean {
    if (Boolean(process.env.TEST_RUNNER || process.env.BUN_TEST || process.env.NODE_ENV === 'test')) {
      return Boolean(process.env.TEST_LIVE_DB === 'true' && process.env.DATABASE_URL);
    }
    return Boolean(
      process.env.DATABASE_URL &&
      db &&
      process.env.MOCK_SERVICES !== 'true'
    );
  }

  /**
   * Create a single-use, cryptographically secure linking token.
   * Security: The database stores SHA-256 tokenHash, while the raw token is returned to the user for the deep link.
   */
  public async createLinkToken(donorId: string, ttlSeconds: number = 600): Promise<string> {
    const rawBytes = new Uint8Array(24);
    crypto.getRandomValues(rawBytes);
    // URL-safe hex string without padding
    const rawToken = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const tokenHash = hashTelegramToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    if (this.isLiveDb()) {
      await db.insert(telegramLinkTokens).values({
        tokenHash,
        donorId,
        expiresAt,
      });
    } else {
      this.mockLinkTokens.set(tokenHash, { donorId, expiresAt, consumedAt: null });
    }

    return rawToken;
  }

  /**
   * Validate and atomically consume a linking token.
   * Security: Recomputes the SHA-256 hash of incoming rawToken and verifies against tokenHash.
   * Rejects expired, consumed, or nonexistent tokens.
   */
  public async validateAndConsumeLinkToken(
    rawToken: string
  ): Promise<{ valid: boolean; donorId?: string; reason?: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, reason: 'INVALID_TOKEN_FORMAT' };
    }

    const tokenHash = hashTelegramToken(rawToken);

    if (this.isLiveDb()) {
      return await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(telegramLinkTokens)
          .where(eq(telegramLinkTokens.tokenHash, tokenHash))
          .for('update')
          .limit(1);

        const record = rows[0];
        if (!record) {
          return { valid: false, reason: 'TOKEN_NOT_FOUND' };
        }

        if (record.consumedAt) {
          return { valid: false, reason: 'TOKEN_ALREADY_USED' };
        }

        if (new Date() > new Date(record.expiresAt)) {
          return { valid: false, reason: 'TOKEN_EXPIRED' };
        }

        await tx
          .update(telegramLinkTokens)
          .set({ consumedAt: new Date() })
          .where(eq(telegramLinkTokens.tokenHash, tokenHash));

        return { valid: true, donorId: record.donorId };
      });
    }

    // In-memory fallback
    const record = this.mockLinkTokens.get(tokenHash);
    if (!record) {
      return { valid: false, reason: 'TOKEN_NOT_FOUND' };
    }
    if (record.consumedAt) {
      return { valid: false, reason: 'TOKEN_ALREADY_USED' };
    }
    if (new Date() > record.expiresAt) {
      return { valid: false, reason: 'TOKEN_EXPIRED' };
    }

    record.consumedAt = new Date();
    return { valid: true, donorId: record.donorId };
  }

  /**
   * Save or update a donor's Telegram link
   */
  public async saveSubscription(params: {
    donorId: string;
    telegramChatId: string;
    telegramUserId?: string | null;
    telegramUsername?: string | null;
  }): Promise<TelegramSubscriptionInfo> {
    const { donorId, telegramChatId, telegramUserId = null, telegramUsername = null } = params;
    const now = new Date();

    if (this.isLiveDb()) {
      // Check if chat is already linked to another active donor
      const existingWithChat = await db
        .select()
        .from(donorTelegramSubscriptions)
        .where(
          and(
            eq(donorTelegramSubscriptions.telegramChatId, telegramChatId),
            eq(donorTelegramSubscriptions.alertsEnabled, true)
          )
        )
        .limit(1);

      if (existingWithChat[0] && existingWithChat[0].donorId !== donorId) {
        throw new Error('TELEGRAM_CHAT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
      }

      await db
        .insert(donorTelegramSubscriptions)
        .values({
          id: `tgsub-${donorId}`,
          donorId,
          telegramChatId,
          telegramUserId,
          telegramUsername,
          alertsEnabled: true,
          linkedAt: now,
          unlinkedAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: donorTelegramSubscriptions.donorId,
          set: {
            telegramChatId,
            telegramUserId,
            telegramUsername,
            alertsEnabled: true,
            unlinkedAt: null,
            updatedAt: now,
          },
        });

      return {
        id: `tgsub-${donorId}`,
        donorId,
        telegramChatId,
        telegramUserId,
        telegramUsername,
        alertsEnabled: true,
        linkedAt: now.toISOString(),
        unlinkedAt: null,
      };
    }

    // In-memory fallback
    const existingDonorId = this.mockChatToDonor.get(telegramChatId);
    if (existingDonorId && existingDonorId !== donorId) {
      const existingSub = this.mockSubscriptions.get(existingDonorId);
      if (existingSub && !existingSub.unlinkedAt && existingSub.alertsEnabled) {
        throw new Error('TELEGRAM_CHAT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
      }
    }

    const sub: TelegramSubscriptionInfo = {
      id: `tgsub-${donorId}`,
      donorId,
      telegramChatId,
      telegramUserId,
      telegramUsername,
      alertsEnabled: true,
      linkedAt: now.toISOString(),
      unlinkedAt: null,
    };

    this.mockSubscriptions.set(donorId, sub);
    this.mockChatToDonor.set(telegramChatId, donorId);
    return sub;
  }

  /**
   * Get subscription by donorId
   */
  public async getSubscriptionByDonorId(donorId: string): Promise<TelegramSubscriptionInfo | null> {
    if (this.isLiveDb()) {
      const rows = await db
        .select()
        .from(donorTelegramSubscriptions)
        .where(eq(donorTelegramSubscriptions.donorId, donorId))
        .limit(1);

      const r = rows[0];
      if (!r || r.unlinkedAt) return null;
      return {
        id: r.id,
        donorId: r.donorId,
        telegramChatId: r.telegramChatId,
        telegramUserId: r.telegramUserId,
        telegramUsername: r.telegramUsername,
        alertsEnabled: r.alertsEnabled,
        linkedAt: r.linkedAt.toISOString(),
        unlinkedAt: null,
      };
    }

    const sub = this.mockSubscriptions.get(donorId);
    return sub && !sub.unlinkedAt ? sub : null;
  }

  /**
   * Get subscription by telegramChatId
   */
  public async getSubscriptionByChatId(chatId: string): Promise<TelegramSubscriptionInfo | null> {
    if (this.isLiveDb()) {
      const rows = await db
        .select()
        .from(donorTelegramSubscriptions)
        .where(eq(donorTelegramSubscriptions.telegramChatId, chatId))
        .limit(1);

      const r = rows[0];
      if (!r || r.unlinkedAt) return null;
      return {
        id: r.id,
        donorId: r.donorId,
        telegramChatId: r.telegramChatId,
        telegramUserId: r.telegramUserId,
        telegramUsername: r.telegramUsername,
        alertsEnabled: r.alertsEnabled,
        linkedAt: r.linkedAt.toISOString(),
        unlinkedAt: null,
      };
    }

    const donorId = this.mockChatToDonor.get(chatId);
    if (!donorId) return null;
    const sub = this.mockSubscriptions.get(donorId);
    return sub && !sub.unlinkedAt ? sub : null;
  }

  /**
   * Unlink Telegram from donor account
   */
  public async unlinkSubscription(donorId: string): Promise<boolean> {
    const now = new Date();
    if (this.isLiveDb()) {
      const rows = await db
        .update(donorTelegramSubscriptions)
        .set({
          alertsEnabled: false,
          unlinkedAt: now,
          updatedAt: now,
        })
        .where(eq(donorTelegramSubscriptions.donorId, donorId))
        .returning({ id: donorTelegramSubscriptions.id });

      return rows.length > 0;
    }

    const sub = this.mockSubscriptions.get(donorId);
    if (!sub) return false;
    sub.alertsEnabled = false;
    sub.unlinkedAt = now.toISOString();
    this.mockChatToDonor.delete(sub.telegramChatId);
    return true;
  }

  /**
   * Unlink by Telegram chat ID
   */
  public async unlinkByChatId(chatId: string): Promise<boolean> {
    const sub = await this.getSubscriptionByChatId(chatId);
    if (!sub) return false;
    return this.unlinkSubscription(sub.donorId);
  }

  /**
   * Update notification preferences
   */
  public async updatePreferences(donorId: string, alertsEnabled: boolean): Promise<boolean> {
    if (this.isLiveDb()) {
      const rows = await db
        .update(donorTelegramSubscriptions)
        .set({
          alertsEnabled,
          updatedAt: new Date(),
        })
        .where(eq(donorTelegramSubscriptions.donorId, donorId))
        .returning({ id: donorTelegramSubscriptions.id });

      return rows.length > 0;
    }

    const sub = this.mockSubscriptions.get(donorId);
    if (!sub) return false;
    sub.alertsEnabled = alertsEnabled;
    return true;
  }

  /**
   * Record a dispatched Telegram notification
   */
  public async recordNotification(record: TelegramNotificationRecord): Promise<void> {
    if (this.isLiveDb()) {
      await db
        .insert(telegramNotifications)
        .values({
          id: record.id,
          requestId: record.requestId,
          donorId: record.donorId,
          telegramChatId: record.telegramChatId,
          telegramMessageId: record.telegramMessageId ?? null,
          callbackId: record.callbackId,
          status: record.status,
          errorMessage: record.errorMessage ?? null,
          sentAt: record.sentAt ? new Date(record.sentAt) : new Date(),
        })
        .onConflictDoNothing();
    } else {
      this.mockNotifications.set(record.id, record);
      this.mockCallbackToNotif.set(record.callbackId, record.id);
    }
  }

  /**
   * Find notification by compact callback ID (used by button click handlers)
   */
  public async getNotificationByCallbackId(
    callbackId: string
  ): Promise<TelegramNotificationRecord | null> {
    if (this.isLiveDb()) {
      const rows = await db
        .select()
        .from(telegramNotifications)
        .where(eq(telegramNotifications.callbackId, callbackId))
        .limit(1);

      const r = rows[0];
      if (!r) return null;
      return {
        id: r.id,
        requestId: r.requestId,
        donorId: r.donorId,
        telegramChatId: r.telegramChatId,
        telegramMessageId: r.telegramMessageId,
        callbackId: r.callbackId,
        status: r.status as TelegramNotificationRecord['status'],
        errorMessage: r.errorMessage,
        sentAt: r.sentAt?.toISOString() ?? null,
        respondedAt: r.respondedAt?.toISOString() ?? null,
      };
    }

    const notifId = this.mockCallbackToNotif.get(callbackId);
    if (!notifId) return null;
    return this.mockNotifications.get(notifId) ?? null;
  }

  /**
   * Update notification status (sending / sent / unknown / failed / accepted / declined / cancelled)
   */
  public async updateNotificationStatus(
    id: string,
    status: TelegramNotificationRecord['status'],
    messageId?: number | null,
    errorMessage?: string | null
  ): Promise<void> {
    const now = new Date();
    if (this.isLiveDb()) {
      await db
        .update(telegramNotifications)
        .set({
          status,
          ...(messageId ? { telegramMessageId: messageId } : {}),
          ...(errorMessage !== undefined ? { errorMessage } : {}),
          ...((status === 'accepted' || status === 'declined') ? { respondedAt: now } : {}),
          ...(status === 'sent' ? { sentAt: now } : {}),
        })
        .where(eq(telegramNotifications.id, id));
    } else {
      const n = this.mockNotifications.get(id);
      if (n) {
        n.status = status;
        if (messageId) n.telegramMessageId = messageId;
        if (errorMessage !== undefined) n.errorMessage = errorMessage;
        if (status === 'accepted' || status === 'declined') {
          n.respondedAt = now.toISOString();
        }
        if (status === 'sent') {
          n.sentAt = now.toISOString();
        }
      }
    }
  }

  /**
   * Get all donors who were notified via Telegram for a specific request
   */
  public async getTelegramNotifiedDonorsForRequest(
    requestId: string
  ): Promise<Array<{ donorId: string; telegramChatId: string; messageId?: number | null }>> {
    if (this.isLiveDb()) {
      const rows = await db
        .select({
          donorId: telegramNotifications.donorId,
          telegramChatId: telegramNotifications.telegramChatId,
          messageId: telegramNotifications.telegramMessageId,
        })
        .from(telegramNotifications)
        .where(eq(telegramNotifications.requestId, requestId));

      return rows.map((r) => ({
        donorId: r.donorId,
        telegramChatId: r.telegramChatId,
        messageId: r.messageId,
      }));
    }

    const results: Array<{ donorId: string; telegramChatId: string; messageId?: number | null }> = [];
    for (const notif of this.mockNotifications.values()) {
      if (notif.requestId === requestId) {
        results.push({
          donorId: notif.donorId,
          telegramChatId: notif.telegramChatId,
          messageId: notif.telegramMessageId,
        });
      }
    }
    return results;
  }

  // Idempotency tracking for processed Telegram updates
  public async isUpdateProcessed(updateId: number): Promise<boolean> {
    return this.processedUpdates.has(updateId);
  }

  public async markUpdateProcessed(updateId: number): Promise<void> {
    this.processedUpdates.add(updateId);
    // Keep set bounded to last 5000 updates to prevent unbounded memory growth
    if (this.processedUpdates.size > 5000) {
      const it = this.processedUpdates.values();
      for (let i = 0; i < 1000; i++) {
        const val = it.next().value;
        if (val !== undefined) this.processedUpdates.delete(val);
      }
    }
  }

  /**
   * Clear in-memory mock store (useful in test teardowns)
   */
  public resetMockStore(): void {
    this.mockSubscriptions.clear();
    this.mockChatToDonor.clear();
    this.mockLinkTokens.clear();
    this.mockNotifications.clear();
    this.mockCallbackToNotif.clear();
    this.processedUpdates.clear();
  }
}

export const telegramStore = new TelegramStore();
