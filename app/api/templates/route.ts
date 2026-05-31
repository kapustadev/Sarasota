export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, items, totalCost, totalRetail } = await req.json();

    if (!name || !items) {
      return NextResponse.json({ error: 'Missing name or items' }, { status: 400 });
    }

    const template = await prisma.template.create({
      data: {
        name,
        items: JSON.stringify(items),
        totalCost: totalCost || 0,
        totalRetail: totalRetail || 0
      }
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
