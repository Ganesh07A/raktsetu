import { describe, expect, test } from 'bun:test';
import { db, sql } from '../packages/db/src/index.ts';

describe('Phase B: Staging Database Schema & Migration Verification', () => {
  test('1. Verify target database is staging Supabase instance and isolated', async () => {
    const rawUrl = process.env.DATABASE_URL || '';
    expect(rawUrl).toContain('aws-0-eu-north-1.pooler.supabase.com');
    expect(rawUrl).toContain('6543');

    const result = await db.execute(sql`SELECT current_database(), current_user, version();`);
    expect(result.length).toBe(1);
    const row = result[0] as any;
    expect(row.current_database).toBe('postgres');
    expect(row.version).toContain('PostgreSQL 17');
  });

  test('2. Verify all four shared security state tables exist', async () => {
    const query = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('rate_limit_counters', 'idempotency_keys', 'otp_sessions', 'consumed_ticket_nonces')
      ORDER BY table_name;
    `;
    const res = await db.execute(query);
    const tableNames = res.map((r: any) => r.table_name);
    expect(tableNames).toContain('rate_limit_counters');
    expect(tableNames).toContain('idempotency_keys');
    expect(tableNames).toContain('otp_sessions');
    expect(tableNames).toContain('consumed_ticket_nonces');
    expect(tableNames.length).toBe(4);
  });

  test('3. Verify donor_notifications has lease_token and outbox columns', async () => {
    const query = sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'donor_notifications' 
        AND column_name IN ('id', 'status', 'attempts', 'locked_at', 'locked_by', 'lease_token', 'fcm_message_id', 'last_error')
      ORDER BY column_name;
    `;
    const res = await db.execute(query);
    const cols = res.map((r: any) => r.column_name);
    expect(cols).toContain('lease_token');
    expect(cols).toContain('locked_by');
    expect(cols).toContain('locked_at');
    expect(cols).toContain('attempts');
    expect(cols).toContain('status');
  });

  test('4. Verify indexes exist on security tables and donor_notifications', async () => {
    const query = sql`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('rate_limit_counters', 'idempotency_keys', 'otp_sessions', 'consumed_ticket_nonces', 'donor_notifications')
      ORDER BY tablename, indexname;
    `;
    const res = await db.execute(query);
    const indexNames = res.map((r: any) => r.indexname);
    console.log('Staging database indexes on security/notification tables:', indexNames);
    
    // Check specific critical indexes
    expect(indexNames).toContain('notifications_lease_token_idx');
    expect(indexNames).toContain('notifications_outbox_queue_idx');
    expect(indexNames).toContain('otp_sessions_expires_at_idx');
    expect(indexNames).toContain('consumed_ticket_nonces_expires_at_idx');
  });

  test('5. Verify existing table data integrity', async () => {
    const donorCountRes = await db.execute(sql`SELECT count(*)::int as count FROM donor_profiles;`);
    const donorCount = (donorCountRes[0] as any).count;
    expect(typeof donorCount).toBe('number');
    expect(donorCount).toBeGreaterThanOrEqual(0);

    const reqCountRes = await db.execute(sql`SELECT count(*)::int as count FROM blood_requests;`);
    const reqCount = (reqCountRes[0] as any).count;
    expect(typeof reqCount).toBe('number');
    expect(reqCount).toBeGreaterThanOrEqual(0);
    console.log(`Current staging counts: ${donorCount} donors, ${reqCount} requests.`);
  });
});
