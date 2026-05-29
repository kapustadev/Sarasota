import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // 1. Fetch recent orders from WooCommerce (Mock or Real site)
    const orders = await WooCommerceClient.getOrders();
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ success: true, message: 'Нет заказов на сайте.', processed: [] });
    }

    // 2. Fetch already processed orders from SQLite
    const processedOrders = await prisma.wpProcessedOrder.findMany({});
    const processedIdsSet = new Set(processedOrders.map(o => o.wpOrderId));

    // 3. Filter only NEW orders
    const newOrders = orders.filter(order => !processedIdsSet.has(order.id));
    if (newOrders.length === 0) {
      return NextResponse.json({ success: true, message: 'Все заказы уже обработаны.', processed: [] });
    }

    const processedSummaries: any[] = [];

    // 4. Process each new order inside a Prisma transaction
    for (const order of newOrders) {
      const orderId = order.id;
      const status = order.status;
      const lineItems = order.line_items;
      const orderTotal = parseFloat(order.total) || 0;
      const orderDate = order.date_created ? new Date(order.date_created) : new Date();

      if (!lineItems || !Array.isArray(lineItems)) continue;

      const orderDeductions: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of lineItems) {
          // Use variation_id if it is a variable product variation, otherwise fall back to product_id
          const wpProductId = item.variation_id && item.variation_id !== 0 ? item.variation_id : item.product_id;
          const itemQty = parseFloat(item.quantity) || 1;
          const sku = item.sku;

          // Look up if a warehouse recipe composition exists
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
                data: {
                  quantity: {
                    decrement: deductionQty
                  }
                }
              });

              orderDeductions.push({
                productId: warehouseProduct.id,
                productName: warehouseProduct.name,
                deducted: deductionQty,
                unit: warehouseProduct.unit
              });
            }
          } else {
            // Direct SKU/Barcode link
            const internalProducts = await tx.product.findMany({});
            let matchedWarehouseProduct = null;

            if (sku) {
              matchedWarehouseProduct = internalProducts.find(p => p.sku.toLowerCase() === sku.toLowerCase());
            }

            if (matchedWarehouseProduct) {
              await tx.product.update({
                where: { id: matchedWarehouseProduct.id },
                data: {
                  quantity: {
                    decrement: itemQty
                  }
                }
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

        // Save order ID to SQLite to prevent double-deduction
        await tx.wpProcessedOrder.create({
          data: {
            wpOrderId: orderId,
            status
          }
        });

        // Record a transaction
        if (orderTotal > 0 || orderDeductions.length > 0) {
          await tx.transaction.create({
            data: {
              type: 'WP_AUTO_SYNC',
              items: JSON.stringify(orderDeductions.map(d => ({ id: d.productId, quantity: d.deducted }))),
              totalAmount: orderTotal,
              userId: 'SYSTEM_AUTOSYNC',
              createdAt: orderDate
            }
          });

          const boughtItemsString = lineItems.map((i: any) => `${i.name} (x${i.quantity})`).join('\n- ');
          const deductedString = orderDeductions.length > 0 
            ? orderDeductions.map(d => `${d.productName} (-${d.deducted} ${d.unit})`).join('\n- ') 
            : 'Нет привязанных складских товаров (Только выручка)';

          await tx.log.create({
            data: {
              action: 'WP_AUTO_SYNC',
              details: `Авто-списание по заказу #${orderId} с сайта.\n\nПозиции в заказе:\n- ${boughtItemsString}\n\nСписано со склада:\n- ${deductedString}`,
              userId: 'SYSTEM_AUTOSYNC',
              createdAt: orderDate
            }
          });
        }
      });

      processedSummaries.push({
        orderId,
        total: orderTotal,
        status,
        deductions: orderDeductions
      });
    }

    return NextResponse.json({
      success: true,
      message: `Успешно обработано ${processedSummaries.length} новых заказов!`,
      processed: processedSummaries
    });
  } catch (error: any) {
    console.error('Error in WooCommerce order auto-sync:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
