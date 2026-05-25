import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    const body = await req.json();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const skuToSave = body.sku || existing.sku;
    
    const product = await prisma.product.update({
      where: { id },
      data: {
        sku: skuToSave,
        name: body.name,
        nameEn: body.nameEn !== undefined ? body.nameEn : existing.nameEn,
        category: body.category,
        unit: body.unit,
        unitEn: body.unitEn !== undefined ? body.unitEn : existing.unitEn,
        quantity: parseFloat(body.quantity) || 0,
        minStock: parseFloat(body.minStock) || 0,
        costPrice: parseFloat(body.costPrice) || 0,
        retailPrice: parseFloat(body.retailPrice) || 0,
        supplier: body.supplier !== undefined ? (body.supplier || null) : existing.supplier,
      }
    });
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
