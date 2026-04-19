import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Только администратор может создавать пользователей' },
        { status: 403 }
      );
    }

    const { username, password, fullName, role, groupId } = await request.json();

    if (!username || !password || !fullName) {
      return NextResponse.json(
        { error: 'Все поля обязательны' },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // Проверяем, существует ли пользователь
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Пользователь уже существует' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    const result = await db.query(
      'INSERT INTO users (username, password, full_name, role, group_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, hashedPassword, fullName, role || 'student', groupId || null]
    );
    
    const userId = result.rows[0].id;

    // Если создаем преподавателя - добавляем запись в таблицу teachers
    if (role === 'teacher') {
      await db.query(
        'INSERT INTO teachers (name, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET name = $1',
        [fullName, userId]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Пользователь создан',
      userId: userId
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера: ' + error.message },
      { status: 500 }
    );
  }
}