import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { items } = await req.json(); // { items: [{ sku: 'FL-001', quantity: 2 }] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Process reservations in a transaction to ensure all or nothing
    await prisma.$transaction(
      items.map((item) =>
        prisma.product.update({
          where: { sku: item.sku },
          data: {
            reserved: {
              increment: item.quantity
            }
          }
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Stock reserved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
