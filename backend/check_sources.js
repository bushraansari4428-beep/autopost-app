const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.source.findMany();
  console.log(JSON.stringify(sources, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
