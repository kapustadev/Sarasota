import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const transaction = await prisma.transaction.findUnique({
      where: { id }
    });

    if (!transaction || transaction.type !== 'PURCHASE') {
      return NextResponse.json({ error: 'Закупка не найдена' }, { status: 404 });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(transaction.items);
    } catch (e) {
      return NextResponse.json({ error: 'Неверный формат данных закупки' }, { status: 400 });
    }

    if (payload.status === 'DELIVERED') {
      return NextResponse.json({ error: 'Закупка уже имеет статус "Доставлена"' }, { status: 400 });
    }

    // Process the inventory increment since it's now DELIVERED
    const items = payload.items || [];
    
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 0;
        if (qty > 0) {
          // Verify product exists and update
          const existingProduct = await tx.product.findUnique({
            where: { id: item.productId }
          });
          
          if (existingProduct) {
            await tx.product.update({
              where: { id: existingProduct.id },
              data: {
                quantity: {
                  increment: qty
                }
              }
            });
          }
        }
      }

      // Update the transaction payload status
      payload.status = 'DELIVERED';
      await tx.transaction.update({
        where: { id },
        data: {
          items: JSON.stringify(payload)
        }
      });

      // Log the status change
      await tx.log.create({
        data: {
          action: 'PURCHASE_STATUS_UPDATE',
          details: `Статус закупки (Накладная: ${payload.invoiceNumber || 'б/н'}) у поставщика "${payload.supplier}" изменен на "Доставлена". Зачислено ${items.length} позиций на склад.`,
          userId: 'SYSTEM'
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating purchase status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
