import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query('SELECT * FROM classrooms ORDER BY name');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Classrooms GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const db = await getDb();
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    await db.query('INSERT INTO classrooms (name) VALUES ($1)', [name.trim()]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Аудитория уже существует' }, { status: 400 });
    }
    console.error('Classrooms POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    await db.query('DELETE FROM classrooms WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Classrooms DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}