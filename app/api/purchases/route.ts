import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { type: 'PURCHASE' },
      orderBy: { createdAt: 'desc' }
    });

    // Parse the items field for each transaction to enrich the response
    const enrichedTransactions = transactions.map(t => {
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(t.items);
      } catch (e) {
        parsedData = { items: [] };
      }

      return {
        id: t.id,
        createdAt: t.createdAt,
        totalAmount: t.totalAmount,
        userId: t.userId,
        supplier: parsedData.supplier || 'Неизвестный поставщик',
        invoiceNumber: parsedData.invoiceNumber || '',
        status: parsedData.status || 'DELIVERED',
        items: parsedData.items || []
      };
    });

    return NextResponse.json(enrichedTransactions);
  } catch (error: any) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { supplier, invoiceNumber, items, userId, status } = body;
    const finalStatus = status === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'DELIVERED';

    if (!supplier) {
      return NextResponse.json({ error: 'Укажите поставщика' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Список товаров закупки пуст' }, { status: 400 });
    }

    const processedItems: any[] = [];
    let totalCost = 0;

    // Use a transaction to safely update inventory and log the purchase
    const result = await prisma.$transaction(async (tx) => {
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

        totalCost += qty * cost;

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
          // Update existing product
          if (finalStatus === 'DELIVERED') {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                quantity: {
                  increment: qty
                },
                costPrice: cost,
                retailPrice: retail
              }
            });
          }
          finalProductId = existingProduct.id;
        } else {
          // Automatically create the product if it doesn't exist
          const created = await tx.product.create({
            data: {
              sku,
              name,
              category,
              barcode: barcode || null,
              unit,
              quantity: finalStatus === 'DELIVERED' ? qty : 0,
              costPrice: cost,
              retailPrice: retail,
              minStock: 10
            }
          });
          finalProductId = created.id;
        }

        processedItems.push({
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

      // Save the purchase transaction
      const transactionPayload = {
        supplier,
        invoiceNumber: invoiceNumber || '',
        status: finalStatus,
        items: processedItems
      };

      const transaction = await tx.transaction.create({
        data: {
          type: 'PURCHASE',
          items: JSON.stringify(transactionPayload),
          totalAmount: totalCost,
          userId: userId || 'SYSTEM'
        }
      });

      const logStatusMsg = finalStatus === 'IN_TRANSIT' ? 'В пути' : 'Доставлена';
      // Create log entry
      await tx.log.create({
        data: {
          action: 'PURCHASE',
          details: `Закупка у поставщика "${supplier}" (Накладная: ${invoiceNumber || 'б/н'}, Статус: ${logStatusMsg}) на сумму $${totalCost.toFixed(2)}. Принято ${processedItems.length} поз.`,
          userId: userId || 'SYSTEM'
        }
      });

      return transaction;
    });

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: any) {
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
