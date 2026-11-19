import { telegramApi } from './telegram-api';
import { telegramBotHandler } from './telegram-bot';

export class TelegramPollingService {
  private isRunning = false;
  private shouldStop = false;
  private currentOffset = 0;
  private pollPromise: Promise<void> | null = null;

  public isPolling(): boolean {
    return this.isRunning;
  }

  /**
   * Start Telegram long polling loop for local development.
   * NOTE: We deliberately do NOT call deleteWebhook() here to ensure production
   * webhook configuration is never altered during local testing.
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log('[@repo/api-telegram] Polling is already running.');
      return true;
    }

    if (!telegramApi.isConfigured()) {
      console.warn('[@repo/api-telegram] Cannot start polling: TELEGRAM_BOT_TOKEN is not configured.');
      return false;
    }

    this.isRunning = true;
    this.shouldStop = false;
    console.log('[@repo/api-telegram] Telegram bot polling started. Listening for updates...');

    this.pollPromise = this.loop();
    return true;
  }

  /**
   * Gracefully stop the polling loop
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    console.log('[@repo/api-telegram] Stopping Telegram bot polling...');
    this.shouldStop = true;
    this.isRunning = false;
    if (this.pollPromise) {
      await this.pollPromise.catch(() => undefined);
      this.pollPromise = null;
    }
    console.log('[@repo/api-telegram] Telegram bot polling stopped.');
  }

  private async loop(): Promise<void> {
    while (!this.shouldStop && this.isRunning) {
      try {
        const response = await telegramApi.getUpdates(this.currentOffset, 20, 2);

        if (!response.ok) {
          const errDesc = response.description || 'Unknown getUpdates error';
          if (errDesc.includes('Conflict')) {
            console.warn('[@repo/api-telegram] 409 Conflict: Another bot instance is polling or webhook is active. Backing off 5s...');
            await new Promise((r) => setTimeout(r, 5000));
          } else {
            console.warn(`[@repo/api-telegram] getUpdates error: ${errDesc}. Backing off 3s...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
          continue;
        }

        const updates = response.result || [];
        for (const update of updates) {
          if (this.shouldStop) break;

          try {
            await telegramBotHandler.handleUpdate(update);
          } catch (err) {
            console.error('[@repo/api-telegram] Error handling Telegram update:', err);
          }

          // Advance offset
          if (update.update_id >= this.currentOffset) {
            this.currentOffset = update.update_id + 1;
          }
        }
      } catch (err: any) {
        if (this.shouldStop) break;
        console.warn('[@repo/api-telegram] Polling loop exception, retrying in 3s:', err?.message || err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
}

export const telegramPolling = new TelegramPollingService();
