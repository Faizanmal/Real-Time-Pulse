require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    console.log('Public tables:', res.rows.map(r => r.tablename));
  } catch (err) {
    console.error('DB check failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();