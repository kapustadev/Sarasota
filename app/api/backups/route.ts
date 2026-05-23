import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PRISMA_DIR = path.join(process.cwd(), 'prisma');
const DB_PATH = path.join(PRISMA_DIR, 'dev.db');
const MAX_BACKUPS = 7;

export interface BackupEntry {
  filename: string;     // e.g. "dev.db.backup.2024-05-23"
  date: string;         // ISO date string
  label: string;        // Human-readable, e.g. "23 мая 2024 (Сегодня)"
  sizeKb: number;
}

function getBackupFiles(): BackupEntry[] {
  const files = fs.readdirSync(PRISMA_DIR).filter(f => f.startsWith('dev.db.backup.'));
  const entries: BackupEntry[] = files.map(filename => {
    const dateStr = filename.replace('dev.db.backup.', ''); // "2024-05-23"
    const filePath = path.join(PRISMA_DIR, filename);
    const stat = fs.statSync(filePath);
    const date = new Date(dateStr + 'T03:00:00');
    const today = new Date();
    const isToday = dateStr === today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = dateStr === yesterday.toISOString().slice(0, 10);

    const dayLabel = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const suffix = isToday ? ' (Сегодня)' : isYesterday ? ' (Вчера)' : '';
    return {
      filename,
      date: dateStr,
      label: dayLabel + suffix,
      sizeKb: Math.round(stat.size / 1024)
    };
  });

  // Sort newest first
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

// POST action=create — create today's backup and prune old ones
// POST action=restore&filename=dev.db.backup.YYYY-MM-DD — restore from specific backup
export async function POST(req: Request) {
  try {
    const { action, filename } = await req.json();

    if (action === 'create') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const backupPath = path.join(PRISMA_DIR, `dev.db.backup.${todayStr}`);

      if (!fs.existsSync(DB_PATH)) {
        return NextResponse.json({ error: 'Файл базы данных не найден!' }, { status: 404 });
      }

      // Copy current DB to today's backup (overwrite if already exists)
      fs.copyFileSync(DB_PATH, backupPath);

      // Prune: keep only the latest MAX_BACKUPS
      const allBackups = getBackupFiles();
      if (allBackups.length > MAX_BACKUPS) {
        // allBackups sorted newest first; delete oldest ones beyond MAX_BACKUPS
        const toDelete = allBackups.slice(MAX_BACKUPS);
        toDelete.forEach(entry => {
          const delPath = path.join(PRISMA_DIR, entry.filename);
          if (fs.existsSync(delPath)) fs.unlinkSync(delPath);
        });
      }

      const updatedBackups = getBackupFiles();
      return NextResponse.json({ success: true, message: `Бэкап создан: dev.db.backup.${todayStr}`, backups: updatedBackups });

    } else if (action === 'restore') {
      if (!filename || !filename.startsWith('dev.db.backup.')) {
        return NextResponse.json({ error: 'Неверное имя файла бэкапа' }, { status: 400 });
      }
      const restorePath = path.join(PRISMA_DIR, filename);
      if (!fs.existsSync(restorePath)) {
        return NextResponse.json({ error: `Файл бэкапа не найден: ${filename}` }, { status: 404 });
      }

      // Before restoring, save current state as a backup
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentBackupPath = path.join(PRISMA_DIR, `dev.db.backup.${todayStr}`);
      if (fs.existsSync(DB_PATH) && !fs.existsSync(currentBackupPath)) {
        fs.copyFileSync(DB_PATH, currentBackupPath);
      }

      // Restore selected backup over live DB
      fs.copyFileSync(restorePath, DB_PATH);

      return NextResponse.json({ success: true, message: `База данных восстановлена из бэкапа ${filename}` });

    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Backup API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
