import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const order = await req.json();
    
    // WooCommerce sends webhooks with details like status, total, line_items, etc.
    const { id: orderId, status, line_items } = order;

    if (!line_items || !Array.isArray(line_items)) {
      return NextResponse.json({ error: 'No items in order webhook' }, { status: 400 });
    }

    console.log(`Processing WooCommerce order webhook #${orderId}. Status: ${status}`);

    const processedDeductions: any[] = [];

    // Run each line item deduction in a transaction
    await prisma.$transaction(async (tx) => {
      for (const item of line_items) {
        const wpProductId = item.product_id;
        const itemQty = parseFloat(item.quantity) || 1;
        const sku = item.sku;

        // 1. Check if a recipe exists for this WooCommerce product
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

            processedDeductions.push({
              wpProductId,
              wpProductName: item.name,
              warehouseProductId: warehouseProduct.id,
              warehouseProductName: warehouseProduct.name,
              sku: warehouseProduct.sku,
              deducted: deductionQty,
              unit: warehouseProduct.unit
            });
          }
        } else {
          // 2. Try direct link via SKU or Barcode
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

            processedDeductions.push({
              wpProductId,
              wpProductName: item.name,
              warehouseProductId: matchedWarehouseProduct.id,
              warehouseProductName: matchedWarehouseProduct.name,
              sku: matchedWarehouseProduct.sku,
              deducted: itemQty,
              unit: matchedWarehouseProduct.unit
            });
          }
        }
      }

      // Record a single unified transaction for the WooCommerce Order
      const orderTotal = parseFloat(order.total) || 0;
      const orderDate = order.date_created ? new Date(order.date_created) : new Date();

      if (orderTotal > 0 || processedDeductions.length > 0) {
        
        await tx.transaction.create({
          data: {
            type: 'WP_ORDER_WEBHOOK',
            items: JSON.stringify(processedDeductions.map(d => ({ id: d.warehouseProductId, quantity: d.deducted }))),
            totalAmount: orderTotal,
            userId: 'SYSTEM_WEBHOOK',
            createdAt: orderDate
          }
        });

        const boughtItemsString = (order.line_items || []).map((i: any) => `${i.name} (x${i.quantity})`).join('\n- ');
        const deductedString = processedDeductions.length > 0 
          ? processedDeductions.map(d => `${d.warehouseProductName} (-${d.deducted} ${d.unit})`).join('\n- ') 
          : 'Нет привязанных складских товаров (Только выручка)';

        await tx.log.create({
          data: {
            action: 'WP_ORDER_WEBHOOK',
            details: `Обработан заказ #${orderId} с сайта.\n\nПозиции в заказе:\n- ${boughtItemsString}\n\nСписано со склада:\n- ${deductedString}`,
            userId: 'SYSTEM_WEBHOOK',
            createdAt: orderDate
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      orderId,
      status,
      processedDeductions
    });
  } catch (error: any) {
    console.error('Error handling WooCommerce webhook order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
