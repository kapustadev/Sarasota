import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;
    const body = await req.json();
    const { supplier, invoiceNumber, items, userId } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID закупки обязателен' }, { status: 400 });
    }
    if (!supplier) {
      return NextResponse.json({ error: 'Укажите поставщика' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Список товаров закупки пуст' }, { status: 400 });
    }

    // 1. Fetch old purchase transaction
    const oldTransaction = await prisma.transaction.findUnique({
      where: { id }
    });

    if (!oldTransaction || oldTransaction.type !== 'PURCHASE') {
      return NextResponse.json({ error: 'Закупка не найдена' }, { status: 404 });
    }

    // 2. Parse old items
    let oldPayload: any = {};
    try {
      oldPayload = JSON.parse(oldTransaction.items);
    } catch (e) {
      oldPayload = { items: [] };
    }
    const oldItems: any[] = oldPayload.items || [];

    // Create maps of old items by product ID or SKU to calculate stock differences
    const oldItemsMap = new Map<string, { quantity: number; costPrice: number }>();
    oldItems.forEach(item => {
      // Use productId if available, otherwise fallback to SKU or barcode
      const key = item.productId || item.sku;
      oldItemsMap.set(key, { quantity: item.quantity || 0, costPrice: item.costPrice || 0 });
    });

    const newProcessedItems: any[] = [];
    let newTotalCost = 0;

    // Use database transaction to safely adjust inventory
    const result = await prisma.$transaction(async (tx) => {
      const newItemsKeys = new Set<string>();

      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        const cost = parseFloat(item.costPrice) || 0;
        const retail = parseFloat(item.retailPrice) || 0;
        const name = item.name?.trim();
        const sku = item.sku?.trim();
        const barcode = item.barcode?.trim() || null;
        const category = item.category || 'FLOWER';
        const unit = item.unit || 'шт';

        if (!name || !sku) {
          throw new Error('У каждого товара должно быть название и артикул');
        }

        newTotalCost += qty * cost;

        // Try to find existing product by barcode first, then by SKU
        let existingProduct = null;
        if (barcode) {
          existingProduct = await tx.product.findUnique({
            where: { barcode }
          });
        }
        if (!existingProduct && sku) {
          existingProduct = await tx.product.findUnique({
            where: { sku }
          });
        }

        let finalProductId = '';

        if (existingProduct) {
          finalProductId = existingProduct.id;
          const key = existingProduct.id;
          newItemsKeys.add(key);

          // Get old quantity in this purchase (if any)
          const oldData = oldItemsMap.get(key) || oldItemsMap.get(sku) || { quantity: 0 };
          const diffQty = qty - oldData.quantity;

          // Adjust warehouse inventory by the difference
          await tx.product.update({
            where: { id: existingProduct.id },
            data: {
              quantity: {
                increment: diffQty
              },
              costPrice: cost,
              retailPrice: retail
            }
          });
        } else {
          // Product does not exist (added during edit) - create it!
          const created = await tx.product.create({
            data: {
              sku,
              name,
              category,
              barcode: barcode || null,
              unit,
              quantity: qty,
              costPrice: cost,
              retailPrice: retail,
              minStock: 10
            }
          });
          finalProductId = created.id;
          newItemsKeys.add(created.id);
        }

        newProcessedItems.push({
          productId: finalProductId,
          name,
          sku,
          barcode,
          category,
          unit,
          quantity: qty,
          costPrice: cost,
          retailPrice: retail
        });
      }

      // Check if any items from the old invoice were deleted in the edited version
      for (const [key, oldData] of oldItemsMap.entries()) {
        const wasMatched = newProcessedItems.some(item => item.productId === key || item.sku === key);
        if (!wasMatched) {
          // Item was deleted in the edited version! Subtract its entire old quantity from stock
          // Try to find the product in database to decrement stock
          const prod = await tx.product.findFirst({
            where: {
              OR: [
                { id: key },
                { sku: key }
              ]
            }
          });

          if (prod) {
            await tx.product.update({
              where: { id: prod.id },
              data: {
                quantity: {
                  decrement: oldData.quantity
                }
              }
            });
          }
        }
      }

      // Update the transaction
      const transactionPayload = {
        supplier,
        invoiceNumber: invoiceNumber || '',
        items: newProcessedItems
      };

      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          items: JSON.stringify(transactionPayload),
          totalAmount: newTotalCost,
          userId: userId || 'SYSTEM'
        }
      });

      // Create log entry
      await tx.log.create({
        data: {
          action: 'EDIT_PURCHASE',
          details: `Редактирование накладной #${invoiceNumber || 'б/н'} поставщика "${supplier}" (ID: ${id}). Новая сумма: $${newTotalCost.toFixed(2)}. Откорректировано ${newProcessedItems.length} поз.`,
          userId: userId || 'SYSTEM'
        }
      });

      return updatedTransaction;
    });

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: any) {
    console.error('Error updating purchase:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'SYSTEM';

    if (!id) {
      return NextResponse.json({ error: 'ID закупки обязателен' }, { status: 400 });
    }

    // 1. Fetch the old purchase transaction
    const oldTransaction = await prisma.transaction.findUnique({
      where: { id }
    });

    if (!oldTransaction || oldTransaction.type !== 'PURCHASE') {
      return NextResponse.json({ error: 'Закупка не найдена' }, { status: 404 });
    }

    // 2. Parse items
    let oldPayload: any = {};
    try {
      oldPayload = JSON.parse(oldTransaction.items);
    } catch (e) {
      oldPayload = { items: [] };
    }
    const oldItems: any[] = oldPayload.items || [];

    // 3. Prisma transaction to reverse stock and delete
    await prisma.$transaction(async (tx) => {
      for (const item of oldItems) {
        const qty = parseFloat(item.quantity) || 0;
        const key = item.productId || item.sku;

        // Find the product in DB to decrement quantity
        const prod = await tx.product.findFirst({
          where: {
            OR: [
              { id: key },
              { sku: key }
            ]
          }
        });

        if (prod) {
          await tx.product.update({
            where: { id: prod.id },
            data: {
              quantity: {
                decrement: qty
              }
            }
          });
        }
      }

      // Delete the transaction
      await tx.transaction.delete({
        where: { id }
      });

      // Create log entry
      await tx.log.create({
        data: {
          action: 'DELETE_PURCHASE',
          details: `Удаление закупки от поставщика "${oldPayload.supplier || 'Неизвестный'}" (Накладная: ${oldPayload.invoiceNumber || 'б/н'}) на сумму $${oldTransaction.totalAmount.toFixed(2)}. Остатки товаров скорректированы (уменьшены).`,
          userId: userId
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting purchase:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

