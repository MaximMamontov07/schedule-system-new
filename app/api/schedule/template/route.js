// app/api/schedule/template/route.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT t.*, g.name as group_name, tch.name as teacher_name,
             s.name as subject_name, c.name as classroom_name
      FROM schedule_templates t
      JOIN groups g ON t.group_id = g.id
      JOIN teachers tch ON t.teacher_id = tch.id
      JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN classrooms c ON t.classroom_id = c.id
      ORDER BY t.group_id, t.day_of_week, t.pair_number
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Template GET error:', error);
    return NextResponse.json([]);
  }
}

export async function DELETE(request) {
  const user = await getUserFromRequest(request);
  if (!user || !['admin', 'methodist'].includes(user.role)) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
  }
  try {
    const db = await getDb();
    await db.query('DELETE FROM schedule_templates WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}