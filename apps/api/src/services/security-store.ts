import {
  db,
  idempotencyKeys,
  otpSessions,
  consumedTicketNonces,
  rateLimitCounters,
  eq,
  and,
  gt,
  sql,
} from '@repo/db';

export interface StoredOtpSession {
  phone: string;
  purpose: string;
  hashedOtp: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  lastSentAt: number;
}

const IS_TEST_RUNNER =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.BUN_TEST) ||
  typeof (globalThis as any).describe === 'function' ||
  process.argv.some((a) => a.includes('test'));

export class SecurityStore {
  // In-memory fallbacks for unit tests & offline environments
  private memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
  private memoryIdempotency = new Map<string, { response: any; createdAt: number; expiresAt: number }>();
  private memoryOtpSessions = new Map<string, StoredOtpSession>();
  private memoryConsumedNonces = new Set<string>();

  public isLiveDb(): boolean {
    if (IS_TEST_RUNNER) {
      return Boolean(process.env.TEST_LIVE_DB === 'true' && process.env.DATABASE_URL);
    }
    return Boolean(
      process.env.NODE_ENV !== 'test' &&
      process.env.DATABASE_URL &&
      db &&
      process.env.MOCK_SERVICES !== 'true'
    );
  }

  // ==========================================
  // 1. DISTRIBUTED RATE LIMITING
  // ==========================================
  public async incrementRateLimit(
    key: string,
    windowMs: number
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const resetDate = new Date(now + windowMs);

    if (this.isLiveDb()) {
      try {
        const rows = await db
          .insert(rateLimitCounters)
          .values({
            key,
            points: 1,
            resetAt: resetDate,
          })
          .onConflictDoUpdate({
            target: rateLimitCounters.key,
            set: {
              points: sql`CASE WHEN rate_limit_counters.reset_at < NOW() THEN 1 ELSE rate_limit_counters.points + 1 END`,
              resetAt: sql`CASE WHEN rate_limit_counters.reset_at < NOW() THEN ${resetDate} ELSE rate_limit_counters.reset_at END`,
            },
          })
          .returning();

        const row = rows[0];
        if (row) {
          return {
            count: row.points,
            resetAt: new Date(row.resetAt).getTime(),
          };
        }
      } catch (err) {
        console.error('[@repo/api] Shared rate limit database operation failed:', err);
        // In production, fail-closed for sensitive security thresholds
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SHARED_RATE_LIMITER_UNAVAILABLE');
        }
      }
    }

    // In-memory fallback
    const existing = this.memoryRateLimits.get(key);
    if (!existing || now >= existing.resetAt) {
      const record = { count: 1, resetAt: now + windowMs };
      this.memoryRateLimits.set(key, record);
      return record;
    }
    existing.count += 1;
    return existing;
  }

  // ==========================================
  // 2. DISTRIBUTED IDEMPOTENCY
  // ==========================================
  public async getIdempotency(key: string): Promise<any | null> {
    const now = Date.now();

    if (this.isLiveDb()) {
      try {
        const rows = await db
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.key, key), gt(idempotencyKeys.expiresAt, new Date(now))))
          .limit(1);

        if (rows[0]) {
          return rows[0].responsePayload;
        }
        return null;
      } catch (err) {
        console.error('[@repo/api] Shared idempotency lookup failed:', err);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SHARED_IDEMPOTENCY_STORE_UNAVAILABLE');
        }
      }
    }

    const cached = this.memoryIdempotency.get(key);
    if (cached && now < cached.expiresAt) {
      return cached.response;
    }
    return null;
  }

  public async saveIdempotency(
    key: string,
    responsePayload: any,
    requesterId?: string | null,
    operation: string = 'create_blood_request',
    ttlMs: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs);

    if (this.isLiveDb()) {
      try {
        await db
          .insert(idempotencyKeys)
          .values({
            key,
            requesterId: requesterId || null,
            operation,
            responsePayload,
            expiresAt,
          })
          .onConflictDoNothing();
        return;
      } catch (err) {
        console.error('[@repo/api] Shared idempotency save failed:', err);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SHARED_IDEMPOTENCY_STORE_UNAVAILABLE');
        }
      }
    }

    this.memoryIdempotency.set(key, {
      response: responsePayload,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  // ==========================================
  // 3. PERSISTENT OTP SESSIONS
  // ==========================================
  public async getOtpSession(phone: string, purpose: string): Promise<StoredOtpSession | null> {
    const normPhone = phone.replace(/\D/g, '').slice(-10);
    const key = `${normPhone}:${purpose}`;

    if (this.isLiveDb()) {
      try {
        const rows = await db
          .select()
          .from(otpSessions)
          .where(and(eq(otpSessions.phone, normPhone), eq(otpSessions.purpose, purpose)))
          .limit(1);

        if (rows[0]) {
          return {
            phone: rows[0].phone,
            purpose: rows[0].purpose,
            hashedOtp: rows[0].hashedOtp,
            attempts: rows[0].attempts,
            maxAttempts: rows[0].maxAttempts,
            expiresAt: new Date(rows[0].expiresAt).getTime(),
            lastSentAt: new Date(rows[0].lastSentAt).getTime(),
          };
        }
        return null;
      } catch (err) {
        console.error('[@repo/api] Shared OTP session lookup failed:', err);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SHARED_OTP_STORE_UNAVAILABLE');
        }
      }
    }

    return this.memoryOtpSessions.get(key) || null;
  }

  public async saveOtpSession(session: StoredOtpSession): Promise<void> {
    const normPhone = session.phone.replace(/\D/g, '').slice(-10);
    const key = `${normPhone}:${session.purpose}`;

    if (this.isLiveDb()) {
      try {
        await db
          .insert(otpSessions)
          .values({
            phone: normPhone,
            purpose: session.purpose,
            hashedOtp: session.hashedOtp,
            attempts: session.attempts,
            maxAttempts: session.maxAttempts,
            expiresAt: new Date(session.expiresAt),
            lastSentAt: new Date(session.lastSentAt),
          })
          .onConflictDoUpdate({
            target: [otpSessions.phone, otpSessions.purpose],
            set: {
              hashedOtp: session.hashedOtp,
              attempts: session.attempts,
              maxAttempts: session.maxAttempts,
              expiresAt: new Date(session.expiresAt),
              lastSentAt: new Date(session.lastSentAt),
            },
          });
        return;
      } catch (err) {
        console.error('[@repo/api] Shared OTP session save failed:', err);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SHARED_OTP_STORE_UNAVAILABLE');
        }
      }
    }

    this.memoryOtpSessions.set(key, session);
  }

  public async deleteOtpSession(phone: string, purpose: string): Promise<void> {
    const normPhone = phone.replace(/\D/g, '').slice(-10);
    const key = `${normPhone}:${purpose}`;

    if (this.isLiveDb()) {
      try {
        await db
          .delete(otpSessions)
          .where(and(eq(otpSessions.phone, normPhone), eq(otpSessions.purpose, purpose)));
      } catch (err) {
        console.error('[@repo/api] Shared OTP session delete failed:', err);
      }
    }

    this.memoryOtpSessions.delete(key);
  }

  // ==========================================
  // 4. ATOMIC TICKET NONCE CONSUMPTION
  // ==========================================
  public async consumeTicketNonce(
    nonce: string,
    phone: string,
    purpose: string,
    expiresAtEpochSec: number
  ): Promise<{ success: boolean; error?: string }> {
    const normPhone = phone.replace(/\D/g, '').slice(-10);
    const expiresAt = new Date(expiresAtEpochSec * 1000);

    if (this.isLiveDb()) {
      try {
        await db.insert(consumedTicketNonces).values({
          nonce,
          phone: normPhone,
          purpose,
          expiresAt,
        });
        return { success: true };
      } catch (err: any) {
        if (
          err?.code === '23505' ||
          err?.message?.includes('duplicate key') ||
          err?.message?.includes('unique')
        ) {
          return { success: false, error: 'Verification ticket has already been used' };
        }
        console.error('[@repo/api] Shared ticket nonce consumption failed:', err);
        if (process.env.NODE_ENV === 'production') {
          return { success: false, error: 'Database service unavailable during ticket verification' };
        }
      }
    }

    if (this.memoryConsumedNonces.has(nonce)) {
      return { success: false, error: 'Verification ticket has already been used' };
    }
    this.memoryConsumedNonces.add(nonce);
    return { success: true };
  }

  // ==========================================
  // TEST UTILITIES
  // ==========================================
  public clear(): void {
    this.memoryRateLimits.clear();
    this.memoryIdempotency.clear();
    this.memoryOtpSessions.clear();
    this.memoryConsumedNonces.clear();
  }
}

export const securityStore = new SecurityStore();
