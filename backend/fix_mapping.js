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

  await prisma.mapping.update({
    where: { id: "5ff6d113-2bfc-4dfc-be1d-7af1ea16d893" },
    data: { sourceId: "f3a86aef-9148-48a1-a0f1-b867ff946071" }
  });
  
  console.log("Mapping updated to point to the correct source with videos.");
  await prisma.$disconnect();
}
main().catch(console.error);
