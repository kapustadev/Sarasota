import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.transaction.deleteMany({
    where: { type: 'WP_AUTO_SYNC' }
  });
  await prisma.wpProcessedOrder.deleteMany({});
  await prisma.log.deleteMany({
    where: { action: 'WP_AUTO_SYNC' }
  });
  console.log('Deleted old ones');
}

main().catch(console.error).finally(() => prisma.$disconnect());
