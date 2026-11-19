import { telegramApi } from './telegram-api';
import { telegramStore } from './telegram-store';
import { requestService } from '../request-service';
import { createDonorResponseToken } from '../donor-session';
import type { BloodGroup } from '@repo/shared';
import crypto from 'node:crypto';

export interface TelegramDonorAlertParams {
  requestId: string;
  donorId: string;
  telegramChatId: string;
  bloodGroup: BloodGroup;
  hospitalName: string;
  district?: string | null;
  state?: string | null;
  unitsNeeded: number;
  emergencyType?: string | null;
  distanceKm?: number;
}

export class TelegramNotifierService {
  /**
   * Dispatch an urgent blood request alert to a linked Telegram donor.
   *
   * Lifecycle & Delivery Ambiguity Safeguards:
   * 1. Records initial state as 'pending'.
   * 2. Immediately transitions to 'sending' before calling Telegram API.
   * 3. On success (200 OK + message_id): transitions to 'sent'.
   * 4. On timeout or ambiguous network failure where Telegram may have accepted
   *    the message: transitions to 'unknown'.
   *    CRITICAL: 'unknown' deliveries are NOT automatically retried to prevent
   *    distressing donors with duplicate urgent alarms.
   * 5. On deterministic failure (4xx): transitions to 'failed'.
   */
  public async sendDonationAlert(
    params: TelegramDonorAlertParams
  ): Promise<{ success: boolean; messageId?: number; status: string; error?: string }> {
    if (!telegramApi.isConfigured()) {
      return { success: false, status: 'failed', error: 'Telegram bot not configured' };
    }

    const {
      requestId,
      donorId,
      telegramChatId,
      bloodGroup,
      hospitalName,
      district,
      state,
      unitsNeeded,
      emergencyType,
      distanceKm,
    } = params;

    // Generate compact unique callback ID for button callbacks (must be <= 64 bytes for Telegram API)
    const randomHex = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const callbackId = `${randomHex}`;

    const webOrigin = (process.env.PUBLIC_WEB_ORIGIN || 'https://raktsetu-six.vercel.app').replace(/\/$/, '');
    const responseToken = createDonorResponseToken(requestId, donorId);
    const viewUrl = `${webOrigin}/donor/respond/${encodeURIComponent(requestId)}?responseToken=${encodeURIComponent(responseToken)}`;

    const area = [district, state].filter(Boolean).join(', ') || 'Nearby Hospital';
    const distText = distanceKm !== undefined ? ` (~${Math.round(distanceKm * 10) / 10} km away)` : '';
    const urgency = emergencyType ? `(${emergencyType.toUpperCase()})` : '';

    const text =
      `🩸 *URGENT BLOOD REQUEST*\n\n` +
      `A patient urgently needs blood donation assistance${distText}.\n\n` +
      `🩸 Blood Group: *${bloodGroup}*\n` +
      `📍 Area: *${area}*\n` +
      `🏥 Hospital: *${hospitalName}*\n` +
      `⏰ Needed: *${unitsNeeded} Unit(s)* ${urgency}\n\n` +
      `Can you help save a life?`;

    const notifId = `tgnotif-${requestId}-${donorId}`;

    // Step 1: Initial record in 'pending'
    await telegramStore.recordNotification({
      id: notifId,
      requestId,
      donorId,
      telegramChatId,
      callbackId,
      status: 'pending',
    });

    // Step 2: Transition to intermediate 'sending' state
    await telegramStore.updateNotificationStatus(notifId, 'sending');

    // Inline buttons: Accept & Share Contact, Not Available, View in RaktSetu link
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '❤️ Accept & Share Contact', callback_data: `avail:${callbackId}` },
          { text: '❌ Not Available', callback_data: `decl:${callbackId}` },
        ],
        [{ text: '📋 View Request in RaktSetu', url: viewUrl }],
      ],
    };

    try {
      const res = await telegramApi.sendMessage(telegramChatId, text, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });

      if (res.ok && res.result) {
        // Step 3: Transition to 'sent'
        await telegramStore.updateNotificationStatus(notifId, 'sent', res.result.message_id);
        await requestService
          .recordNotification({
            id: `notif-${requestId}-${donorId}`,
            requestId,
            donorId,
            status: 'sent',
            sentAt: new Date().toISOString(),
          })
          .catch(() => undefined);
        return { success: true, status: 'sent', messageId: res.result.message_id };
      }

      // Explicit API rejection from Telegram (e.g. chat not found, bot blocked)
      const err = res.description || 'Failed to deliver Telegram message';
      await telegramStore.updateNotificationStatus(notifId, 'failed', null, err);
      return { success: false, status: 'failed', error: err };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isAmbiguousTimeout =
        errMsg.includes('timeout') ||
        errMsg.includes('abort') ||
        errMsg.includes('socket connection was closed') ||
        errMsg.includes('ECONNRESET');

      if (isAmbiguousTimeout) {
        // Step 4: Network timeout / connection drop where Telegram may have accepted the message.
        // Mark as 'unknown' and DO NOT auto-retry to prevent duplicate alert blasts.
        console.warn(`[@repo/api-telegram] Ambiguous delivery timeout for notification ${notifId}: ${errMsg}. Marked as 'unknown'.`);
        await telegramStore.updateNotificationStatus(notifId, 'unknown', null, errMsg);
        return { success: false, status: 'unknown', error: errMsg };
      }

      await telegramStore.updateNotificationStatus(notifId, 'failed', null, errMsg);
      return { success: false, status: 'failed', error: errMsg };
    }
  }

  /**
   * Send a cancellation or fulfillment update to donors who received the alert
   */
  public async notifyRequestClosed(
    requestId: string,
    reason: 'fulfilled' | 'cancelled' | 'expired'
  ): Promise<number> {
    if (!telegramApi.isConfigured()) return 0;

    const contacted = await telegramStore.getTelegramNotifiedDonorsForRequest(requestId);
    if (contacted.length === 0) return 0;

    const reasonText =
      reason === 'fulfilled'
        ? 'fulfilled by an available donor'
        : reason === 'cancelled'
          ? 'cancelled by the requester'
          : 'closed';

    const message =
      `ℹ️ *Blood Request Update*\n\n` +
      `The blood request has been ${reasonText}. No further action is required.\n\n` +
      `Thank you for your willingness to help save lives! ❤️`;

    let sent = 0;
    for (const donor of contacted) {
      try {
        const res = await telegramApi.sendMessage(donor.telegramChatId, message, {
          parse_mode: 'Markdown',
        });
        if (res.ok) sent++;
      } catch {
        // Continue notifying remaining donors
      }
    }
    return sent;
  }
}

export const telegramNotifier = new TelegramNotifierService();
