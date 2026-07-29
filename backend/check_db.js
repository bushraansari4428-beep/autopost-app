const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const uploads = await prisma.uploadHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { video: true }
  });
  
  console.log("Recent Uploads:");
  for (const upload of uploads) {
    console.log(`- Video: ${upload.video.title} (Source: ${upload.video.url})`);
    console.log(`  Status: ${upload.status}`);
    console.log(`  Error (if any): ${upload.errorMessage}`);
    console.log(`  Time: ${upload.createdAt}`);
    console.log('---------------------------');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
