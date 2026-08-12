const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const res = await client.query(`SELECT level, message, "createdAt" FROM "Log" WHERE message LIKE '%Auto-deleted%' ORDER BY "createdAt" DESC`);
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
