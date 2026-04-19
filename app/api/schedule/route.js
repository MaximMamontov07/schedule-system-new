import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    console.log('User in POST:', user);
    
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const db = await getDb();
    const body = await request.json();
    console.log('Request body:', body);
    
    const { group_id, teacher_id, subject_id, pair_number, day_of_week } = body;

    const query = `
      INSERT INTO schedule (group_id, teacher_id, subject_id, pair_number, day_of_week) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      group_id, 
      teacher_id, 
      subject_id, 
      pair_number, 
      day_of_week
    ]);

    console.log('Created schedule id:', result.rows[0].id);

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id 
    });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

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
        sub.name as subject_name,
        c.name as classroom_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN classrooms c ON s.classroom_id = c.id
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
export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id, notes, status } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'ID занятия обязателен' }, { status: 400 });
    }

    const db = await getDb();
    
    // Проверяем права для преподавателя
    if (user.role === 'teacher') {
      const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [user.id]);
      if (teacher.rows.length > 0) {
        const lessonCheck = await db.query(
          'SELECT id FROM schedule WHERE id = $1 AND teacher_id = $2',
          [id, teacher.rows[0].id]
        );
        if (lessonCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Это не ваше занятие' }, { status: 403 });
        }
      }
    }
    
    // Обновляем заметки
    await db.query(
      'UPDATE schedule SET notes = $1, status = $2 WHERE id = $3',
      [notes || null, status || 'planned', id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}