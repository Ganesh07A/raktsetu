import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function run() {
  const migrationPath = path.join(__dirname, '../migrations/20261112_durable_notification_outbox.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration:', migrationPath);
  await sql.unsafe(migrationSql);
  console.log('Migration applied successfully.');

  const cols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'donor_notifications'
    ORDER BY ordinal_position
  `;
  console.log('Updated columns:');
  console.table(cols.map(c => ({
    name: c.column_name,
    type: c.data_type,
    default: c.column_default,
    nullable: c.is_nullable
  })));

  await sql.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
