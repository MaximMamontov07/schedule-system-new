import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const { teacherId, userId } = await request.json();
    
    if (!teacherId || !userId) {
      return NextResponse.json({ error: 'ID преподавателя и пользователя обязательны' }, { status: 400 });
    }

    const db = await getDb();
    
    // Проверяем существование колонки user_id
    const columnCheck = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'teachers' AND column_name = 'user_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      // Добавляем колонку если её нет
      await db.query('ALTER TABLE teachers ADD COLUMN user_id INTEGER UNIQUE');
    }
    
    // Проверяем пользователя
    const targetUser = await db.query('SELECT id, role, full_name FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }
    
    if (targetUser.rows[0].role !== 'teacher') {
      return NextResponse.json({ error: 'Пользователь должен иметь роль teacher' }, { status: 400 });
    }
    
    // Проверяем преподавателя
    const teacher = await db.query('SELECT id, name, user_id FROM teachers WHERE id = $1', [teacherId]);
    if (teacher.rows.length === 0) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 });
    }
    
    if (teacher.rows[0].user_id) {
      return NextResponse.json({ error: 'Преподаватель уже привязан' }, { status: 400 });
    }
    
    // Привязываем
    await db.query('UPDATE teachers SET user_id = $1 WHERE id = $2', [userId, teacherId]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Link error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    
    if (!teacherId) {
      return NextResponse.json({ error: 'ID преподавателя обязателен' }, { status: 400 });
    }

    const db = await getDb();
    await db.query('UPDATE teachers SET user_id = NULL WHERE id = $1', [teacherId]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unlink error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}