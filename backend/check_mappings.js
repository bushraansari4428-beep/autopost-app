require("dotenv").config();
const { Pool } = require("pg");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.log("No DATABASE_URL"); return; }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const page = await prisma.facebookPage.findFirst({
    where: { name: { contains: "Rare" } }
  });

  const mappings = await prisma.mapping.findMany({
    where: { facebookPageId: page.id },
    include: { source: true }
  });
  
  console.log("Mappings for page:", page.name);
  for (const m of mappings) {
    console.log(`Mapping ID: ${m.id}, Source ID: ${m.sourceId}, Source URL: ${m.source.url}, Source Platform: ${m.source.platform}`);
  }
  
  await prisma.$disconnect();
}
main().catch(console.error);
