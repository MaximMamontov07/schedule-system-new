// app/api/schedule/exceptions/route.js
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET - получить все исключения
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const teacherId = searchParams.get('teacherId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const date = searchParams.get('date');

    const db = await getDb();
    
    let query = `
      SELECT 
        e.*,
        g.name as group_name,
        t.name as teacher_name,
        s.name as subject_name,
        c.name as classroom_name,
        rt.name as replacement_teacher_name,
        rs.name as replacement_subject_name,
        rc.name as replacement_classroom_name
      FROM schedule_exceptions e
      LEFT JOIN groups g ON e.group_id = g.id
      LEFT JOIN teachers t ON e.teacher_id = t.id
      LEFT JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN classrooms c ON e.classroom_id = c.id
      LEFT JOIN teachers rt ON e.replacement_teacher_id = rt.id
      LEFT JOIN subjects rs ON e.replacement_subject_id = rs.id
      LEFT JOIN classrooms rc ON e.replacement_classroom_id = rc.id
      WHERE 1=1
    `;
    
    let params = [];
    let paramIndex = 1;

    if (groupId) {
      query += ` AND e.group_id = $${paramIndex++}`;
      params.push(parseInt(groupId));
    }
    
    if (teacherId) {
      query += ` AND (e.teacher_id = $${paramIndex++} OR e.replacement_teacher_id = $${paramIndex++})`;
      params.push(parseInt(teacherId), parseInt(teacherId));
    }
    
    if (date) {
      query += ` AND e.exception_date = $${paramIndex++}`;
      params.push(date);
    }
    
    if (startDate) {
      query += ` AND e.exception_date >= $${paramIndex++}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND e.exception_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ' ORDER BY e.exception_date, e.pair_number';
    
    const result = await db.query(query, params);
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Exceptions GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - создать или обновить исключение
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { 
      group_id, 
      teacher_id, 
      subject_id, 
      classroom_id, 
      pair_number, 
      exception_date, 
      exception_type,
      replacement_teacher_id,
      replacement_subject_id,
      replacement_classroom_id,
      notes
    } = body;

    console.log('📝 Creating exception:', body);

    // Проверяем обязательные поля
    if (!group_id || !pair_number || !exception_date || !exception_type) {
      return NextResponse.json({ 
        error: 'Не все обязательные поля заполнены' 
      }, { status: 400 });
    }

    // Проверяем, не существует ли уже исключение на эту дату/пару/группу
    const existing = await db.query(`
      SELECT id FROM schedule_exceptions 
      WHERE group_id = $1 AND pair_number = $2 AND exception_date = $3
    `, [parseInt(group_id), parseInt(pair_number), exception_date]);

    if (existing.rows.length > 0) {
      // Обновляем существующее
      const updateQuery = `
        UPDATE schedule_exceptions 
        SET exception_type = $1, 
            teacher_id = $2, 
            subject_id = $3, 
            classroom_id = $4,
            replacement_teacher_id = $5,
            replacement_subject_id = $6,
            replacement_classroom_id = $7,
            notes = $8
        WHERE id = $9
      `;
      
      await db.query(updateQuery, [
        exception_type,
        teacher_id ? parseInt(teacher_id) : null,
        subject_id ? parseInt(subject_id) : null,
        classroom_id ? parseInt(classroom_id) : null,
        replacement_teacher_id ? parseInt(replacement_teacher_id) : null,
        replacement_subject_id ? parseInt(replacement_subject_id) : null,
        replacement_classroom_id ? parseInt(replacement_classroom_id) : null,
        notes || null,
        existing.rows[0].id
      ]);
      
      return NextResponse.json({ success: true, updated: true });
    }

    // Создаём новое исключение
    const insertQuery = `
      INSERT INTO schedule_exceptions 
      (group_id, teacher_id, subject_id, classroom_id, pair_number, 
       exception_date, exception_type, replacement_teacher_id, 
       replacement_subject_id, replacement_classroom_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;
    
    const result = await db.query(insertQuery, [
      parseInt(group_id),
      teacher_id ? parseInt(teacher_id) : null,
      subject_id ? parseInt(subject_id) : null,
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number),
      exception_date,
      exception_type,
      replacement_teacher_id ? parseInt(replacement_teacher_id) : null,
      replacement_subject_id ? parseInt(replacement_subject_id) : null,
      replacement_classroom_id ? parseInt(replacement_classroom_id) : null,
      notes || null
    ]);

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Exceptions POST error:', error);
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
    console.error('Exceptions DELETE error:', error);
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
    
    const { 
      group_id, teacher_id, subject_id, classroom_id, 
      pair_number, exception_type, notes
    } = body;

    await db.query(`
      UPDATE schedule_exceptions 
      SET group_id = $1, teacher_id = $2, subject_id = $3, 
          classroom_id = $4, pair_number = $5, exception_type = $6, notes = $7
      WHERE id = $8
    `, [
      parseInt(group_id),
      teacher_id ? parseInt(teacher_id) : null,
      subject_id ? parseInt(subject_id) : null,
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number),
      exception_type,
      notes || null,
      parseInt(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exceptions PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}