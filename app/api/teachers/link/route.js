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
    
    const targetUser = await db.get('SELECT id, role, full_name FROM users WHERE id = ?', [userId]);
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }
    
    if (targetUser.role !== 'teacher') {
      return NextResponse.json({ error: 'Пользователь должен иметь роль teacher' }, { status: 400 });
    }
    
    const teacher = await db.get('SELECT id, name, user_id FROM teachers WHERE id = ?', [teacherId]);
    if (!teacher) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 });
    }
    
    if (teacher.user_id) {
      return NextResponse.json({ error: 'Преподаватель уже привязан к пользователю' }, { status: 400 });
    }
    
    await db.run('UPDATE teachers SET user_id = ? WHERE id = ?', [userId, teacherId]);
    
    return NextResponse.json({ 
      success: true,
      message: `Преподаватель "${teacher.name}" привязан к пользователю "${targetUser.full_name}"`
    });
  } catch (error) {
    console.error('Link error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
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
    await db.run('UPDATE teachers SET user_id = NULL WHERE id = ?', [teacherId]);
    
    return NextResponse.json({ success: true, message: 'Привязка удалена' });
  } catch (error) {
    console.error('Unlink error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}