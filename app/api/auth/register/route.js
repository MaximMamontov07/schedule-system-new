import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { username, password, fullName, role, groupId } = await request.json();
    const currentUser = await getUserFromRequest(request);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Только администратор может создавать пользователей' },
        { status: 403 }
      );
    }
    
    if (!username || !password || !fullName) {
      return NextResponse.json(
        { error: 'Все поля обязательны' },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return NextResponse.json(
        { error: 'Пользователь уже существует' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.run(
      'INSERT INTO users (username, password, full_name, role, group_id) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, fullName, role || 'student', groupId || null]
    );

    if (role === 'teacher') {
      await db.run(
        'INSERT INTO teachers (name, user_id) VALUES (?, ?)',
        [fullName, result.lastID]
      );
    }

    const newUser = await db.get(
      'SELECT id, username, full_name, role, group_id FROM users WHERE id = ?',
      [result.lastID]
    );

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.full_name,
        role: newUser.role,
        groupId: newUser.group_id
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}