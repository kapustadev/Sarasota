import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { createdAt: 'desc' }
    });

    let totalAmount = 0;
    let physicalTotal = 0;
    let onlineTotal = 0;

    const categoryBreakdown: Record<string, { category: string; amount: number; channel: string }> = {};

    expenses.forEach(e => {
      totalAmount += e.amount;
      if (e.channel === 'PHYSICAL') {
        physicalTotal += e.amount;
      } else {
        onlineTotal += e.amount;
      }

      const key = `${e.channel}-${e.category}`;
      if (!categoryBreakdown[key]) {
        categoryBreakdown[key] = {
          category: e.category,
          amount: 0,
          channel: e.channel
        };
      }
      categoryBreakdown[key].amount += e.amount;
    });

    return NextResponse.json({
      expenses,
      metrics: {
        total: totalAmount,
        physical: physicalTotal,
        online: onlineTotal
      },
      categoryBreakdown: Object.values(categoryBreakdown)
    });
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { description, amount, category, channel, userId } = body;

    if (!description || amount === undefined || !category || !channel) {
      return NextResponse.json({ error: 'Все поля обязательны для заполнения' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        description: description.trim(),
        amount: parseFloat(amount),
        category: category.trim(),
        channel
      }
    });

    // Create log entry
    await prisma.log.create({
      data: {
        action: 'ADD_EXPENSE',
        details: `Внесен расход: "${description.trim()}" в категорию "${category.trim()}" на сумму $${parseFloat(amount).toFixed(2)} (${channel === 'PHYSICAL' ? 'Магазин' : 'Интернет-магазин'})`,
        userId: userId || 'SYSTEM'
      }
    });

    return NextResponse.json({ success: true, expense });
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
