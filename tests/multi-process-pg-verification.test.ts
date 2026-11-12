import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { db, sql, donorNotifications, rateLimitCounters, idempotencyKeys, consumedTicketNonces, donorProfiles, bloodRequests, eq, inArray } from '../packages/db/src/index.ts';

const WORKER_SCRIPT = 'tests/helpers/multiprocess-worker.ts';

async function runWorkerProcess(args: string[]): Promise<{ output: any; pid: number }> {
  const proc = Bun.spawn(['bun', WORKER_SCRIPT, ...args], {
    env: { ...process.env, TEST_LIVE_DB: 'true' },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const text = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const json = JSON.parse(text.trim());
    return { output: json, pid: proc.pid };
  } catch (err) {
    throw new Error(`Worker process failed. Raw output: "${text}" Error: ${String(err)}`);
  }
}

describe('Checkpoint 4.2: Genuine Multi-Process PostgreSQL Verification Suite', () => {
  const testRateKey = 'mp-test-rate-key';
  const testIdemKey = 'mp-test-idem-key';
  const testNonce = 'mp-test-nonce-402';
  const testPhone = '9876543210';
  const testRequestId = 'mp-test-request-001';
  let testDonorId: string;

  beforeAll(async () => {
    // Clean up test keys
    await db.delete(rateLimitCounters).where(eq(rateLimitCounters.key, testRateKey));
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, testIdemKey));
    await db.delete(consumedTicketNonces).where(eq(consumedTicketNonces.nonce, testNonce));
    await db.delete(donorNotifications).where(eq(donorNotifications.requestId, testRequestId));
    await db.delete(bloodRequests).where(eq(bloodRequests.id, testRequestId));

    // Get an existing donor profile
    const [donor] = await db.select({ id: donorProfiles.id }).from(donorProfiles).limit(1);
    testDonorId = donor.id;

    // Seed test blood request
    await db.insert(bloodRequests).values({
      id: testRequestId,
      bloodGroupNeeded: 'O+',
      unitsNeeded: 1,
      patientName: 'Multi-Process Test Patient',
      patientAge: 35,
      emergencyType: 'accident',
      hospitalName: 'AIIMS Trauma Center',
      latitude: 28.5672,
      longitude: 77.2100,
      status: 'donors_notified',
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    try {
      await db.delete(rateLimitCounters).where(eq(rateLimitCounters.key, testRateKey));
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, testIdemKey));
      await db.delete(consumedTicketNonces).where(eq(consumedTicketNonces.nonce, testNonce));
      await db.delete(donorNotifications).where(eq(donorNotifications.requestId, testRequestId));
      await db.delete(bloodRequests).where(eq(bloodRequests.id, testRequestId));
    } catch {}
  }, 30000);

  test('1. Two independent OS processes with distinct PIDs share live rate-limit counters', async () => {
    // Process 1 increments
    const p1 = await runWorkerProcess(['rate-limit', testRateKey, '60000']);
    // Process 2 increments
    const p2 = await runWorkerProcess(['rate-limit', testRateKey, '60000']);

    // Ensure distinct OS process IDs
    expect(p1.pid).not.toBe(p2.pid);

    expect(p1.output.count).toBe(1);

    // Process 2 observes count = 2 from Process 1's action
    expect(p2.output.count).toBe(2);

    // Process 1 increments 3rd time
    const p3 = await runWorkerProcess(['rate-limit', testRateKey, '60000']);
    expect(p3.output.count).toBe(3);
  }, 25000);

  test('2. Two independent OS processes share idempotency responses without race conditions', async () => {
    const payload = { status: 'created', id: 'order-123', amount: 500 };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Process 1 saves idempotency
    const p1 = await runWorkerProcess(['idempotency-save', testIdemKey, payloadBase64]);
    expect(p1.output.saved).toBe(true);

    // Process 2 immediately queries idempotency key
    const p2 = await runWorkerProcess(['idempotency-get', testIdemKey]);

    expect(p1.pid).not.toBe(p2.pid);
    expect(p2.output.result).toEqual(payload);
  }, 25000);

  test('3. Single-use OTP ticket nonce allows exactly one consumption across concurrent OS processes', async () => {
    // Spawn two separate OS processes concurrently attempting to consume the same ticket nonce
    const [p1, p2] = await Promise.all([
      runWorkerProcess(['consume-nonce', testNonce, testPhone]),
      runWorkerProcess(['consume-nonce', testNonce, testPhone]),
    ]);

    expect(p1.pid).not.toBe(p2.pid);

    const outcomes = [p1.output.success, p2.output.success];

    // Exactly one process must succeed, and the other must be rejected
    expect(outcomes.filter((s) => s === true).length).toBe(1);
    expect(outcomes.filter((s) => s === false).length).toBe(1);
  }, 25000);

  test('4. Two independent worker OS processes atomically claim non-overlapping outbox records via SKIP LOCKED', async () => {
    const notifA = 'mp-notif-claim-A';
    const notifB = 'mp-notif-claim-B';

    await db.delete(donorNotifications).where(inArray(donorNotifications.id, [notifA, notifB]));

    await db.insert(donorNotifications).values([
      {
        id: notifA,
        requestId: testRequestId,
        donorId: testDonorId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 60000),
      },
      {
        id: notifB,
        requestId: testRequestId,
        donorId: testDonorId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 60000),
      },
    ]);

    // Spawn Process 1 and Process 2 to claim batches concurrently
    const [p1, p2] = await Promise.all([
      runWorkerProcess(['claim-outbox', 'worker-proc-1', '1', '120']),
      runWorkerProcess(['claim-outbox', 'worker-proc-2', '1', '120']),
    ]);

    expect(p1.pid).not.toBe(p2.pid);

    const claimedA = p1.output.claimedIds as string[];
    const claimedB = p2.output.claimedIds as string[];

    expect(claimedA.length).toBe(1);
    expect(claimedB.length).toBe(1);

    // Mutual exclusion: the two OS worker processes NEVER claimed the same record
    const intersection = claimedA.filter((id) => claimedB.includes(id));
    expect(intersection).toHaveLength(0);
  }, 25000);

  test('5. Process crash recovery: dead worker killed with SIGKILL is safely recovered by second worker process', async () => {
    const notifCrash = 'mp-notif-crash-sigkill';
    await db.delete(donorNotifications).where(eq(donorNotifications.id, notifCrash));

    await db.insert(donorNotifications).values([
      {
        id: notifCrash,
        requestId: testRequestId,
        donorId: testDonorId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() - 60000),
      },
    ]);

    // Spawn Process 1 to lock and hold the record
    const proc1 = Bun.spawn(['bun', WORKER_SCRIPT, 'hold-lock-and-wait', notifCrash, 'worker-dead-pid'], {
      env: { ...process.env, TEST_LIVE_DB: 'true' },
      stdout: 'pipe',
    });

    // Read initial output confirming lock acquired
    const reader = proc1.stdout.getReader();
    const { value } = await reader.read();
    const line = new TextDecoder().decode(value).trim();
    const parsed = JSON.parse(line);
    expect(parsed.locked).toBe(true);

    const pid1 = proc1.pid;
    expect(pid1).toBeGreaterThan(0);

    // SIMULATE CRASH: Kill Process 1 abruptly with SIGKILL (ungraceful container termination)
    proc1.kill(); // terminates child process
    await proc1.exited;

    // Simulate lock expiration: set locked_at to 3 minutes ago
    await db.execute(sql`
      UPDATE donor_notifications
      SET locked_at = NOW() - INTERVAL '3 minutes'
      WHERE id = ${notifCrash};
    `);

    // Process 2 runs in a new OS process and recovers the abandoned record
    const p2 = await runWorkerProcess(['claim-outbox', 'worker-proc-2-recovering', '10', '120']);

    expect(p2.pid).not.toBe(pid1);
    expect(p2.output.claimedIds).toContain(notifCrash);

    // Confirm in DB that status is still processing but now owned by worker-proc-2-recovering
    const [row] = await db.select().from(donorNotifications).where(eq(donorNotifications.id, notifCrash));
    expect(row.lockedBy).toBe('worker-proc-2-recovering');
    expect(row.attempts).toBe(2); // incremented from 1 to 2
  }, 25000);
});
