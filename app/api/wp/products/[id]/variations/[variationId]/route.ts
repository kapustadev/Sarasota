import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; variationId: string } }
) {
  try {
    const parentId = parseInt(params.id, 10);
    const variationId = parseInt(params.variationId, 10);
    
    if (isNaN(parentId) || isNaN(variationId)) {
      return NextResponse.json({ error: 'Invalid product or variation ID' }, { status: 400 });
    }

    // Call WooCommerce to delete variation
    const result = await WooCommerceClient.deleteVariation(parentId, variationId, true);
    
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error(`Failed to delete variation ${params.variationId} for product ${params.id}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to delete variation' }, { status: 500 });
  }
}
