import { PrismaClient } from '@prisma/client';
import { WooCommerceClient } from '../lib/woocommerce';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching WooCommerce orders...');
  const orders = await WooCommerceClient.getOrders();
  console.log(`Fetched ${orders.length} orders from WooCommerce.`);

  const processedOrders = await prisma.wpProcessedOrder.findMany();
  console.log(`Found ${processedOrders.length} processed orders in local DB.`);

  let restoredCount = 0;

  for (const processed of processedOrders) {
    const orderId = processed.wpOrderId;
    // Check if a log exists for this order
    const log = await prisma.log.findFirst({
      where: {
        details: { contains: `#${orderId}` }
      }
    });

    if (!log) {
      console.log(`Order #${orderId} is marked as processed but has NO log/transaction! Restoring...`);
      const wcOrder = orders.find((o: any) => o.id === orderId);
      
      if (wcOrder) {
        const orderTotal = parseFloat(wcOrder.total) || 0;
        
        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              type: 'WP_AUTO_SYNC',
              items: '[]', // No linked items since it was skipped
              totalAmount: orderTotal,
              userId: 'SYSTEM_AUTOSYNC_RESTORE',
              createdAt: new Date(wcOrder.date_created) // Use original order date
            }
          });

          await tx.log.create({
            data: {
              action: 'WP_AUTO_SYNC',
              details: `Авто-списание по заказу #${orderId} с сайта. Списаны: Нет привязанных складских товаров (Только выручка) [ВОССТАНОВЛЕНО]`,
              userId: 'SYSTEM_AUTOSYNC_RESTORE',
              createdAt: new Date(wcOrder.date_created)
            }
          });
        });
        
        console.log(`Restored transaction for order #${orderId} with total $${orderTotal}`);
        restoredCount++;
      } else {
        console.log(`Order #${orderId} not found in recent WC orders, skipping...`);
      }
    }
  }

  console.log(`Finished restoring ${restoredCount} orders!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
