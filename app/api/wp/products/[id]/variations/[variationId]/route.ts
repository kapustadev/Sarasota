import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; variationId: string }> }
) {
  let resolvedParams;
  try {
    resolvedParams = await params;
    const parentId = parseInt(resolvedParams.id, 10);
    const variationId = parseInt(resolvedParams.variationId, 10);
    
    if (isNaN(parentId) || isNaN(variationId)) {
      return NextResponse.json({ error: 'Invalid product or variation ID' }, { status: 400 });
    }

    // Call WooCommerce to delete variation
    const result = await WooCommerceClient.deleteVariation(parentId, variationId, true);
    
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error(`Failed to delete variation ${resolvedParams?.variationId || 'unknown'} for product ${resolvedParams?.id || 'unknown'}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to delete variation' }, { status: 500 });
  }
}
