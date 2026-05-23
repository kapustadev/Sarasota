import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';

export async function GET() {
  try {
    const categories = await WooCommerceClient.getCategories();

    // Build a lookup map: id -> name, for resolving parent names
    const idToName: Record<number, string> = {};
    categories.forEach((c: any) => { idToName[c.id] = c.name; });

    // Return full category data including parent id and parent name
    const formattedCategories = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c.count,
      parent: c.parent || 0,           // 0 means root category
      parentName: c.parent ? (idToName[c.parent] || null) : null
    }));

    // Sort: root categories first, then children grouped under their parents
    const roots = formattedCategories.filter((c: any) => c.parent === 0).sort((a: any, b: any) => a.name.localeCompare(b.name));
    const children = formattedCategories.filter((c: any) => c.parent !== 0).sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Interleave: place each child right after its parent in the list
    const sorted: any[] = [];
    roots.forEach((root: any) => {
      sorted.push(root);
      children.filter((c: any) => c.parent === root.id).forEach((child: any) => sorted.push(child));
    });
    // Append any orphaned children at the end (parent not in fetched list)
    children.filter((c: any) => !idToName[c.parent]).forEach((c: any) => sorted.push(c));

    return NextResponse.json(sorted);
  } catch (error: any) {
    console.error('Error fetching categories from WC:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, parent } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    const category = await WooCommerceClient.createCategory({ name, parent });
    return NextResponse.json(category);
  } catch (error: any) {
    console.error('Error creating category in WC:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
