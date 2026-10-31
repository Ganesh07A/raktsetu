import { db, sql } from './index';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('Clearing test user, donor, and request records from PostgreSQL...');
  
  await db.execute(
    sql`TRUNCATE TABLE donor_push_subscriptions, donor_notifications, donor_profiles, blood_requests, users CASCADE;`
  );

  console.log('✅ Successfully cleared all user and donor records! Blood banks and stock preserved.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to clean database:', err);
  process.exit(1);
});

