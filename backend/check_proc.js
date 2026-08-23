const fs = require('fs');
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkProcessing() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`
    SELECT "createdAt", level, message
    FROM "Log"
    WHERE message LIKE '%Already processing%'
    ORDER BY "createdAt" DESC
    LIMIT 5;
  `);

  if (res.rows.length === 0) {
    console.log("No 'Already processing' logs found.");
  } else {
    for (const row of res.rows) {
      console.log(`[${row.createdAt.toISOString()}] ${row.level}: ${row.message}`);
    }
  }
  
  await client.end();
}

checkProcessing().catch(console.error);
