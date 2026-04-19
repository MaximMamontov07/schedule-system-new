export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET - получение профиля
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 });
    }

    const db = await getDb();
    const profile = await db.get(
      `SELECT u.id, u.username, u.full_name, u.role, u.group_id, g.name as group_name
       FROM users u
       LEFT JOIN groups g ON u.group_id = g.id
       WHERE u.id = ?`,
      [user.id]
    );

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// PUT - обновление профиля
export async function PUT(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Недействительный токен' }, { status: 401 });
    }

    const { fullName, currentPassword, newPassword } = await request.json();
    const db = await getDb();

    if (newPassword) {
      // Проверяем текущий пароль
      const userData = await db.get('SELECT password FROM users WHERE id = ?', [user.id]);
      const validPassword = await bcrypt.compare(currentPassword, userData.password);
      
      if (!validPassword) {
        return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.run('UPDATE users SET password = ?, full_name = ? WHERE id = ?', 
        [hashedPassword, fullName, user.id]);
    } else {
      await db.run('UPDATE users SET full_name = ? WHERE id = ?', [fullName, user.id]);
    }

    // Обновляем имя в teachers если пользователь - преподаватель
    if (user.role === 'teacher') {
      await db.run('UPDATE teachers SET name = ? WHERE user_id = ?', [fullName, user.id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}