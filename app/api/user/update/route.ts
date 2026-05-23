import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId, newUsername, newPassword } = await req.json();

    if (!userId || !newUsername || !newPassword) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 });
    }

    // Clean inputs
    const usernameClean = newUsername.trim();
    const passwordClean = newPassword.trim();

    if (usernameClean.length < 3) {
      return NextResponse.json({ error: 'Логин должен быть не менее 3 символов' }, { status: 400 });
    }
    if (passwordClean.length < 3) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 3 символов' }, { status: 400 });
    }

    // Check if username is already taken by another user
    const existing = await prisma.user.findUnique({
      where: { username: usernameClean }
    });

    if (existing && existing.id !== userId) {
      return NextResponse.json({ 
        error: 'Этот логин уже занят. Пожалуйста, выберите другой.' 
      }, { status: 400 });
    }

    // Update user credentials
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        username: usernameClean,
        password: passwordClean
      }
    });

    // Exclude password from response
    const { password: _, ...userSafe } = updated;

    return NextResponse.json({ success: true, user: userSafe });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
