import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configUrl = await prisma.wpConfig.findUnique({ where: { key: 'wordpress_url' } });
    const configCk = await prisma.wpConfig.findUnique({ where: { key: 'wordpress_ck' } });
    const configCs = await prisma.wpConfig.findUnique({ where: { key: 'wordpress_cs' } });

    const defaultUrl = process.env.WORDPRESS_URL || 'https://sarasotaflowersgifts.com/';
    const defaultCk = process.env.WP_CONSUMER_KEY || 'ck_0681c831858d16e8cbe03ed88e68bea5210f8cbe';
    const defaultCs = process.env.WP_CONSUMER_SECRET || 'cs_ce9fd3d97bf03a9d0763ba175688221cbba32cbb';

    return NextResponse.json({
      url: configUrl ? configUrl.value : defaultUrl,
      ck: configCk ? configCk.value : defaultCk,
      cs: configCs ? configCs.value : defaultCs,
      isCustomUrl: !!configUrl,
      isCustomCk: !!configCk,
      isCustomCs: !!configCs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { url, ck, cs } = await req.json();
    
    let updatedUrl = null;
    let updatedCk = null;
    let updatedCs = null;

    if (url !== undefined) {
      const cleanedUrl = url.trim().replace(/\/$/, ''); // Remove trailing slashes
      const config = await prisma.wpConfig.upsert({
        where: { key: 'wordpress_url' },
        update: { value: cleanedUrl },
        create: { key: 'wordpress_url', value: cleanedUrl }
      });
      updatedUrl = config.value;
    }

    if (ck !== undefined) {
      const cleanedCk = ck.trim();
      const config = await prisma.wpConfig.upsert({
        where: { key: 'wordpress_ck' },
        update: { value: cleanedCk },
        create: { key: 'wordpress_ck', value: cleanedCk }
      });
      updatedCk = config.value;
    }

    if (cs !== undefined) {
      const cleanedCs = cs.trim();
      const config = await prisma.wpConfig.upsert({
        where: { key: 'wordpress_cs' },
        update: { value: cleanedCs },
        create: { key: 'wordpress_cs', value: cleanedCs }
      });
      updatedCs = config.value;
    }

    return NextResponse.json({ 
      success: true, 
      url: updatedUrl, 
      ck: updatedCk, 
      cs: updatedCs 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
