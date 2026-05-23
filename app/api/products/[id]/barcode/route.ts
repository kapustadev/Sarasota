import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    
    let barcode = '';
    
    // Parse body if it exists to check if custom barcode was provided
    try {
      const body = await req.json();
      if (body && body.barcode) {
        barcode = String(body.barcode).trim();
      }
    } catch (e) {
      // Body might be empty or invalid json, ignore
    }

    if (barcode) {
      // Validate that it doesn't already exist on another product
      const existing = await prisma.product.findFirst({
        where: {
          barcode,
          NOT: { id }
        }
      });
      if (existing) {
        return NextResponse.json({ error: 'Этот штрих-код уже используется для другого товара' }, { status: 400 });
      }
    } else {
      // Generate a simple 12-digit barcode based on timestamp and random
      barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { barcode }
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
