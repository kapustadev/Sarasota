import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';

export async function GET() {
  try {
    const orders = await WooCommerceClient.getActiveOrders();
    return NextResponse.json(orders || []);
  } catch (error: any) {
    console.error('Error fetching active WooCommerce orders:', error);
    // Return empty array with a warning to avoid throwing errors on frontend if API is down
    return NextResponse.json({ error: error.message, orders: [] }, { status: 200 });
  }
}
