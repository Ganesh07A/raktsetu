import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function run() {
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'blood_requests'
    ORDER BY ordinal_position
  `;
  console.log('Columns of blood_requests:');
  console.table(cols.map(c => ({
    name: c.column_name,
    type: c.data_type,
  })));

  await sql.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
