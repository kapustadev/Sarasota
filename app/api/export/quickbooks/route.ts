export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.product.findMany();

    // QuickBooks CSV Header (from TZ transcription)
    // Name, SKU, Description, Qty on Hand, Cost, Sales Price
    const header = "Item Name,SKU,Description,Qty on Hand,Cost,Sales Price\n";
    
    const rows = products.map(p => {
      // Escape commas and quotes for CSV safety
      const name = `"${p.name.replace(/"/g, '""')}"`;
      const sku = `"${p.sku}"`;
      const desc = `"${p.category} - ${p.unit}"`;
      const qty = p.quantity;
      const cost = p.costPrice.toFixed(2);
      const retail = p.retailPrice.toFixed(2);
      
      return `${name},${sku},${desc},${qty},${cost},${retail}`;
    }).join("\n");

    const csvContent = header + rows;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=quickbooks_products_export.csv',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
