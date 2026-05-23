import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, retailPrice, items, releaseReserved, status } = await req.json();

    if (!items || !name || retailPrice === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const finalStatus = status || 'AVAILABLE';

    // items: [{ id: productId, quantity: number }]

    await prisma.$transaction(async (tx) => {
      // 1. Create ShowcaseItem
      await tx.showcaseItem.create({
        data: {
          name,
          retailPrice,
          components: JSON.stringify(items),
          status: finalStatus
        }
      });

      // 2. Decrement product stock
      for (const item of items) {
        const updateData: any = {
          quantity: { decrement: item.quantity }
        };
        // If the frontend already reserved them while scanning, we need to release that reserve
        if (releaseReserved) {
          updateData.reserved = { decrement: item.quantity };
        }

        await tx.product.update({
          where: { id: item.id },
          data: updateData
        });
      }
    });

    return NextResponse.json({ success: true, message: 'Bouquet moved to Showcase' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
