import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const processedOrders = await prisma.wpProcessedOrder.findMany();
  let deletedCount = 0;

  for (const processed of processedOrders) {
    const orderId = processed.wpOrderId;
    const log = await prisma.log.findFirst({
      where: {
        details: { contains: `#${orderId}` }
      }
    });

    if (!log) {
      console.log(`Deleting orphaned processed order #${orderId}...`);
      await prisma.wpProcessedOrder.delete({ where: { id: processed.id } });
      deletedCount++;
    }
  }

  console.log(`Deleted ${deletedCount} orphaned processed orders! Run sync-orders now to re-process them.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
