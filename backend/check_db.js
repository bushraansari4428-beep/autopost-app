const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', users.map(u => ({ id: u.id, email: u.email, role: u.role, expiresAt: u.expiresAt })));
  
  const pages = await prisma.page.findMany();
  console.log('Pages:', pages.length);
  if(pages.length > 0) {
     console.log(pages);
  }
  
  const mappings = await prisma.mapping.findMany();
  console.log('Mappings:', mappings.length);
  if(mappings.length > 0) {
     console.log(mappings);
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  });
