import { telegramApi } from './telegram-api';
import { telegramStore } from './telegram-store';
import { requestService } from '../request-service';
import { createDonorResponseToken } from '../donor-session';
import type { TelegramCallbackQuery, TelegramMessage, TelegramUpdate } from './telegram-types';

export class TelegramBotHandler {
  /**
   * Process a single incoming Telegram update (from polling or webhook)
   */
  public async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (!update || !update.update_id) return;

    // Idempotency: skip already processed updates
    const alreadyProcessed = await telegramStore.isUpdateProcessed(update.update_id);
    if (alreadyProcessed) return;

    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } finally {
      await telegramStore.markUpdateProcessed(update.update_id);
    }
  }

  /**
   * Handle incoming text messages and commands
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    const text = (message.text || '').trim();
    const chatId = String(message.chat.id);
    const userId = message.from ? String(message.from.id) : null;
    const username = message.from?.username || null;

    if (!text) return;

    // Command parsing
    const parts = text.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const param = parts[1];

    if (command === '/start') {
      await this.handleStartCommand(chatId, userId, username, param);
    } else if (command === '/help') {
      await this.handleHelpCommand(chatId);
    } else if (command === '/status') {
      await this.handleStatusCommand(chatId);
    } else if (command === '/unlink') {
      await this.handleUnlinkCommand(chatId);
    } else if (command?.startsWith('/')) {
      await telegramApi.sendMessage(
        chatId,
        'Sorry, I didn’t recognize that command. Type /help to see available commands.'
      );
    }
  }

  /**
   * Handle /start with or without a linking token
   */
  private async handleStartCommand(
    chatId: string,
    userId: string | null,
    username: string | null,
    linkingToken?: string
  ): Promise<void> {
    const webOrigin = (process.env.PUBLIC_WEB_ORIGIN || 'https://raktsetu-six.vercel.app').replace(/\/$/, '');

    // Case 1: No linking token provided
    if (!linkingToken) {
      // Check if already linked
      const existing = await telegramStore.getSubscriptionByChatId(chatId);
      if (existing) {
        await telegramApi.sendMessage(
          chatId,
          '🩸 *Welcome back to RaktSetu!*\n\nYour Telegram is already linked to your donor profile and active. You will receive notifications here for matching emergency blood requests.\n\nType /status to view your status or /help for guidance.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await telegramApi.sendMessage(
        chatId,
        `👋 *Welcome to RaktSetu Donor Bot!*\n\n` +
          `RaktSetu connects voluntary blood donors with emergency blood requests in real time.\n\n` +
          `To receive emergency blood alerts on Telegram:\n` +
          `1. Open [RaktSetu](${webOrigin}/donor/dashboard)\n` +
          `2. Sign in as a donor\n` +
          `3. Click *Connect Telegram* on your dashboard\n\n` +
          `Once connected, you will be notified of urgent needs for your blood group. Type /help for details.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 Open RaktSetu', url: `${webOrigin}/donor/dashboard` }],
            ],
          },
        }
      );
      return;
    }

    // Case 2: Linking token provided -> Validate & connect
    const validation = await telegramStore.validateAndConsumeLinkToken(linkingToken);

    if (!validation.valid || !validation.donorId) {
      let errorMsg = '❌ *Unable to Connect Account*\n\n';
      if (validation.reason === 'TOKEN_EXPIRED') {
        errorMsg += 'This connection link has expired (links are valid for 10 minutes). Please generate a new link from your RaktSetu donor dashboard.';
      } else if (validation.reason === 'TOKEN_ALREADY_USED') {
        errorMsg += 'This connection link has already been used. Please generate a fresh link from your donor dashboard.';
      } else {
        errorMsg += 'This connection link is invalid or unrecognized. Please generate a new connection link from your donor dashboard.';
      }

      await telegramApi.sendMessage(chatId, errorMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Go to Dashboard', url: `${webOrigin}/donor/dashboard` }],
          ],
        },
      });
      return;
    }

    // Link the account
    try {
      await telegramStore.saveSubscription({
        donorId: validation.donorId,
        telegramChatId: chatId,
        telegramUserId: userId,
        telegramUsername: username,
      });

      await telegramApi.sendMessage(
        chatId,
        `✅ *Account Linked Successfully!*\n\n` +
          `Your Telegram is now securely connected to your RaktSetu donor profile.\n\n` +
          `• When an emergency blood request matches your blood group and location, you will receive an alert here.\n` +
          `• You can respond instantly with *❤️ I'm Available* or *❌ Not Available*.\n` +
          `• Type /status to check connection status.\n` +
          `• Type /unlink at any time to disconnect.\n\n` +
          `Thank you for being a lifesaving donor! ❤️`,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      if (err?.message === 'TELEGRAM_CHAT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT') {
        await telegramApi.sendMessage(
          chatId,
          '⚠️ *Account Conflict*\n\nThis Telegram chat is already linked to another RaktSetu donor account. Please disconnect the previous account using /unlink first before linking a new one.',
          { parse_mode: 'Markdown' }
        );
      } else {
        await telegramApi.sendMessage(
          chatId,
          '❌ *Connection Failed*\n\nAn unexpected error occurred while linking your account. Please try again from your donor dashboard.',
          { parse_mode: 'Markdown' }
        );
      }
    }
  }

  /**
   * Handle /help command
   */
  private async handleHelpCommand(chatId: string): Promise<void> {
    const webOrigin = (process.env.PUBLIC_WEB_ORIGIN || 'https://raktsetu-six.vercel.app').replace(/\/$/, '');
    await telegramApi.sendMessage(
      chatId,
      `🩸 *RaktSetu Donor Bot Help*\n\n` +
        `*Commands:*\n` +
        `• /status — Check if your Telegram is linked to your donor profile\n` +
        `• /unlink — Disconnect your Telegram from RaktSetu alerts\n` +
        `• /help — Show this help message\n\n` +
        `*How alerts work:*\n` +
        `When an emergency request needs your blood group nearby, you'll get an alert with blood group, hospital, and urgency. Tap *❤️ I'm Available* or *❌ Not Available* on the alert.\n\n` +
        `*Donor Privacy:*\n` +
        `Your phone number and contact details are never shared with anyone unless you explicitly accept a blood request.\n\n` +
        `More info at [RaktSetu](${webOrigin}).`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle /status command
   */
  private async handleStatusCommand(chatId: string): Promise<void> {
    const sub = await telegramStore.getSubscriptionByChatId(chatId);
    if (!sub) {
      await telegramApi.sendMessage(
        chatId,
        'ℹ️ *Status: Not Connected*\n\nThis Telegram account is not currently connected to RaktSetu.\nTo connect, sign in to your RaktSetu donor dashboard and click "Connect Telegram".',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await telegramApi.sendMessage(
      chatId,
      `✅ *Status: Connected & Active*\n\n` +
        `• Alerts: *${sub.alertsEnabled ? 'Enabled' : 'Paused'}*\n` +
        `• Linked: *${new Date(sub.linkedAt).toLocaleDateString()}*\n\n` +
        `You are set up to receive emergency blood request notifications. Type /unlink to disconnect.`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle /unlink command
   */
  private async handleUnlinkCommand(chatId: string): Promise<void> {
    const unlinked = await telegramStore.unlinkByChatId(chatId);
    if (!unlinked) {
      await telegramApi.sendMessage(
        chatId,
        'ℹ️ This Telegram chat is not linked to any active RaktSetu donor account.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await telegramApi.sendMessage(
      chatId,
      '🔌 *Account Disconnected*\n\nYour Telegram account has been disconnected from RaktSetu. You will no longer receive blood alerts here.\n\nYou can reconnect at any time from your RaktSetu donor dashboard.',
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle inline button responses from donors (Phase 4)
   * Supports:
   * - 'avail:<callbackId>' -> Accepts request, fulfills request with donor, shares contact details
   * - 'decl:<callbackId>' -> Declines request, preserves privacy
   */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const data = (query.data || '').trim();
    const queryId = query.id;

    if (!data) {
      await telegramApi.answerCallbackQuery(queryId, { text: 'Invalid response.', show_alert: true });
      return;
    }

    let action: 'accepted' | 'declined' | null = null;
    let callbackId: string | null = null;

    if (data.startsWith('avail:')) {
      action = 'accepted';
      callbackId = data.slice('avail:'.length).trim();
    } else if (data.startsWith('decl:')) {
      action = 'declined';
      callbackId = data.slice('decl:'.length).trim();
    }

    if (!action || !callbackId) {
      await telegramApi.answerCallbackQuery(queryId, {
        text: 'Unrecognized action.',
        show_alert: true,
      });
      return;
    }

    // 1. Look up notification record by compact callback ID
    const notif = await telegramStore.getNotificationByCallbackId(callbackId);
    if (!notif) {
      await telegramApi.answerCallbackQuery(queryId, {
        text: 'Notification not found or expired. Please check your RaktSetu dashboard.',
        show_alert: true,
      });
      return;
    }

    // 2. Sender authorization check: verify user or chat matches registered recipient
    const senderUserId = query.from ? String(query.from.id) : null;
    const chatMsgId = query.message?.chat ? String(query.message.chat.id) : null;

    const isAuthorized =
      (senderUserId && senderUserId === notif.telegramChatId) ||
      (chatMsgId && chatMsgId === notif.telegramChatId);

    if (!isAuthorized) {
      await telegramApi.answerCallbackQuery(queryId, {
        text: 'Unauthorized: You are not authorized to respond to this notification.',
        show_alert: true,
      });
      return;
    }

    // 3. Idempotent check: if donor already responded with the exact same action
    if (notif.status === action) {
      const msg =
        action === 'accepted'
          ? 'You have already accepted this emergency request. The requester has your contact details.'
          : 'You have already declined this emergency request. Thank you for notifying us.';
      await telegramApi.answerCallbackQuery(queryId, { text: msg, show_alert: false });
      return;
    }

    // 4. Request lifecycle validation: check if request is still active
    const requestDetails = await requestService.getRequestWithDetails(notif.requestId);
    const reqStatus = requestDetails?.request?.status;

    if (reqStatus === 'cancelled' || reqStatus === 'expired') {
      await telegramApi.answerCallbackQuery(queryId, {
        text: `This blood request is ${reqStatus}. Thank you for your willingness to help!`,
        show_alert: true,
      });

      if (query.message?.message_id) {
        await telegramApi.editMessageText(
          notif.telegramChatId,
          query.message.message_id,
          `🩸 *Blood Request ${reqStatus.toUpperCase()}*\n\nThis emergency blood request is no longer active (${reqStatus}). Thank you for your support and willingness to help save lives!`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // 5. Ensure matching donor_notifications row exists so requestService.handleDonorReply succeeds
    try {
      await requestService.recordNotification({
        id: `notif-${notif.requestId}-${notif.donorId}`,
        requestId: notif.requestId,
        donorId: notif.donorId,
        status: 'sent',
        sentAt: notif.sentAt || new Date().toISOString(),
      });
    } catch {
      // Non-fatal if already present
    }

    // 6. Execute state transition via requestService
    try {
      await requestService.handleDonorReply(
        notif.requestId,
        notif.donorId,
        action,
        'Responded via Telegram Bot'
      );
    } catch (err: any) {
      console.warn(`[@repo/api-telegram] handleDonorReply error for request ${notif.requestId}:`, err?.message || err);
      await telegramApi.answerCallbackQuery(queryId, {
        text: err?.message || 'Unable to record your response. Please try again or open RaktSetu.',
        show_alert: true,
      });
      return;
    }

    // 7. Update telegram_notifications record in store
    await telegramStore.updateNotificationStatus(notif.id, action);

    // 8. Acknowledge callback query
    const toastText =
      action === 'accepted'
        ? '❤️ Thank you! Your availability has been shared with the hospital/seeker.'
        : 'Response recorded: Not available. Thank you!';
    await telegramApi.answerCallbackQuery(queryId, { text: toastText, show_alert: false });

    // 9. Update original message text & inline keyboard in Telegram chat
    if (query.message?.message_id) {
      const webOrigin = (process.env.PUBLIC_WEB_ORIGIN || 'https://raktsetu-six.vercel.app').replace(/\/$/, '');
      const responseToken = createDonorResponseToken(notif.requestId, notif.donorId);
      const viewUrl = `${webOrigin}/donor/respond/${encodeURIComponent(notif.requestId)}?responseToken=${encodeURIComponent(responseToken)}`;

      if (action === 'accepted') {
        await telegramApi.editMessageText(
          notif.telegramChatId,
          query.message.message_id,
          `✅ *RESPONSE RECORDED: ACCEPTED & CONTACT SHARED*\n\n` +
            `Thank you for stepping forward to save a life! ❤️\n\n` +
            `• Your contact details have been securely shared with the requester.\n` +
            `• The seeker or hospital coordinator will contact you directly.\n` +
            `• If your availability changes or you need to view directions, use the link below.\n\n` +
            `*Request ID:* \`${notif.requestId}\``,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Change to Not Available', callback_data: `decl:${notif.callbackId}` }],
                [{ text: '📋 View Request & Details', url: viewUrl }],
              ],
            },
          }
        );
      } else {
        await telegramApi.editMessageText(
          notif.telegramChatId,
          query.message.message_id,
          `❌ *RESPONSE RECORDED: NOT AVAILABLE*\n\n` +
            `Thank you for letting us know promptly. You will continue to receive future emergency alerts when urgent assistance is needed nearby.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❤️ Change to Available', callback_data: `avail:${notif.callbackId}` }],
                [{ text: '📋 View Request', url: viewUrl }],
              ],
            },
          }
        );
      }
    }
  }
}

export const telegramBotHandler = new TelegramBotHandler();
