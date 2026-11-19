import type {
  TelegramApiResponse,
  TelegramMessage,
  TelegramSendOptions,
  TelegramUpdate,
} from './telegram-types';

export class TelegramApiClient {
  private get token(): string {
    return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  }

  public isConfigured(): boolean {
    return this.token.length > 0;
  }

  private getBaseUrl(): string {
    const t = this.token;
    if (!t) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    return `https://api.telegram.org/bot${t}`;
  }

  /**
   * Safe wrapper for API calls that strips the bot token from error messages
   */
  private async callApi<T>(
    method: string,
    body?: Record<string, unknown>,
    timeoutMs: number = 15000
  ): Promise<TelegramApiResponse<T>> {
    if (!this.isConfigured()) {
      return { ok: false, description: 'Telegram bot token is not configured' };
    }

    const url = `${this.getBaseUrl()}/${method}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as TelegramApiResponse<T>;
      return data;
    } catch (err) {
      const sanitizedMsg = err instanceof Error ? err.message : 'Unknown Telegram network error';
      // Ensure bot token never leaks into error logs
      const safeError = sanitizedMsg.replace(this.token, '[REDACTED_BOT_TOKEN]');
      return { ok: false, description: safeError };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send text message to a chat
   */
  public async sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramSendOptions
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.callApi<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode,
      reply_markup: options?.reply_markup,
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
    });
  }

  /**
   * Edit text of an existing message
   */
  public async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: TelegramSendOptions
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.callApi<TelegramMessage>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parse_mode,
      reply_markup: options?.reply_markup,
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
    });
  }

  /**
   * Acknowledge a callback query from an inline button
   */
  public async answerCallbackQuery(
    callbackQueryId: string,
    options?: { text?: string; show_alert?: boolean }
  ): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: options?.text,
      show_alert: options?.show_alert ?? false,
    });
  }

  /**
   * Get updates via polling
   */
  public async getUpdates(
    offset?: number,
    limit: number = 20,
    timeoutSeconds: number = 2
  ): Promise<TelegramApiResponse<TelegramUpdate[]>> {
    return this.callApi<TelegramUpdate[]>(
      'getUpdates',
      {
        offset,
        limit,
        timeout: timeoutSeconds,
        allowed_updates: ['message', 'callback_query'],
      },
      (timeoutSeconds + 5) * 1000
    );
  }

  /**
   * Register a webhook endpoint with optional secret token
   */
  public async setWebhook(url: string, secretToken?: string): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('setWebhook', {
      url,
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  /**
   * Remove current webhook registration
   */
  public async deleteWebhook(dropPendingUpdates: boolean = false): Promise<TelegramApiResponse<boolean>> {
    return this.callApi<boolean>('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }
}

export const telegramApi = new TelegramApiClient();
