const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`SELECT id, "scheduledTime", "videosPerDay", "lastScheduledRun" FROM "Mapping"`);
  console.log(res.rows);
  
  await client.end();
}

run().catch(console.error);
