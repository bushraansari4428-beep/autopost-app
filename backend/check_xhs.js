const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const sources = await prisma.source.findMany({
    where: { platform: 'XIAOHONGSHU' }
  });
  console.log("Sources:", sources.map(s => s.url));
  
  const videos = await prisma.video.findMany({
    where: { source: { platform: 'XIAOHONGSHU' } },
    take: 5
  });
  console.log("Videos:", videos.map(v => v.url));
}
run();
