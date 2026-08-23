const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const res = await client.query(`
    SELECT u.id, v.title, u.status, u."createdAt", u."facebookPostId"
    FROM "UploadHistory" u
    JOIN "Video" v ON u."videoId" = v.id
    WHERE u."facebookPageId" = '0c6e25ff-b9ea-4203-9096-995c1be7a919'
    ORDER BY u."createdAt" DESC
    LIMIT 10
  `);
  console.table(res.rows);
  await client.end();
}
main().catch(console.error);
