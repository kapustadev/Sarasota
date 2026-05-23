import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    const dailyBackupPath = path.join(process.cwd(), 'prisma', 'dev.db.daily');

    // Auto-create daily backup from live database if it does not exist yet to simulate daily run
    if (!fs.existsSync(dailyBackupPath)) {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, dailyBackupPath);
      } else {
        const bakPath = path.join(process.cwd(), 'prisma', 'dev.db.bak');
        if (fs.existsSync(bakPath)) {
          fs.copyFileSync(bakPath, dailyBackupPath);
        }
      }
    }

    if (!fs.existsSync(dailyBackupPath)) {
      return NextResponse.json({ error: 'Файл автоматической резервной копии не найден!' }, { status: 404 });
    }

    // Force copy backup file back over the live SQLite database
    fs.copyFileSync(dailyBackupPath, dbPath);

    return NextResponse.json({ success: true, message: 'Database successfully restored from daily backup' });
  } catch (error: any) {
    console.error('Error during database restore:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
