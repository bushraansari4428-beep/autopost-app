const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ 
    connectionString: 'postgresql://postgres.swuwuzglxehiaogabmul:Pakistan887766551122@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    const logs = await pool.query('SELECT * FROM "Log" ORDER BY "createdAt" DESC LIMIT 15');
    console.log("=== RECENT SYSTEM LOGS ===");
    logs.rows.forEach(l => {
      console.log(`[${l.createdAt.toISOString()}] [${l.level}] ${l.message}`);
    });

    const uploads = await pool.query('SELECT * FROM "UploadHistory" ORDER BY "createdAt" DESC LIMIT 5');
    console.log("\n=== RECENT UPLOADS ===");
    for (const u of uploads.rows) {
      const vid = await pool.query('SELECT * FROM "Video" WHERE id = $1', [u.videoId]);
      const videoTitle = vid.rows[0] ? vid.rows[0].title : u.videoId;
      const videoUrl = vid.rows[0] ? vid.rows[0].url : 'N/A';
      console.log(`[${u.createdAt.toISOString()}] Status: ${u.status} | Video: ${videoTitle} (${videoUrl}) | Err: ${u.errorMessage}`);
    }
  } catch (err) {
    console.error("DB Query Error:", err);
  } finally {
    await pool.end();
  }
}

main();
