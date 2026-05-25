import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    const body = await req.json();
    const { quantity, userId, reason } = body;
    
    const deductionQty = parseFloat(quantity);
    if (isNaN(deductionQty) || deductionQty <= 0) {
      return NextResponse.json({ error: 'Неверное количество для списания' }, { status: 400 });
    }

    // Check if the product exists
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
    }

    if (product.quantity < deductionQty) {
      return NextResponse.json({ error: `Недостаточно товара на складе. Доступно: ${product.quantity} ${product.unit}` }, { status: 400 });
    }

    // Atomically decrement stock
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        quantity: {
          decrement: deductionQty
        }
      }
    });

    // Create log entry for auditing
    const reasonText = reason ? `. Причина: ${reason}` : '';
    await prisma.log.create({
      data: {
        action: 'WRITE_OFF',
        details: `Списание со склада: ${product.name} (Артикул: ${product.sku}) в количестве ${deductionQty} ${product.unit}${reasonText}`,
        userId: userId || 'SYSTEM'
      }
    });

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    console.error('Error writing off product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
