import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to fix stuck PROCESSING records...');
  const updated = await prisma.uploadHistory.updateMany({
    where: { status: 'PROCESSING' },
    data: { status: 'FAILED', errorMessage: 'Stuck in processing (Manual reset)' }
  });
  console.log(`Successfully updated ${updated.count} stuck records to FAILED.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
