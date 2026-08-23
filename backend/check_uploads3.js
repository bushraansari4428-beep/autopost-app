const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`SELECT u.id, u.status, u."facebookPostId", u."facebookPageId", u."createdAt", v."sourceId" FROM "UploadHistory" u JOIN "Video" v ON u."videoId" = v.id WHERE u.status = 'COMPLETED' AND u."facebookPostId" != 'MEGA_CLOUD_UPLOAD' ORDER BY u."createdAt" DESC LIMIT 10`);
  console.log(res.rows);
  
  await client.end();
}

run().catch(console.error);
