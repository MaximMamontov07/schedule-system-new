import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT t.*, u.username, u.full_name as user_full_name 
      FROM teachers t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.name
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Teachers GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const db = await getDb();
    const { name, userId } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 });
    }

    // Добавляем преподавателя, user_id может быть NULL
    const result = await db.query(
      'INSERT INTO teachers (name, user_id) VALUES ($1, $2) RETURNING id',
      [name.trim(), userId || null]
    );
    
    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Преподаватель уже существует' }, { status: 400 });
    }
    console.error('Teachers POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    await db.query('DELETE FROM teachers WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Teachers DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}