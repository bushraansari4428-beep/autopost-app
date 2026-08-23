const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`SELECT message, "createdAt" FROM "Log" WHERE "createdAt" > '2026-08-23T02:20:00Z' AND "createdAt" < '2026-08-23T02:33:00Z' ORDER BY "createdAt" ASC LIMIT 15`);
  console.log(res.rows);
  
  await client.end();
}

run().catch(console.error);
