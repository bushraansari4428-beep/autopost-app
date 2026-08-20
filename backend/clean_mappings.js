const { Pool } = require("pg");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Finding duplicate mappings...");
  const mappings = await prisma.mapping.findMany();
  
  const seenPages = new Set();
  let deletedCount = 0;
  
  for (const m of mappings) {
    if (seenPages.has(m.facebookPageId)) {
      console.log("Deleting duplicate mapping " + m.id + " for page " + m.facebookPageId);
      await prisma.mapping.delete({ where: { id: m.id } });
      deletedCount++;
    } else {
      seenPages.add(m.facebookPageId);
    }
  }
  
  console.log("Deleted " + deletedCount + " duplicate mappings.");
  await prisma.$disconnect();
}
main().catch(console.error);
