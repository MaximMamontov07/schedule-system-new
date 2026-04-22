import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const { id } = await params;
    
    await db.query('DELETE FROM schedule WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const { id } = await params;
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week } = await request.json();

    await db.query(
      `UPDATE schedule 
       SET group_id = $1, teacher_id = $2, subject_id = $3, classroom_id = $4, pair_number = $5, day_of_week = $6 
       WHERE id = $7`,
      [group_id, teacher_id, subject_id, classroom_id || null, pair_number, day_of_week, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PUT error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}