import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: { type: 'WP_AUTO_SYNC' }
  });
  console.log(`Found ${transactions.length} WP_AUTO_SYNC transactions`);

  const processedOrders = await prisma.wpProcessedOrder.findMany();
  console.log(`Found ${processedOrders.length} wpProcessedOrder records:`, processedOrders.map(o => o.wpOrderId));

  const logs = await prisma.log.findMany({
    where: { action: 'WP_AUTO_SYNC' }
  });
  console.log(`Found ${logs.length} WP_AUTO_SYNC logs`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
