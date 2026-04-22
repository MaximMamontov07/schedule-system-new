import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET(request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const db = await getDb();
    const result = await db.query(`
      SELECT u.id, u.username, u.full_name, u.role, u.group_id, g.name as group_name, u.created_at
      FROM users u
      LEFT JOIN groups g ON u.group_id = g.id
      ORDER BY u.created_at DESC
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (parseInt(id) === currentUser.id) {
      return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 });
    }

    const db = await getDb();
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}