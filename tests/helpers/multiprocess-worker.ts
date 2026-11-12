import { SecurityStore } from '../../apps/api/src/services/security-store';
import { notificationOutbox } from '../../apps/api/src/services/notification-outbox';
import { db, sql } from '../../packages/db/src/index';

process.env.TEST_LIVE_DB = 'true';

const store = new SecurityStore();

const [command, ...args] = process.argv.slice(2);

async function main() {
  try {
    switch (command) {
      case 'ping': {
        console.log(JSON.stringify({ status: 'ok', pid: process.pid }));
        break;
      }

      case 'rate-limit': {
        const [key, windowMs] = args;
        const res = await store.incrementRateLimit(key, Number(windowMs));
        console.log(JSON.stringify({ ...res, pid: process.pid }));
        break;
      }

      case 'idempotency-get': {
        const [key] = args;
        const res = await store.getIdempotency(key);
        console.log(JSON.stringify({ result: res, pid: process.pid }));
        break;
      }

      case 'idempotency-save': {
        const [key, payloadBase64] = args;
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        await store.saveIdempotency(key, payload);
        console.log(JSON.stringify({ saved: true, pid: process.pid }));
        break;
      }

      case 'consume-nonce': {
        const [nonce, phone] = args;
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        const res = await store.consumeTicketNonce(nonce, phone, 'emergency_request', expiry);
        console.log(JSON.stringify({ ...res, pid: process.pid }));
        break;
      }

      case 'claim-outbox': {
        const [workerId, limit, staleTimeout] = args;
        const claimed = await notificationOutbox.claimBatch(
          workerId,
          Number(limit || 10),
          Number(staleTimeout || 120)
        );
        console.log(JSON.stringify({ claimedIds: claimed.map(c => c.id), pid: process.pid }));
        break;
      }

      case 'hold-lock-and-wait': {
        const [notifId, workerId] = args;
        await db.execute(sql`
          UPDATE donor_notifications
          SET status = 'processing',
              locked_by = ${workerId},
              locked_at = NOW(),
              attempts = attempts + 1
          WHERE id = ${notifId};
        `);
        console.log(JSON.stringify({ locked: true, pid: process.pid, id: notifId }));
        setInterval(() => {}, 1000);
        return;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.log(JSON.stringify({ error: err?.message, pid: process.pid }));
  }
  process.exit(0);
}

main();
