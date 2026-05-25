import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

const PRISMA_DIR = path.join(process.cwd(), 'prisma');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (!body || !body.data) {
      return NextResponse.json({ error: 'Неверный формат файла импорта' }, { status: 400 });
    }

    const d = body.data;

    // Run inside database transaction
    await prisma.$transaction(async (tx) => {
      // Clear tables
      await tx.user.deleteMany();
      await tx.product.deleteMany();
      await tx.showcaseItem.deleteMany();
      await tx.template.deleteMany();
      await tx.transaction.deleteMany();
      await tx.log.deleteMany();
      await tx.wpProductRecipe.deleteMany();
      await tx.wpProcessedOrder.deleteMany();
      await tx.wpConfig.deleteMany();
      await tx.expense.deleteMany();

      // Seed/Restore
      if (d.users && d.users.length > 0) await tx.user.createMany({ data: d.users });
      if (d.products && d.products.length > 0) await tx.product.createMany({ data: d.products });
      if (d.showcaseItems && d.showcaseItems.length > 0) await tx.showcaseItem.createMany({ data: d.showcaseItems });
      if (d.templates && d.templates.length > 0) await tx.template.createMany({ data: d.templates });
      if (d.transactions && d.transactions.length > 0) await tx.transaction.createMany({ data: d.transactions });
      if (d.logs && d.logs.length > 0) await tx.log.createMany({ data: d.logs });
      if (d.wpProductRecipes && d.wpProductRecipes.length > 0) await tx.wpProductRecipe.createMany({ data: d.wpProductRecipes });
      if (d.wpProcessedOrders && d.wpProcessedOrders.length > 0) await tx.wpProcessedOrder.createMany({ data: d.wpProcessedOrders });
      if (d.wpConfigs && d.wpConfigs.length > 0) await tx.wpConfig.createMany({ data: d.wpConfigs });
      if (d.expenses && d.expenses.length > 0) await tx.expense.createMany({ data: d.expenses });
    });

    // Save a copy of the imported database locally as backup
    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `backup-imported-${timestamp}.json`;
    if (!fs.existsSync(PRISMA_DIR)) {
      fs.mkdirSync(PRISMA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(PRISMA_DIR, filename), JSON.stringify(body, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'База данных успешно импортирована!' });
  } catch (error: any) {
    console.error('Import upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
