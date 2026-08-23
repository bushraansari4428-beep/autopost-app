const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkPending() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace('6543', '5432')
  });
  await client.connect();

  const res = await client.query(`
    SELECT u.id, v.title, u.status, u."createdAt"
    FROM "UploadHistory" u
    JOIN "Video" v ON u."videoId" = v.id
    WHERE u.status IN ('PENDING', 'PROCESSING')
    ORDER BY u."createdAt" DESC;
  `);

  for (const row of res.rows) {
    console.log(`[${row.createdAt.toISOString()}] ${row.status}: ${row.title}`);
  }
  
  if (res.rows.length > 0) {
     console.log('Deleting them to stop the spam...');
     await client.query(`
       DELETE FROM "UploadHistory" WHERE status = 'PENDING';
     `);
     
     await client.query(`
       UPDATE "UploadHistory" SET status = 'FAILED', "errorMessage" = 'Cancelled by system' WHERE status = 'PROCESSING';
     `);
     console.log('Cleaned up!');
  }
  
  await client.end();
}

checkPending().catch(console.error);
