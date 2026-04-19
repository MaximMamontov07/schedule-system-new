export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Только администратор может просматривать пользователей' }, { status: 403 });
    }

    const db = await getDb();
    const users = await db.all(`
      SELECT u.id, u.username, u.full_name, u.role, u.group_id, g.name as group_name, u.created_at
      FROM users u
      LEFT JOIN groups g ON u.group_id = g.id
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Только администратор может удалять пользователей' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (parseInt(id) === user.id) {
      return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}