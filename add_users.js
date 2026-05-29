const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      username: 'liliya',
      password: 'LilyOwner2026#',
      name: 'Владелец',
      role: 'OWNER'
    },
    {
      username: 'anya',
      password: 'AnyaBook2026$',
      name: 'Бухгалтер',
      role: 'ACCOUNTANT'
    }
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: { password: userData.password, name: userData.name, role: userData.role },
      create: userData
    });
    console.log(`✅ User created/updated: ${user.username} (${user.role})`);
  }

  console.log('\nAll users in database:');
  const all = await prisma.user.findMany();
  all.forEach(u => console.log(`  - ${u.username} | ${u.role} | ${u.name}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
