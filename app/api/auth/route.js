export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    
    // Простая проверка логина и пароля
    if (username === 'admin' && password === '1234') {
      // Простой токен
      const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
      
      return NextResponse.json({ 
        token: token,
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Неверный логин или пароль' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}