import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function run() {
  console.log('Applying migration: 20261112_outbox_lease_token.sql');
  await sql`
    ALTER TABLE donor_notifications ADD COLUMN IF NOT EXISTS lease_token text;
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_lease_token_idx ON donor_notifications(lease_token);
  `;
  console.log('Migration applied successfully.');
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

