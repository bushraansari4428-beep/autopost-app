const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const res = await client.query(`SELECT level, message, "createdAt" FROM "Log" ORDER BY "createdAt" DESC LIMIT 15`);
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
