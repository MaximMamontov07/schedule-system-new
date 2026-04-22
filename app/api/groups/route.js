import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query('SELECT * FROM groups ORDER BY name');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Groups GET error:', error);
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
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    await db.query('INSERT INTO groups (name) VALUES ($1)', [name.trim()]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Группа уже существует' }, { status: 400 });
    }
    console.error('Groups POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
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
    await db.query('DELETE FROM groups WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Groups DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}