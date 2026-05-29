const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in database:');
  users.forEach(u => {
    console.log(`  username: "${u.username}", password: "${u.password}", role: "${u.role}", name: "${u.name}"`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
