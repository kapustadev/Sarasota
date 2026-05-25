import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (type === 'WAREHOUSE_RAW') {
        // Find the log
        const log = await tx.log.findUnique({ where: { id } });
        if (!log) throw new Error('Write-off log not found');

        // Parse details to find product and qty
        const skuMatch = log.details.match(/Артикул:\s*([^\)]+)/);
        const qtyMatch = log.details.match(/в количестве\s*([\d\.]+)/);

        if (skuMatch && qtyMatch) {
          const sku = skuMatch[1].trim();
          const qty = parseFloat(qtyMatch[1]);

          const product = await tx.product.findUnique({ where: { sku } });
          if (product && !isNaN(qty)) {
            // Restore inventory
            await tx.product.update({
              where: { id: product.id },
              data: { quantity: { increment: qty } }
            });
          }
        }

        // Delete the log
        await tx.log.delete({ where: { id } });

      } else if (type === 'SHOWCASE_DEFECT') {
        // Restore showcase item to ON_DISPLAY
        const item = await tx.showcaseItem.findUnique({ where: { id } });
        if (!item) throw new Error('Showcase item not found');

        await tx.showcaseItem.update({
          where: { id },
          data: { status: 'ON_DISPLAY' }
        });

        // Try to find and delete the associated WRITE_OFF_BOUQUET log
        // The log details contain "Списание букета с витрины: <name>"
        // and was created around the same time
        const logs = await tx.log.findMany({
          where: {
            action: 'WRITE_OFF_BOUQUET',
            details: { contains: `Списание букета с витрины: ${item.name}` }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        const targetLog = logs.find(l => 
          Math.abs(new Date(l.createdAt).getTime() - new Date(item.updatedAt).getTime()) < 60000 // within 1 minute
        );

        if (targetLog) {
          await tx.log.delete({ where: { id: targetLog.id } });
        }
      } else {
        throw new Error('Unknown write-off type');
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting write-off:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
