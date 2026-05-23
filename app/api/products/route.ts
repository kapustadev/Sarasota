import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Auto-generate SKU as simple sequential numbering (1, 2, 3...) if missing
    let skuToSave = body.sku;
    if (!skuToSave || skuToSave.trim() === '') {
      const allProducts = await prisma.product.findMany({
        select: { sku: true }
      });
      let maxSkuNum = 0;
      allProducts.forEach(p => {
        const parsed = parseInt(p.sku, 10);
        if (!isNaN(parsed) && parsed > maxSkuNum) {
          maxSkuNum = parsed;
        }
      });
      skuToSave = String(maxSkuNum + 1);
    }

    const product = await prisma.product.create({
      data: {
        sku: skuToSave,
        name: body.name,
        category: body.category,
        unit: body.unit,
        quantity: parseFloat(body.quantity) || 0,
        minStock: parseFloat(body.minStock) || 0,
        costPrice: parseFloat(body.costPrice) || 0,
        retailPrice: parseFloat(body.retailPrice) || 0,
        reserved: 0
      }
    });
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
