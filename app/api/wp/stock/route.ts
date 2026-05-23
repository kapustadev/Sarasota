import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to get real available stock
export async function GET() {
  try {
    const products = await prisma.product.findMany({});
    
    const stockInfo = products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      availableQuantity: Math.max(0, p.quantity - p.reserved),
      retailPrice: p.retailPrice
    }));

    return NextResponse.json(stockInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
