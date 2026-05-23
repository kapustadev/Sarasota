import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { items } = await req.json(); // { items: [{ sku: 'FL-001', quantity: 2 }] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.product.update({
          where: { sku: item.sku },
          data: {
            reserved: {
              decrement: item.quantity
            }
          }
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Stock released successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
