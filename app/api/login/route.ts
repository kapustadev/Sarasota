import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Логин или пароль неверный' }, { status: 401 });
    }

    // Return user without password
    const { password: _, ...userSafe } = user;
    
    return NextResponse.json({ success: true, user: userSafe });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
