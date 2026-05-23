import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Run database transactions to completely cleanse test logs
    await prisma.$transaction([
      prisma.product.deleteMany(),
      prisma.showcaseItem.deleteMany(),
      prisma.template.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.log.deleteMany(),
      prisma.expense.deleteMany(),
      prisma.wpProcessedOrder.deleteMany()
    ]);

    // Reset suppliers list back to empty
    await prisma.wpConfig.upsert({
      where: { key: 'suppliers_profiles' },
      update: { value: '[]' },
      create: { key: 'suppliers_profiles', value: '[]' }
    });

    // Write a fresh log entry indicating database reset
    await prisma.log.create({
      data: {
        action: 'SYSTEM_HARD_RESET',
        details: 'Полная очистка базы данных: все складские остатки, витрина, закупки, поставщики, расходы и логи сброшены по нулям.',
        userId: 'SYSTEM'
      }
    });

    return NextResponse.json({ success: true, message: 'Database reset successfully' });
  } catch (error: any) {
    console.error('Error during hard reset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
