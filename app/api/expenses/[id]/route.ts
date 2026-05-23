import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'SYSTEM';

    if (!id) {
      return NextResponse.json({ error: 'ID расхода обязателен' }, { status: 400 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!expense) {
      return NextResponse.json({ error: 'Расход не найден' }, { status: 404 });
    }

    await prisma.expense.delete({
      where: { id }
    });

    // Create log entry
    await prisma.log.create({
      data: {
        action: 'DELETE_EXPENSE',
        details: `Удален расход: "${expense.description}" в категории "${expense.category}" на сумму $${expense.amount.toFixed(2)} (${expense.channel === 'PHYSICAL' ? 'Магазин' : 'Интернет-магазин'})`,
        userId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
