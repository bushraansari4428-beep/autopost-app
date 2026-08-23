const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`SELECT v.title, u."createdAt" FROM "UploadHistory" u JOIN "Video" v ON u."videoId" = v.id WHERE v."sourceId" = 'f3a86aef-9148-48a1-a0f1-b867ff946071' AND u.status = 'COMPLETED'`);
  console.log(res.rows);
  
  await client.end();
}

run().catch(console.error);
