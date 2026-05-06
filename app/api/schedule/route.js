import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date } = body;

    const query = `
      INSERT INTO schedule (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.run(query, [
      group_id, 
      teacher_id, 
      subject_id, 
      classroom_id || null, 
      pair_number, 
      day_of_week,
      date || null
    ]);

    return NextResponse.json({ 
      success: true, 
      id: result.lastID 
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
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');

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
      WHERE 1=1
    `;
    let params = [];

    if (groupId) {
      query += ` AND s.group_id = ?`;
      params.push(parseInt(groupId));
    }

    if (weekStart && weekEnd) {
      query += ` AND (s.date BETWEEN ? AND ? OR s.date IS NULL)`;
      params.push(weekStart, weekEnd);
    }

    query += ' ORDER BY s.date, s.day_of_week, s.pair_number';
    
    const result = await db.all(query, params);
    
    return NextResponse.json(result || []);
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
    
    if (user.role === 'teacher') {
      const teacher = await db.get('SELECT id FROM teachers WHERE user_id = ?', [user.id]);
      if (teacher) {
        const lessonCheck = await db.get(
          'SELECT id FROM schedule WHERE id = ? AND teacher_id = ?',
          [id, teacher.id]
        );
        if (!lessonCheck) {
          return NextResponse.json({ error: 'Это не ваше занятие' }, { status: 403 });
        }
      }
    }
    
    await db.run(
      'UPDATE schedule SET notes = ?, status = ? WHERE id = ?',
      [notes || null, status || 'planned', id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}