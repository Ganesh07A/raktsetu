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
  const migrationPath = path.join(__dirname, '../migrations/20261112_blood_requests_matched_banks.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration:', migrationPath);
  await sql.unsafe(migrationSql);
  console.log('Migration applied successfully.');

  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'blood_requests'
    ORDER BY ordinal_position
  `;
  console.log('Updated columns in blood_requests:', cols.map(c => c.column_name));

  await sql.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

