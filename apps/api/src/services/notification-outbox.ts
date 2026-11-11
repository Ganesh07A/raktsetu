import { requestService } from './request-service';
import { pushNotificationService } from './push-notifications';
import { createDonorResponseToken } from './donor-session';
import type { BloodGroup } from '@repo/shared';

export interface OutboxDispatchItem {
  requestId: string;
  bloodGroupNeeded: BloodGroup;
  donors: Array<{
    id: string;
    name: string;
    phone: string;
    bloodGroup: BloodGroup;
    distanceKm: number;
    preferredLanguage?: 'en' | 'hi';
  }>;
}

export interface OutboxDispatchSummary {
  queuedCount: number;
  sentCount: number;
  failedCount: number;
}

export class NotificationOutboxService {
  private isProcessing = false;
  private pendingQueue: OutboxDispatchItem[] = [];

  /**
   * Enqueue a batch of donor notifications for durable asynchronous delivery.
   * If in test environment, processes immediately to allow deterministic test assertions.
   */
  public async enqueue(item: OutboxDispatchItem): Promise<OutboxDispatchSummary> {
    // 1. Immediately persist all notifications as 'pending' in durable storage
    for (const donor of item.donors) {
      const notifId = `notif-${item.requestId}-${donor.id}`;
      const maskedPhone = donor.phone.replace(
        /(\+\d{2})(\d{2})\d{4}(\d{4})/,
        '$1 $2****$3'
      );

      await requestService.recordNotification({
        id: notifId,
        requestId: item.requestId,
        donorId: donor.id,
        status: 'pending',
        donorName: donor.name,
        donorBloodGroup: donor.bloodGroup,
        donorPhoneMasked: maskedPhone,
        sentAt: new Date().toISOString(),
      });
    }

    if (process.env.NODE_ENV === 'test' || process.env.OUTBOX_SYNC === 'true') {
      return await this.processBatch(item);
    }

    // In non-test mode, dispatch asynchronously in background
    this.pendingQueue.push(item);
    void this.drainQueue();

    return {
      queuedCount: item.donors.length,
      sentCount: 0,
      failedCount: 0,
    };
  }

  private async drainQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.pendingQueue.length > 0) {
        const item = this.pendingQueue.shift();
        if (item) {
          await this.processBatch(item);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a batch of notifications with retry logic and token pruning.
   */
  public async processBatch(item: OutboxDispatchItem): Promise<OutboxDispatchSummary> {
    let sentCount = 0;
    let failedCount = 0;

    for (const donor of item.donors) {
      const responseToken = createDonorResponseToken(item.requestId, donor.id);
      const deviceTokens = await requestService.getPushTokensForDonor(donor.id);

      if (deviceTokens.length === 0) {
        await requestService.updateNotificationDelivery({
          requestId: item.requestId,
          donorId: donor.id,
          status: 'failed',
          pushMessageId: null,
        });
        failedCount++;
        continue;
      }

      // Retry loop with exponential backoff for transient failures (max 3 attempts)
      let attempt = 0;
      let success = false;
      let lastResult: any = null;

      while (attempt < 3 && !success) {
        attempt++;
        try {
          lastResult = await pushNotificationService.sendDonationRequest({
            tokens: deviceTokens,
            requestId: item.requestId,
            responseToken,
            bloodGroup: item.bloodGroupNeeded,
            distanceKm: donor.distanceKm,
            language: donor.preferredLanguage || 'en',
          });

          if (lastResult.success) {
            success = true;
          } else if (attempt < 3 && process.env.NODE_ENV !== 'test') {
            const backoffMs = Math.pow(2, attempt) * 250;
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        } catch (err) {
          if (attempt >= 3) break;
          if (process.env.NODE_ENV !== 'test') {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 250));
          }
        }
      }

      if (success) {
        sentCount++;
        await requestService.updateNotificationDelivery({
          requestId: item.requestId,
          donorId: donor.id,
          status: 'sent',
          pushMessageId: lastResult?.messageId ?? null,
        });
      } else {
        failedCount++;
        await requestService.updateNotificationDelivery({
          requestId: item.requestId,
          donorId: donor.id,
          status: 'failed',
          pushMessageId: null,
        });
      }

      // Prune dead/unregistered tokens
      if (lastResult?.invalidTokens && Array.isArray(lastResult.invalidTokens)) {
        for (const invalidToken of lastResult.invalidTokens) {
          await requestService.removePushSubscriptionToken(donor.id, invalidToken);
        }
      }
    }

    return {
      queuedCount: item.donors.length,
      sentCount,
      failedCount,
    };
  }
}

export const notificationOutbox = new NotificationOutboxService();
