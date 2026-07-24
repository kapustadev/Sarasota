export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';

const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
const PRISMA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'prisma-backups') : path.join(process.cwd(), 'prisma');
const MAX_BACKUPS = 7;

export interface BackupEntry {
  filename: string;
  date: string;
  label: string;
  sizeKb: number;
}

function getBackupFiles(): BackupEntry[] {
  if (!fs.existsSync(PRISMA_DIR)) {
    fs.mkdirSync(PRISMA_DIR, { recursive: true });
  }
  const files = fs.readdirSync(PRISMA_DIR).filter(f => f.startsWith('backup-') && f.endsWith('.json'));
  const entries: BackupEntry[] = files.map(filename => {
    const parts = filename.replace('backup-', '').replace('.json', '').split('-');
    const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const timeStr = parts[3] ? `${parts[3].slice(0, 2)}:${parts[3].slice(2, 4)}:${parts[3].slice(4, 6)}` : '00:00:00';
    
    const filePath = path.join(PRISMA_DIR, filename);
    const stat = fs.statSync(filePath);
    const date = new Date(`${dateStr}T${timeStr}`);
    
    const dayLabel = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeLabel = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const today = new Date();
    const isToday = dateStr === today.toISOString().slice(0, 10);
    const suffix = isToday ? ' (Сегодня)' : '';
    
    return {
      filename,
      date: date.toISOString(),
      label: `${dayLabel} ${timeLabel}${suffix}`,
      sizeKb: Math.round(stat.size / 1024)
    };
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// GET — list all available backups
export async function GET() {
  try {
    const backups = getBackupFiles();
    return NextResponse.json({ backups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST actions: create, restore, delete
export async function POST(req: Request) {
  try {
    const { action, filename } = await req.json();

    if (action === 'create') {
      // Fetch all database tables
      const users = await prisma.user.findMany();
      const products = await prisma.product.findMany();
      const showcaseItems = await prisma.showcaseItem.findMany();
      const templates = await prisma.template.findMany();
      const transactions = await prisma.transaction.findMany();
      const logs = await prisma.log.findMany();
      const wpProductRecipes = await prisma.wpProductRecipe.findMany();
      const wpProcessedOrders = await prisma.wpProcessedOrder.findMany();
      const wpConfigs = await prisma.wpConfig.findMany();
      const expenses = await prisma.expense.findMany();

      const backupData = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        data: {
          users,
          products,
          showcaseItems,
          templates,
          transactions,
          logs,
          wpProductRecipes,
          wpProcessedOrders,
          wpConfigs,
          expenses
        }
      };

      const now = new Date();
      const pad = (num: number) => String(num).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const newFilename = `backup-${timestamp}.json`;
      const backupPath = path.join(PRISMA_DIR, newFilename);

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

      // Prune old backups beyond MAX_BACKUPS
      const allBackups = getBackupFiles();
      if (allBackups.length > MAX_BACKUPS) {
        const toDelete = allBackups.slice(MAX_BACKUPS);
        toDelete.forEach(entry => {
          const delPath = path.join(PRISMA_DIR, entry.filename);
          if (fs.existsSync(delPath)) fs.unlinkSync(delPath);
        });
      }

      const updatedBackups = getBackupFiles();
      return NextResponse.json({ success: true, message: `Резервная копия создана: ${newFilename}`, backups: updatedBackups });

    } else if (action === 'restore') {
      if (!filename || !filename.startsWith('backup-') || !filename.endsWith('.json')) {
        return NextResponse.json({ error: 'Неверное имя файла бэкапа' }, { status: 400 });
      }
      const restorePath = path.join(PRISMA_DIR, filename);
      if (!fs.existsSync(restorePath)) {
        return NextResponse.json({ error: `Файл бэкапа не найден: ${filename}` }, { status: 404 });
      }

      const fileContent = fs.readFileSync(restorePath, 'utf-8');
      const backup = JSON.parse(fileContent);

      if (!backup.data) {
        return NextResponse.json({ error: 'Неверный формат бэкапа' }, { status: 400 });
      }

      const d = backup.data;

      // Restore inside transaction to be safe
      await prisma.$transaction(async (tx) => {
        // Clear all tables
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

        // Restore tables
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

      return NextResponse.json({ success: true, message: `База данных успешно восстановлена из резервной копии ${filename}` });

    } else if (action === 'delete') {
      if (!filename || !filename.startsWith('backup-') || !filename.endsWith('.json')) {
        return NextResponse.json({ error: 'Неверное имя файла бэкапа' }, { status: 400 });
      }
      const delPath = path.join(PRISMA_DIR, filename);
      if (fs.existsSync(delPath)) {
        fs.unlinkSync(delPath);
      }

      const updatedBackups = getBackupFiles();
      return NextResponse.json({ success: true, message: `Резервная копия ${filename} удалена`, backups: updatedBackups });

    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Backup API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
