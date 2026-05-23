import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { id, actions, isDefect } = await req.json();
    // actions: { [productId]: { returnQty: number, defectQty: number } }
    // isDefect: true = "Списать" (write-off, goes to analytics defects)
    //           false = "Разобрать" (disassemble, returns to stock, NOT a defect)

    if (!id || !actions) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const item = await tx.showcaseItem.findUnique({ where: { id } });
      if (!item) throw new Error('Showcase item not found');

      // "Разобрать" = DECOMPOSED (returns stock, not a defect)
      // "Списать"   = DEFECT (lost goods, counted in write-off analytics)
      const newStatus = isDefect ? 'DEFECT' : 'DECOMPOSED';

      await tx.showcaseItem.update({
        where: { id },
        data: { status: newStatus }
      });

      // Handle the actions per product
      for (const [productId, qtys] of Object.entries(actions)) {
        const { returnQty } = qtys as { returnQty: number; defectQty: number };
        if (returnQty > 0) {
          await tx.product.update({
            where: { id: productId },
            data: { quantity: { increment: returnQty } }
          });
        }
        // defectQty: when isDefect=true, goods are gone (already deducted during assembly). No DB change needed.
        // When isDefect=false (decompose), returnQty already handles returning goods above.
      }
    });

    return NextResponse.json({ success: true, message: isDefect ? 'Bouquet written off as defect' : 'Bouquet disassembled, stock returned' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
