import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET - получить исключения
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = await getDb();
    
    let query = `
      SELECT e.*, g.name as group_name, t.name as teacher_name, s.name as subject_name, c.name as classroom_name
      FROM schedule_exceptions e
      LEFT JOIN groups g ON e.group_id = g.id
      LEFT JOIN teachers t ON e.teacher_id = t.id
      LEFT JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN classrooms c ON e.classroom_id = c.id
      WHERE 1=1
    `;
    let params = [];
    let idx = 1;

    if (groupId) {
      query += ` AND e.group_id = $${idx++}`;
      params.push(parseInt(groupId));
    }
    if (startDate && endDate) {
      query += ` AND e.exception_date BETWEEN $${idx++} AND $${idx++}`;
      params.push(startDate, endDate);
    }

    query += ' ORDER BY e.exception_date, e.pair_number';
    
    const result = await db.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - создать исключение
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, exception_date, exception_type, notes } = body;

    // Проверяем, нет ли уже исключения
    const existing = await db.query(`
      SELECT id FROM schedule_exceptions 
      WHERE group_id = $1 AND pair_number = $2 AND exception_date = $3
    `, [parseInt(group_id), parseInt(pair_number), exception_date]);

    if (existing.rows.length > 0) {
      await db.query(`
        UPDATE schedule_exceptions 
        SET exception_type = $1, teacher_id = $2, subject_id = $3, classroom_id = $4, notes = $5
        WHERE id = $6
      `, [exception_type, teacher_id ? parseInt(teacher_id) : null, subject_id ? parseInt(subject_id) : null, classroom_id ? parseInt(classroom_id) : null, notes || null, existing.rows[0].id]);
    } else {
      await db.query(`
        INSERT INTO schedule_exceptions 
        (group_id, teacher_id, subject_id, classroom_id, pair_number, exception_date, exception_type, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [parseInt(group_id), teacher_id ? parseInt(teacher_id) : null, subject_id ? parseInt(subject_id) : null, classroom_id ? parseInt(classroom_id) : null, parseInt(pair_number), exception_date, exception_type, notes || null]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - удалить исключение
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    await db.query('DELETE FROM schedule_exceptions WHERE id = $1', [parseInt(id)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - обновить исключение
export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { teacher_id, subject_id, classroom_id, notes } = body;

    await db.query(`
      UPDATE schedule_exceptions 
      SET teacher_id = $1, subject_id = $2, classroom_id = $3, notes = $4
      WHERE id = $5
    `, [
      teacher_id ? parseInt(teacher_id) : null,
      subject_id ? parseInt(subject_id) : null,
      classroom_id ? parseInt(classroom_id) : null,
      notes || null,
      parseInt(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}