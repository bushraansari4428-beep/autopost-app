const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const logs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log("=== RECENT SYSTEM LOGS ===");
    logs.forEach(l => {
      console.log(`[${l.createdAt.toISOString()}] [${l.level}] ${l.message}`);
    });

    const uploads = await prisma.uploadHistory.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { video: true }
    });
    console.log("\n=== RECENT UPLOADS ===");
    uploads.forEach(u => {
      console.log(`[${u.updatedAt.toISOString()}] Status: ${u.status} | Video: ${u.video?.title || u.videoId} | FB Post: ${u.facebookPostId} | Err: ${u.errorMessage}`);
    });
  } catch (err) {
    console.error("Prisma query error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
