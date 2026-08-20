const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'postgresql://postgres.swuwuzglxehiaogabmul:Pakistan887766551122@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clean() {
  const d = await prisma.uploadHistory.deleteMany({where: {video: {originalId: {startsWith: 'test_fail_'}}}});
  console.log('deleted histories', d);
  const v = await prisma.video.deleteMany({where: {originalId: {startsWith: 'test_fail_'}}});
  console.log('deleted videos', v);
}
clean().catch(console.error).finally(() => process.exit(0));
