const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@autopost_db:5432/autopost?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.updateMany({
    where: { email: 'noorali8657@gmail.com' },
    data: { password: 'Pakistan@5847' }
  });
  console.log('Password updated successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());
