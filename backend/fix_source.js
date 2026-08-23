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

  await prisma.source.delete({
    where: { id: "ba077141-f16f-480d-afa6-985b4c4de3cb" }
  }).catch(e => console.log("already deleted or error", e.message));
  
  console.log("Empty manual source deleted.");
  await prisma.$disconnect();
}
main().catch(console.error);
