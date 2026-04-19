export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const classrooms = await db.all('SELECT * FROM classrooms ORDER BY name');
    return NextResponse.json(classrooms);
  } catch (error) {
    console.error('Classrooms GET error:', error);
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
    const { name, building, floor, capacity, type } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Название аудитории обязательно' }, { status: 400 });
    }

    await db.run(
      'INSERT INTO classrooms (name, building, floor, capacity, type) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), building || null, floor || null, capacity || null, type || 'standard']
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Аудитория уже существует' }, { status: 400 });
    }
    console.error('Classrooms POST error:', error);
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
    await db.run('DELETE FROM classrooms WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Classrooms DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}