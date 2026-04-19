import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}