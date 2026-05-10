import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET - получение шаблона расписания для группы
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    
    if (!groupId) {
      return NextResponse.json({ error: 'groupId обязателен' }, { status: 400 });
    }
    
    const db = await getDb();
    const result = await db.query(`
      SELECT st.*, 
             t.name as teacher_name,
             sub.name as subject_name,
             c.name as classroom_name
      FROM schedule_templates st
      LEFT JOIN teachers t ON st.teacher_id = t.id
      LEFT JOIN subjects sub ON st.subject_id = sub.id
      LEFT JOIN classrooms c ON st.classroom_id = c.id
      WHERE st.group_id = $1
      ORDER BY st.day_of_week, st.pair_number
    `, [groupId]);
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('GET templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - создание/обновление шаблона занятия
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }
    
    const db = await getDb();
    const { group_id, day_of_week, pair_number, teacher_id, subject_id, classroom_id } = await request.json();
    
    if (!group_id || !day_of_week || !pair_number) {
      return NextResponse.json({ error: 'Группа, день и пара обязательны' }, { status: 400 });
    }
    
    // Upsert - обновляем если есть, создаём если нет
    const result = await db.query(`
      INSERT INTO schedule_templates (group_id, day_of_week, pair_number, teacher_id, subject_id, classroom_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (group_id, day_of_week, pair_number) 
      DO UPDATE SET teacher_id = $4, subject_id = $5, classroom_id = $6, updated_at = NOW()
      RETURNING id
    `, [parseInt(group_id), parseInt(day_of_week), parseInt(pair_number), teacher_id ? parseInt(teacher_id) : null, subject_id ? parseInt(subject_id) : null, classroom_id ? parseInt(classroom_id) : null]);
    
    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('POST template error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - удаление из шаблона
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const dayOfWeek = searchParams.get('dayOfWeek');
    const pairNumber = searchParams.get('pairNumber');
    
    if (!groupId || !dayOfWeek || !pairNumber) {
      return NextResponse.json({ error: 'groupId, dayOfWeek, pairNumber обязательны' }, { status: 400 });
    }
    
    const db = await getDb();
    await db.query(
      'DELETE FROM schedule_templates WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3',
      [groupId, dayOfWeek, pairNumber]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE template error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}