const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`SELECT id, status, "facebookPostId", "facebookPageId", "createdAt" FROM "UploadHistory" WHERE status = 'COMPLETED' AND "facebookPostId" != 'MEGA_CLOUD_UPLOAD' ORDER BY "createdAt" DESC LIMIT 10`);
  console.log(res.rows);
  
  await client.end();
}

run().catch(console.error);
