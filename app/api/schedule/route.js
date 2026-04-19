import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    let query = `
      SELECT 
        s.*,
        g.name as group_name,
        t.name as teacher_name,
        sub.name as subject_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
    `;
    let params = [];

    if (groupId) {
      query += ' WHERE s.group_id = $1';
      params.push(parseInt(groupId));
    }

    query += ' ORDER BY s.day_of_week, s.pair_number';
    
    const result = await db.query(query, params);
    
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Только методист и админ могут создавать занятия' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week } = body;

    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
    }

    // Проверяем, что группа существует
    const groupCheck = await db.query('SELECT id FROM groups WHERE id = $1', [group_id]);
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Группа не найдена' }, { status: 400 });
    }

    // Проверяем, что преподаватель существует
    const teacherCheck = await db.query('SELECT id FROM teachers WHERE id = $1', [teacher_id]);
    if (teacherCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 400 });
    }

    // Проверяем, что предмет существует
    const subjectCheck = await db.query('SELECT id FROM subjects WHERE id = $1', [subject_id]);
    if (subjectCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Предмет не найден' }, { status: 400 });
    }

    const query = `
      INSERT INTO schedule (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week) 
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      parseInt(group_id), 
      parseInt(teacher_id), 
      parseInt(subject_id), 
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number), 
      parseInt(day_of_week)
    ]);

    return NextResponse.json({ 
      success: true, 
      message: 'Занятие добавлено',
      id: result.rows[0].id 
    });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    await db.query('DELETE FROM schedule WHERE id = $1', [parseInt(id)]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}