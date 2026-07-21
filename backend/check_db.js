const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.source.findMany();
  const pages = await prisma.facebookPage.findMany();
  
  console.log("--- SOURCES ---");
  console.dir(sources, { depth: null });
  console.log("\\n--- PAGES ---");
  console.dir(pages, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
