import { PrismaClient } from '@prisma/client';
import { WooCommerceClient } from '../lib/woocommerce';

const prisma = new PrismaClient();

async function main() {
  console.log('Начинаем синхронизацию...');
  try {
    const orders = await WooCommerceClient.getOrders();
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      console.log('Нет заказов на сайте.');
      return;
    }
    console.log(`Получено ${orders.length} заказов.`);

    const processedOrders = await prisma.wpProcessedOrder.findMany({});
    const processedIdsSet = new Set(processedOrders.map(o => o.wpOrderId));

    const newOrders = orders.filter((order: any) => !processedIdsSet.has(order.id));
    if (newOrders.length === 0) {
      console.log('Все заказы уже обработаны.');
      return;
    }
    console.log(`Найдено ${newOrders.length} новых заказов для обработки.`);

    const processedSummaries: any[] = [];

    for (const order of newOrders) {
      const orderId = order.id;
      const status = order.status;
      const lineItems = order.line_items;
      const orderTotal = parseFloat(order.total) || 0;

      if (!lineItems || !Array.isArray(lineItems)) continue;

      const orderDeductions: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of lineItems) {
          const wpProductId = item.variation_id && item.variation_id !== 0 ? item.variation_id : item.product_id;
          const itemQty = parseFloat(item.quantity) || 1;
          const sku = item.sku;

          const recipeRecord = await tx.wpProductRecipe.findUnique({
            where: { wpProductId }
          });

          if (recipeRecord) {
            const ingredients = JSON.parse(recipeRecord.recipe);
            for (const ing of ingredients) {
              const warehouseProduct = await tx.product.findUnique({
                where: { id: ing.productId }
              });

              if (!warehouseProduct) continue;

              const deductionQty = ing.quantity * itemQty;
              await tx.product.update({
                where: { id: ing.productId },
                data: { quantity: { decrement: deductionQty } }
              });

              orderDeductions.push({
                productId: warehouseProduct.id,
                productName: warehouseProduct.name,
                deducted: deductionQty,
                unit: warehouseProduct.unit
              });
            }
          } else {
            const internalProducts = await tx.product.findMany({});
            let matchedWarehouseProduct = null;

            if (sku) {
              matchedWarehouseProduct = internalProducts.find((p: any) => p.sku.toLowerCase() === sku.toLowerCase());
            }

            if (matchedWarehouseProduct) {
              await tx.product.update({
                where: { id: matchedWarehouseProduct.id },
                data: { quantity: { decrement: itemQty } }
              });

              orderDeductions.push({
                productId: matchedWarehouseProduct.id,
                productName: matchedWarehouseProduct.name,
                deducted: itemQty,
                unit: matchedWarehouseProduct.unit
              });
            }
          }
        }

        await tx.wpProcessedOrder.create({
          data: { wpOrderId: orderId, status }
        });

        if (orderTotal > 0 || orderDeductions.length > 0) {
          await tx.transaction.create({
            data: {
              type: 'WP_AUTO_SYNC',
              items: JSON.stringify(orderDeductions.map(d => ({ id: d.productId, quantity: d.deducted }))),
              totalAmount: orderTotal,
              userId: 'SYSTEM_AUTOSYNC'
            }
          });

          await tx.log.create({
            data: {
              action: 'WP_AUTO_SYNC',
              details: `Авто-списание по заказу #${orderId} с сайта. Списаны: ${orderDeductions.length > 0 ? orderDeductions.map(d => `${d.productName} (-${d.deducted} ${d.unit})`).join(', ') : 'Нет привязанных складских товаров (Только выручка)'}`,
              userId: 'SYSTEM_AUTOSYNC'
            }
          });
        }
      });

      processedSummaries.push({ orderId, status });
    }

    console.log(`Успешно обработано ${processedSummaries.length} заказов:`, processedSummaries.map(s => s.orderId));
  } catch (e) {
    console.error('Error', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
