import postgres from 'postgres';
import * as schema from '../src/schema/index';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function run() {
  const tables = ['blood_requests', 'donor_profiles', 'users', 'donor_push_subscriptions'];
  for (const tableName of tables) {
    const cols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${tableName}
    `;
    const existing = new Set(cols.map(c => c.column_name));
    console.log(`Table ${tableName} existing columns:`, Array.from(existing));
  }
  await sql.end();
}

run().catch(console.error);
