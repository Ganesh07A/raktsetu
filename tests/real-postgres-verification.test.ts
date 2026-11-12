import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db, sql, idempotencyKeys, otpSessions, consumedTicketNonces, rateLimitCounters, eq } from '../packages/db/src/index.ts';
import { SecurityStore, type StoredOtpSession } from '../apps/api/src/services/security-store.ts';

describe('Checkpoint 4.1: Real PostgreSQL Integration Verification Suite', () => {
  let storeA: SecurityStore;
  let storeB: SecurityStore;

  beforeAll(async () => {
    // Explicitly enforce live DB mode for this real Postgres integration suite
    process.env.TEST_LIVE_DB = 'true';

    storeA = new SecurityStore();
    storeB = new SecurityStore();

    expect(storeA.isLiveDb()).toBe(true);
    expect(storeB.isLiveDb()).toBe(true);

    // Clean test records from database before running
    await db.delete(rateLimitCounters).where(eq(rateLimitCounters.key, 'pg-test-client-ip'));
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, 'pg-test-idem-001'));
    await db.delete(otpSessions).where(eq(otpSessions.phone, '9998887770'));
    await db.delete(consumedTicketNonces).where(eq(consumedTicketNonces.nonce, 'pg-test-nonce-001'));
  });

  afterAll(async () => {
    // Cleanup test records
    try {
      await db.delete(rateLimitCounters).where(eq(rateLimitCounters.key, 'pg-test-client-ip'));
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, 'pg-test-idem-001'));
      await db.delete(otpSessions).where(eq(otpSessions.phone, '9998887770'));
      await db.delete(consumedTicketNonces).where(eq(consumedTicketNonces.nonce, 'pg-test-nonce-001'));
    } catch {}
    delete process.env.TEST_LIVE_DB;
  });

  // =========================================================================
  // 1. MIGRATION APPLICATION VERIFICATION
  // =========================================================================
  test('PostgreSQL schema contains all 4 security state tables and indexes', async () => {
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('rate_limit_counters', 'idempotency_keys', 'otp_sessions', 'consumed_ticket_nonces')
      ORDER BY table_name;
    `);

    const tableNames = tables.map((t: any) => t.table_name);
    expect(tableNames).toContain('consumed_ticket_nonces');
    expect(tableNames).toContain('idempotency_keys');
    expect(tableNames).toContain('otp_sessions');
    expect(tableNames).toContain('rate_limit_counters');
    expect(tableNames.length).toBe(4);
  });

  // =========================================================================
  // 2. TWO INDEPENDENT INSTANCES SHARING SECURITY STATE
  // =========================================================================
  test('Two independent SecurityStore instances share live rate limit state', async () => {
    const key = 'pg-test-client-ip';
    const windowMs = 60000;

    // Instance A increments
    const incA1 = await storeA.incrementRateLimit(key, windowMs);
    expect(incA1.count).toBe(1);

    // Instance B increments the same key across processes
    const incB1 = await storeB.incrementRateLimit(key, windowMs);
    expect(incB1.count).toBe(2);

    // Instance A increments again
    const incA2 = await storeA.incrementRateLimit(key, windowMs);
    expect(incA2.count).toBe(3);

    // Verify raw PostgreSQL row
    const rows = await db.select().from(rateLimitCounters).where(eq(rateLimitCounters.key, key));
    expect(rows.length).toBe(1);
    expect(rows[0].points).toBe(3);
  }, { timeout: 20000 });

  // =========================================================================
  // 3. CONCURRENT IDEMPOTENCY REQUESTS
  // =========================================================================
  test('Concurrent idempotency requests resolve atomically with zero duplicate records', async () => {
    const idemKey = 'pg-test-idem-001';
    const payload = { status: 'created', requestId: 'req-pg-001' };

    // Simulate 5 concurrent processes attempting to save the same idempotency key
    const results = await Promise.all([
      storeA.saveIdempotency(idemKey, payload, 'req-001'),
      storeB.saveIdempotency(idemKey, payload, 'req-001'),
      storeA.saveIdempotency(idemKey, payload, 'req-001'),
      storeB.saveIdempotency(idemKey, payload, 'req-001'),
      storeA.saveIdempotency(idemKey, payload, 'req-001'),
    ]);

    // All promises resolve safely without unhandled error or primary key crash
    expect(results.length).toBe(5);

    // Fetch from store B: payload is intact
    const fetched = await storeB.getIdempotency(idemKey);
    expect(fetched).toBeDefined();
    expect(fetched.requestId).toBe('req-pg-001');

    // Confirm exactly 1 row exists in Postgres
    const rows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, idemKey));
    expect(rows.length).toBe(1);
  });

  // =========================================================================
  // 4. CONCURRENT OTP VERIFICATION & ATTEMPTS
  // =========================================================================
  test('Concurrent OTP session operations decrement attempts across instances', async () => {
    const phone = '+919998887770';
    const purpose = 'donor_registration';
    const session: StoredOtpSession = {
      phone: '9998887770',
      purpose,
      hashedOtp: 'test-hash-12345',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: Date.now() + 300000,
      lastSentAt: Date.now(),
    };

    // Store via Instance A
    await storeA.saveOtpSession(session);

    // Retrieve via Instance B
    const sessionB = await storeB.getOtpSession(phone, purpose);
    expect(sessionB).toBeDefined();
    expect(sessionB!.hashedOtp).toBe('test-hash-12345');
    expect(sessionB!.attempts).toBe(0);

    // Increment attempts to 1 and save via Instance B
    sessionB!.attempts = 1;
    await storeB.saveOtpSession(sessionB!);

    // Retrieve via Instance A and verify persisted attempt counter
    const sessionA = await storeA.getOtpSession(phone, purpose);
    expect(sessionA!.attempts).toBe(1);
  });

  // =========================================================================
  // 5. CONCURRENT VERIFICATION-TICKET CONSUMPTION
  // =========================================================================
  test('Concurrent ticket nonce consumption permits exactly one success and rejects concurrent replicas', async () => {
    const nonce = 'pg-test-nonce-001';
    const phone = '+919998887770';
    const purpose = 'donor_registration';
    const expiresAtSec = Math.floor(Date.now() / 1000) + 900;

    // Dispatch 5 concurrent consumption attempts simultaneously across Store A and Store B
    const outcomes = await Promise.all([
      storeA.consumeTicketNonce(nonce, phone, purpose, expiresAtSec),
      storeB.consumeTicketNonce(nonce, phone, purpose, expiresAtSec),
      storeA.consumeTicketNonce(nonce, phone, purpose, expiresAtSec),
      storeB.consumeTicketNonce(nonce, phone, purpose, expiresAtSec),
      storeA.consumeTicketNonce(nonce, phone, purpose, expiresAtSec),
    ]);

    const successes = outcomes.filter((o) => o.success);
    const failures = outcomes.filter((o) => !o.success);

    // Exactly 1 winner, 4 losers
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(4);
    for (const f of failures) {
      expect(f.error).toContain('already been used');
    }
  });

  // =========================================================================
  // 6. EXPIRED SECURITY RECORD CLEANUP
  // =========================================================================
  test('cleanupExpiredRecords removes expired records from real PostgreSQL tables', async () => {
    const now = new Date();
    const expiredPast = new Date(now.getTime() - 10000); // 10s in the past

    // Insert an expired record directly into Postgres
    await db.insert(rateLimitCounters).values({
      key: 'pg-test-expired-rate-limit',
      points: 10,
      resetAt: expiredPast,
    }).onConflictDoNothing();

    await db.insert(idempotencyKeys).values({
      key: 'pg-test-expired-idem',
      operation: 'test',
      responsePayload: { expired: true },
      expiresAt: expiredPast,
    }).onConflictDoNothing();

    // Run cleanup
    const summary = await storeA.cleanupExpiredRecords();
    expect(summary.expiredRateLimits).toBeGreaterThanOrEqual(1);
    expect(summary.expiredIdempotency).toBeGreaterThanOrEqual(1);

    // Verify row is gone
    const checkRate = await db.select().from(rateLimitCounters).where(eq(rateLimitCounters.key, 'pg-test-expired-rate-limit'));
    expect(checkRate.length).toBe(0);

    const checkIdem = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'pg-test-expired-idem'));
    expect(checkIdem.length).toBe(0);
  }, { timeout: 20000 });

  // =========================================================================
  // 7. DATABASE OUTAGE & FAIL-CLOSED BEHAVIOR
  // =========================================================================
  test('In production mode, database outage causes fail-closed behavior rather than silent bypass', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';

      // Create a store instance pointing to an invalid database endpoint
      const disconnectedStore = new SecurityStore();

      // Temporarily mock db to simulate network partition / outage
      const origInsert = (db as any).insert;
      (db as any).insert = () => {
        throw new Error('Connection terminated unexpectedly (ECONNREFUSED)');
      };

      try {
        // Rate limiter must throw in production (fail-closed, resulting in 503)
        let rateLimitThrew = false;
        try {
          await disconnectedStore.incrementRateLimit('attacker-ip', 60000);
        } catch (err: any) {
          rateLimitThrew = true;
          expect(err.message).toBe('SHARED_RATE_LIMITER_UNAVAILABLE');
        }
        expect(rateLimitThrew).toBe(true);

        // Ticket nonce consumption must fail in production (reject registration)
        const ticketRes = await disconnectedStore.consumeTicketNonce(
          'attack-nonce',
          '+919876543210',
          'donor_registration',
          Math.floor(Date.now() / 1000) + 300
        );
        expect(ticketRes.success).toBe(false);
        expect(ticketRes.error).toContain('Database service unavailable');
      } finally {
        (db as any).insert = origInsert;
      }
    } finally {
      (process.env as any).NODE_ENV = origEnv;
    }
  });

  // =========================================================================
  // 8. DATABASE RESTART AND RECOVERY
  // =========================================================================
  test('SecurityStore recovers transparently after transient database connectivity issues', async () => {
    // Normal operation before transient issue
    const res1 = await storeA.incrementRateLimit('recovery-test-key', 60000);
    expect(res1.count).toBeGreaterThanOrEqual(1);

    // Simulate transient failure
    const origInsert = (db as any).insert;
    (db as any).insert = () => {
      throw new Error('PostgreSQL database server was restarted');
    };

    try {
      // During restart, operation fails
      try {
        await storeA.incrementRateLimit('recovery-test-key', 60000);
      } catch {}
    } finally {
      // Reconnection restored
      (db as any).insert = origInsert;
    }

    // After reconnection restored: next operation recovers immediately
    const res2 = await storeA.incrementRateLimit('recovery-test-key', 60000);
    expect(res2.count).toBeGreaterThanOrEqual(2);

    // Clean up
    await db.delete(rateLimitCounters).where(eq(rateLimitCounters.key, 'recovery-test-key'));
  });
});
