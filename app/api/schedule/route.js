import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const db = await getDb();
    const user = await getUserFromRequest(request);
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
    let conditions = [];

    if (user && user.role === 'teacher') {
      const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [user.id]);
      if (teacher.rows.length > 0) {
        conditions.push('s.teacher_id = $' + (params.length + 1));
        params.push(teacher.rows[0].id);
      }
    } else if (groupId) {
      conditions.push('s.group_id = $' + (params.length + 1));
      params.push(parseInt(groupId));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
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
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week } = body;

    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
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

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}