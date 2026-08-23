const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const res = await client.query(`SELECT COUNT(*) FROM "Video" WHERE id NOT IN (SELECT "videoId" FROM "UploadHistory" WHERE "facebookPostId" != 'MEGA_CLOUD_UPLOAD')`);
  console.log('Remaining Videos:', res.rows[0].count);
  await client.end();
}

main().catch(console.error);
