const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkRecentLogs() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`
    SELECT "createdAt", level, message
    FROM "Log"
    ORDER BY "createdAt" DESC
    LIMIT 20;
  `);

  for (const row of res.rows) {
    console.log(`[${row.createdAt.toISOString()}] ${row.level}: ${row.message}`);
  }
  
  await client.end();
}

checkRecentLogs().catch(console.error);
