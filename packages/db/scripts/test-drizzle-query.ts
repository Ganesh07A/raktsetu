import { db, sql } from '../src/index';

async function main() {
  const result = await db.execute(sql`SELECT count(*) as count FROM donor_notifications`);
  console.log('Result:', result);
  console.log('Type of result:', Array.isArray(result), result.length);
}

main().catch(console.error);
