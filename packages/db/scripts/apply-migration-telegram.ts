import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[@repo/db] DATABASE_URL is not set.');
  process.exit(1);
}

// Strict safeguard: Only allow localhost / 127.0.0.1. No overrides permitted.
function validateLocalhostTarget(connectionString: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ SAFETY ABORT: Refusing to run local migration script in production environment.');
    process.exit(1);
  }

  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = new Set(['localhost', '127.0.0.1']);

    if (!allowedHosts.has(host)) {
      console.error(`⛔ SAFETY ABORT: Refusing to run migration against non-localhost target host: "${host}".`);
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
  const migrationPath = path.join(__dirname, '../migrations/20261119_telegram_integration.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('[@repo/db] Applying local Telegram migration:', migrationPath);
  await sql.unsafe(migrationSql);
  console.log('[@repo/db] Telegram migration applied successfully.');

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%telegram%'
    ORDER BY table_name
  `;
  console.log('[@repo/db] Verified Telegram tables:');
  console.table(tables);

  await sql.end();
}

run().catch((err) => {
  console.error('[@repo/db] Migration failed:', err);
  process.exit(1);
});
