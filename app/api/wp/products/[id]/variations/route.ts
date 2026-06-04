import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const parentId = parseInt(params.id, 10);
    if (isNaN(parentId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();
    
    // Call WooCommerce to create variation
    const newVariation = await WooCommerceClient.createVariation(parentId, body);
    
    return NextResponse.json(newVariation);
  } catch (error: any) {
    console.error(`Failed to create variation for product ${params.id}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create variation' }, { status: 500 });
  }
}
