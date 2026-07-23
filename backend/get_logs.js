const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(logs.map(l => l.createdAt + ' ' + l.level + ': ' + l.message).join('\n'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
