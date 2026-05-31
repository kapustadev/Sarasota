export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PRISMA_DIR = path.join(process.cwd(), 'prisma');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');

    if (!filename || !filename.startsWith('backup-') || !filename.endsWith('.json')) {
      return new Response('Invalid filename', { status: 400 });
    }

    const filePath = path.join(PRISMA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return new Response(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}
