import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[@repo/db] DATABASE_URL is not set.');
  process.exit(1);
}

// Strict safeguard: Only allow localhost / 127.0.0.1. No overrides permitted.
function validateLocalhostTarget(connectionString: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ SAFETY ABORT: Refusing to run rollback script in production environment.');
    process.exit(1);
  }

  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = new Set(['localhost', '127.0.0.1']);

    if (!allowedHosts.has(host)) {
      console.error(`⛔ SAFETY ABORT: Refusing to run rollback against non-localhost target host: "${host}".`);
      console.error('This script is strictly restricted to local development on localhost / 127.0.0.1.');
      console.error('Remote, cloud (Neon, Render), and unknown hosts are strictly prohibited.');
      process.exit(1);
    }
  } catch (err) {
    console.error('⛔ SAFETY ABORT: Unable to safely parse DATABASE_URL host. Execution aborted.');
    process.exit(1);
  }
}

validateLocalhostTarget(url);

const sql = postgres(url, { max: 1 });

async function run() {
  console.log('[@repo/db] Rolling back Telegram migration (dropping Telegram tables)...');

  await sql.unsafe(`
    DROP TABLE IF EXISTS telegram_notifications;
    DROP TABLE IF EXISTS telegram_link_tokens;
    DROP TABLE IF EXISTS donor_telegram_subscriptions;
  `);

  console.log('[@repo/db] Rollback completed: Telegram tables dropped successfully.');
  await sql.end();
}

run().catch((err) => {
  console.error('[@repo/db] Rollback failed:', err);
  process.exit(1);
});
