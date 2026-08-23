const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    where: {
      uploads: {
        none: {
          facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' }
        }
      }
    },
    include: { uploads: true }
  });
  console.log('Videos with no real fb post:', videos.map(v => v.title));
}

main().finally(() => prisma.$disconnect());
