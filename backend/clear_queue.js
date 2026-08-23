const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  // Set all PENDING or PROCESSING Mega Cloud uploads to FAILED to clear the queue
  // (We'll only clear the ones for "Hidden Underwater Steps" or any that are stuck)
  const res = await client.query(`
    UPDATE "UploadHistory" 
    SET status = 'FAILED', "errorMessage" = 'Manually failed to unblock queue'
    WHERE status IN ('PENDING', 'PROCESSING') 
    AND "videoId" IN (
       SELECT id FROM "Video" WHERE title LIKE '%Hidden Underwater Steps%' OR title LIKE '%Baby mouse deer%' OR title LIKE '%Bull Meet Rabbit%' OR title LIKE '%Fennec Fox%'
    )
  `);
  
  console.log(`Updated ${res.rowCount} stuck Mega Cloud videos.`);
  await client.end();
}
main().catch(console.error);
