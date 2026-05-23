import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    await WooCommerceClient.deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting category from WC:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
