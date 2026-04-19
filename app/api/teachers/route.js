import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const teachers = await db.all('SELECT * FROM teachers ORDER BY name');
    return NextResponse.json(teachers);
  } catch (error) {
    console.error('Teachers GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
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
      return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 });
    }

    await db.run('INSERT INTO teachers (name) VALUES (?)', [name.trim()]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Преподаватель уже существует' }, { status: 400 });
    }
    console.error('Teachers POST error:', error);
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
    await db.run('DELETE FROM teachers WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Teachers DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}