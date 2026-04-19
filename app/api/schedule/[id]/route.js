export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// DELETE - только методист и админ
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Только методист и админ могут удалять занятия' }, { status: 403 });
    }

    const db = await getDb();
    const { id } = await params;
    
    await db.run('DELETE FROM schedule WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// PUT - только методист и админ
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Только методист и админ могут редактировать занятия' }, { status: 403 });
    }

    const db = await getDb();
    const { id } = await params;
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week } = await request.json();

    // Проверяем конфликты аудитории (исключая текущее занятие)
    if (classroom_id) {
      const conflict = await db.get(
        `SELECT s.*, g.name as group_name 
         FROM schedule s
         JOIN groups g ON s.group_id = g.id
         WHERE s.classroom_id = ? AND s.day_of_week = ? AND s.pair_number = ? AND s.id != ?`,
        [classroom_id, day_of_week, pair_number, id]
      );
      
      if (conflict) {
        const classroom = await db.get('SELECT name FROM classrooms WHERE id = ?', [classroom_id]);
        return NextResponse.json({ 
          error: `Аудитория ${classroom?.name} уже занята в это время группой ${conflict.group_name}` 
        }, { status: 409 });
      }
    }

    await db.run(
      `UPDATE schedule SET group_id = ?, teacher_id = ?, subject_id = ?, classroom_id = ?, pair_number = ?, day_of_week = ? WHERE id = ?`,
      [group_id, teacher_id, subject_id, classroom_id || null, pair_number, day_of_week, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PUT error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}