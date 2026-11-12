import {
  db,
  donorNotifications,
  sql,
  eq,
  and,
} from '@repo/db';
import { requestService } from './request-service';
import { pushNotificationService } from './push-notifications';
import { createDonorResponseToken } from './donor-session';
import { mockStore } from './mock-store';
import type { BloodGroup, NotificationStatus } from '@repo/shared';

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
  exhaustedCount: number;
  cancelledCount: number;
}

export interface ClaimedNotification {
  id: string;
  requestId: string;
  donorId: string;
  attempts: number;
  maxAttempts: number;
  status: string;
}

export interface OutboxMetrics {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  exhausted: number;
  cancelled: number;
  total: number;
}

export class NotificationOutboxService {
  private workerTimer: ReturnType<typeof setInterval> | null = null;
  private currentWorkerId = `worker-${Math.random().toString(36).substring(2, 9)}`;

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

  public getWorkerId(): string {
    return this.currentWorkerId;
  }

  public setWorkerId(id: string): void {
    this.currentWorkerId = id;
  }

  /**
   * Enqueue a batch of donor notifications into the durable outbox.
   */
  public async enqueue(item: OutboxDispatchItem): Promise<OutboxDispatchSummary> {
    const queuedCount = item.donors.length;

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

    // In unit-test runs or synchronous test harness, process immediately
    if (
      (process.env.NODE_ENV === 'test' && process.env.TEST_ASYNC_OUTBOX !== 'true') ||
      process.env.OUTBOX_SYNC === 'true'
    ) {
      return await this.processNextBatch(this.currentWorkerId, queuedCount);
    }

    // In production or async background mode, trigger outbox processor asynchronously
    void this.processNextBatch(this.currentWorkerId, 10);

    return {
      queuedCount,
      sentCount: 0,
      failedCount: 0,
      exhaustedCount: 0,
      cancelledCount: 0,
    };
  }

  /**
   * Process a specific batch of notifications directly (used for deterministic test suites).
   */
  public async processBatch(item: OutboxDispatchItem): Promise<OutboxDispatchSummary> {
    let sentCount = 0;
    let failedCount = 0;
    let exhaustedCount = 0;
    let cancelledCount = 0;

    for (const donor of item.donors) {
      const notifId = `notif-${item.requestId}-${donor.id}`;
      const reqDetails = await requestService.getRequestWithDetails(item.requestId);
      const req = reqDetails?.request;
      if (req && (req.status === 'cancelled' || req.status === 'expired' || req.status === 'fulfilled')) {
        await this.markTerminal(notifId, item.requestId, donor.id, req.status, this.currentWorkerId);
        cancelledCount++;
        continue;
      }

      const responseToken = createDonorResponseToken(item.requestId, donor.id);
      const deviceTokens = await requestService.getPushTokensForDonor(donor.id);

      if (deviceTokens.length === 0) {
        await this.markFailed(notifId, item.requestId, donor.id, 'No push tokens registered', this.currentWorkerId);
        failedCount++;
        continue;
      }

      let attempt = 0;
      let success = false;
      let lastResult: any = null;
      let lastError: string | null = null;

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

          if (lastResult?.success) {
            success = true;
          } else {
            lastError = lastResult?.error || 'Push failed';
            if (attempt < 3 && process.env.NODE_ENV !== 'test') {
              await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 250));
            }
          }
        } catch (err: any) {
          lastError = err?.message || 'Push exception';
          if (attempt >= 3) break;
          if (process.env.NODE_ENV !== 'test') {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 250));
          }
        }
      }

      if (success) {
        const ok = await this.markSent(notifId, item.requestId, donor.id, lastResult?.messageId ?? null, this.currentWorkerId);
        if (ok) sentCount++;
      } else {
        if (attempt >= 3) {
          const ok = await this.markExhausted(notifId, item.requestId, donor.id, lastError, this.currentWorkerId);
          if (ok) exhaustedCount++;
        } else {
          const ok = await this.markRetry(notifId, item.requestId, donor.id, 5, lastError, this.currentWorkerId);
          if (ok) failedCount++;
        }
      }

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
      exhaustedCount,
      cancelledCount,
    };
  }

  /**
   * Atomically claim a batch of pending/stale-locked notifications using PostgreSQL FOR UPDATE SKIP LOCKED.
   */
  public async claimBatch(
    workerId: string = this.currentWorkerId,
    limit: number = 10,
    staleLockTimeoutSeconds: number = 120
  ): Promise<ClaimedNotification[]> {
    if (!this.isLiveDb()) {
      return this.claimBatchMock(workerId, limit);
    }

    try {
      const rows = await db.execute(sql`
        WITH claimable AS (
          SELECT id
          FROM donor_notifications
          WHERE (
            (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
            OR
            (status = 'processing' AND locked_at < NOW() - (${staleLockTimeoutSeconds} * INTERVAL '1 second'))
          )
          ORDER BY next_retry_at ASC NULLS FIRST, id ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE donor_notifications dn
        SET status = 'processing',
            locked_by = ${workerId},
            locked_at = NOW(),
            attempts = dn.attempts + 1,
            last_attempted_at = NOW()
        FROM claimable
        WHERE dn.id = claimable.id
        RETURNING
          dn.id,
          dn.request_id as "requestId",
          dn.donor_id as "donorId",
          dn.attempts,
          dn.max_attempts as "maxAttempts",
          dn.status;
      `);

      return (rows as unknown as ClaimedNotification[]).map((r) => ({
        id: String(r.id),
        requestId: String(r.requestId),
        donorId: String(r.donorId),
        attempts: Number(r.attempts),
        maxAttempts: Number(r.maxAttempts),
        status: String(r.status),
      }));
    } catch (err) {
      console.error('[@repo/api] Error claiming outbox batch:', err);
      return [];
    }
  }

  private claimBatchMock(workerId: string, limit: number): ClaimedNotification[] {
    const all = mockStore.getAllNotifications();
    const claimed: ClaimedNotification[] = [];

    for (const notif of all) {
      if (claimed.length >= limit) break;
      const isPending = notif.status === 'pending';
      const isStale =
        notif.status === 'processing' &&
        (notif as any).lockedAt &&
        Date.now() - new Date((notif as any).lockedAt).getTime() > 120000;

      if (isPending || isStale) {
        notif.status = 'processing';
        (notif as any).attempts = ((notif as any).attempts || 0) + 1;
        (notif as any).maxAttempts = (notif as any).maxAttempts || 3;
        (notif as any).lockedBy = workerId;
        (notif as any).lockedAt = new Date().toISOString();

        claimed.push({
          id: notif.id,
          requestId: notif.requestId,
          donorId: notif.donorId,
          attempts: (notif as any).attempts,
          maxAttempts: (notif as any).maxAttempts,
          status: 'processing',
        });
      }
    }

    return claimed;
  }

  /**
   * Process a batch of claimed notifications.
   */
  public async processClaimed(
    claimed: ClaimedNotification[],
    workerId: string = this.currentWorkerId
  ): Promise<OutboxDispatchSummary> {
    let sentCount = 0;
    let failedCount = 0;
    let exhaustedCount = 0;
    let cancelledCount = 0;

    for (const item of claimed) {
      // 1. Guard against notifications for cancelled, expired, or fulfilled requests
      const details = await requestService.getRequestWithDetails(item.requestId);
      const req = details?.request;

      if (!req || req.status === 'cancelled' || req.status === 'expired' || req.status === 'fulfilled') {
        const terminalReason = req ? req.status : 'not_found';
        await this.markTerminal(item.id, item.requestId, item.donorId, terminalReason, workerId);
        cancelledCount++;
        continue;
      }

      // 2. Query donor device tokens
      const deviceTokens = await requestService.getPushTokensForDonor(item.donorId);
      if (deviceTokens.length === 0) {
        // No registered device tokens
        await this.markFailed(item.id, item.requestId, item.donorId, 'No push tokens registered', workerId);
        failedCount++;
        continue;
      }

      // 3. Dispatch push notification via FCM
      const responseToken = createDonorResponseToken(item.requestId, item.donorId);
      let dispatchSuccess = false;
      let lastResult: any = null;
      let dispatchError: string | null = null;

      try {
        lastResult = await pushNotificationService.sendDonationRequest({
          tokens: deviceTokens,
          requestId: item.requestId,
          responseToken,
          bloodGroup: req.bloodGroupNeeded,
          distanceKm: 5,
          language: 'en',
        });

        if (lastResult?.success) {
          dispatchSuccess = true;
        } else {
          dispatchError = lastResult?.error || 'Push provider returned failure';
        }
      } catch (err: any) {
        dispatchError = err?.message || 'Unexpected push dispatch exception';
      }

      if (dispatchSuccess) {
        const ok = await this.markSent(item.id, item.requestId, item.donorId, lastResult?.messageId ?? null, workerId);
        if (ok) sentCount++;
      } else {
        if (item.attempts >= item.maxAttempts) {
          const ok = await this.markExhausted(item.id, item.requestId, item.donorId, dispatchError, workerId);
          if (ok) exhaustedCount++;
        } else {
          const backoffSeconds = Math.min(300, Math.pow(2, item.attempts) * 2);
          const ok = await this.markRetry(item.id, item.requestId, item.donorId, backoffSeconds, dispatchError, workerId);
          if (ok) failedCount++;
        }
      }

      // 4. Prune dead or unregistered FCM tokens
      if (lastResult?.invalidTokens && Array.isArray(lastResult.invalidTokens)) {
        for (const invalidToken of lastResult.invalidTokens) {
          await requestService.removePushSubscriptionToken(item.donorId, invalidToken);
        }
      }
    }

    return {
      queuedCount: claimed.length,
      sentCount,
      failedCount,
      exhaustedCount,
      cancelledCount,
    };
  }

  /**
   * Process the next available batch of notifications.
   */
  public async processNextBatch(
    workerId: string = this.currentWorkerId,
    limit: number = 10
  ): Promise<OutboxDispatchSummary> {
    const claimed = await this.claimBatch(workerId, limit);
    if (claimed.length === 0) {
      return {
        queuedCount: 0,
        sentCount: 0,
        failedCount: 0,
        exhaustedCount: 0,
        cancelledCount: 0,
      };
    }
    return await this.processClaimed(claimed, workerId);
  }

  /**
   * Start recurring background polling worker.
   */
  public startWorker(workerId?: string, pollIntervalMs: number = 3000): void {
    if (this.workerTimer) return;
    if (workerId) this.currentWorkerId = workerId;
    this.workerTimer = setInterval(() => {
      void this.processNextBatch(this.currentWorkerId, 10);
    }, pollIntervalMs);
  }

  /**
   * Stop recurring background polling worker.
   */
  public stopWorker(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  /**
   * Observability: Aggregate status distribution for outbox records.
   */
  public async getOutboxMetrics(): Promise<OutboxMetrics> {
    const defaultMetrics: OutboxMetrics = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      exhausted: 0,
      cancelled: 0,
      total: 0,
    };

    if (!this.isLiveDb()) {
      const all = mockStore.getAllNotifications();
      defaultMetrics.total = all.length;
      for (const n of all) {
        if (n.status in defaultMetrics) {
          (defaultMetrics as any)[n.status]++;
        }
      }
      return defaultMetrics;
    }

    try {
      const rows = await db.execute(sql`
        SELECT status, count(*)::int as count
        FROM donor_notifications
        GROUP BY status;
      `);

      for (const r of rows as unknown as Array<{ status: string; count: number }>) {
        const count = Number(r.count) || 0;
        defaultMetrics.total += count;
        if (r.status in defaultMetrics) {
          (defaultMetrics as any)[r.status] = count;
        }
      }
      return defaultMetrics;
    } catch (err) {
      console.error('[@repo/api] Error fetching outbox metrics:', err);
      return defaultMetrics;
    }
  }

  /**
   * Renew worker lease on an actively processing notification.
   */
  public async renewLease(
    id: string,
    workerId: string = this.currentWorkerId
  ): Promise<boolean> {
    if (!this.isLiveDb()) return true;
    try {
      const rows = await db.execute(sql`
        UPDATE donor_notifications
        SET locked_at = NOW()
        WHERE id = ${id} AND locked_by = ${workerId}
        RETURNING id;
      `);
      return Boolean(rows && rows.length > 0);
    } catch {
      return false;
    }
  }

  private async markTerminal(
    id: string,
    requestId: string,
    donorId: string,
    terminalStatus: string,
    workerId: string = this.currentWorkerId
  ): Promise<boolean> {
    if (this.isLiveDb()) {
      const rows = await db.execute(sql`
        UPDATE donor_notifications
        SET status = 'cancelled',
            locked_by = NULL,
            locked_at = NULL,
            error_details = ${'Terminal request state: ' + terminalStatus}
        WHERE id = ${id} AND (locked_by = ${workerId} OR locked_by IS NULL)
        RETURNING id;
      `);
      if (!rows || rows.length === 0) {
        console.warn(`[@repo/api] Stale lease: worker ${workerId} lost lock for notification ${id}. Update discarded.`);
        return false;
      }
    }
    mockStore.setNotificationDelivery(requestId, donorId, 'cancelled');
    return true;
  }

  private async markSent(
    id: string,
    requestId: string,
    donorId: string,
    pushMessageId: string | null,
    workerId: string = this.currentWorkerId
  ): Promise<boolean> {
    if (this.isLiveDb()) {
      const rows = await db.execute(sql`
        UPDATE donor_notifications
        SET status = 'sent',
            push_message_id = ${pushMessageId},
            sent_at = NOW(),
            locked_by = NULL,
            locked_at = NULL,
            error_details = NULL
        WHERE id = ${id} AND (locked_by = ${workerId} OR locked_by IS NULL)
        RETURNING id;
      `);
      if (!rows || rows.length === 0) {
        console.warn(`[@repo/api] Stale lease: worker ${workerId} lost lock for notification ${id}. Overwrite prevented.`);
        return false;
      }
    }
    mockStore.setNotificationDelivery(requestId, donorId, 'sent');
    return true;
  }

  private async markFailed(
    id: string,
    requestId: string,
    donorId: string,
    error: string | null,
    workerId: string = this.currentWorkerId
  ): Promise<boolean> {
    if (this.isLiveDb()) {
      const rows = await db.execute(sql`
        UPDATE donor_notifications
        SET status = 'failed',
            locked_by = NULL,
            locked_at = NULL,
            error_details = ${error}
        WHERE id = ${id} AND (locked_by = ${workerId} OR locked_by IS NULL)
        RETURNING id;
      `);
      if (!rows || rows.length === 0) return false;
    }
    mockStore.setNotificationDelivery(requestId, donorId, 'failed');
    return true;
  }

  private async markExhausted(
    id: string,
    requestId: string,
    donorId: string,
    error: string | null,
    workerId: string = this.currentWorkerId
  ): Promise<boolean> {
    if (this.isLiveDb()) {
      const rows = await db.execute(sql`
        UPDATE donor_notifications
        SET status = 'exhausted',
            locked_by = NULL,
            locked_at = NULL,
            error_details = ${error}
        WHERE id = ${id} AND (locked_by = ${workerId} OR locked_by IS NULL)
        RETURNING id;
      `);
      if (!rows || rows.length === 0) return false;
    }
    mockStore.setNotificationDelivery(requestId, donorId, 'exhausted');
    return true;
  }

  private async markRetry(
    id: string,
    requestId: string,
    donorId: string,
    backoffSeconds: number,
    error: string | null,
    workerId: string = this.currentWorkerId
  ): Promise<boolean> {
    if (this.isLiveDb()) {
      const rows = await db.execute(sql`
        UPDATE donor_notifications
        SET status = 'pending',
            next_retry_at = NOW() + (${backoffSeconds} * INTERVAL '1 second'),
            locked_by = NULL,
            locked_at = NULL,
            error_details = ${error}
        WHERE id = ${id} AND (locked_by = ${workerId} OR locked_by IS NULL)
        RETURNING id;
      `);
      if (!rows || rows.length === 0) return false;
    }
    mockStore.setNotificationDelivery(requestId, donorId, 'pending');
    return true;
  }
}

export const notificationOutbox = new NotificationOutboxService();
