const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkProcessing() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`
    SELECT "videoId", "status", "createdAt", "updatedAt"
    FROM "UploadHistory"
    WHERE "status" IN ('PROCESSING', 'PENDING');
  `);

  if (res.rows.length === 0) {
    console.log("No PROCESSING or PENDING uploads found.");
  } else {
    console.log(res.rows);
  }
  
  await client.end();
}

checkProcessing().catch(console.error);
