import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST - создание занятия с проверкой конфликтов
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date } = body;

    // Проверка обязательных полей
    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ 
        error: 'Не все обязательные поля заполнены'
      }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Дата занятия обязательна' }, { status: 400 });
    }

    // Проверка конфликтов
    const groupConflict = await db.query(`
      SELECT s.*, g.name as group_name, sub.name as subject_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.group_id = $1 
        AND s.date = $2::date
        AND s.pair_number = $3
    `, [parseInt(group_id), date, parseInt(pair_number)]);
    
    if (groupConflict.rows.length > 0) {
      const conflict = groupConflict.rows[0];
      return NextResponse.json({ 
        error: `Группа уже занята в это время! Занятие: ${conflict.subject_name} в ${conflict.pair_number} пару`,
        conflict: true,
        type: 'group'
      }, { status: 409 });
    }
    
    const teacherConflict = await db.query(`
      SELECT s.*, t.name as teacher_name, sub.name as subject_name, g.name as group_name
      FROM schedule s
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
      JOIN groups g ON s.group_id = g.id
      WHERE s.teacher_id = $1 
        AND s.date = $2::date
        AND s.pair_number = $3
    `, [parseInt(teacher_id), date, parseInt(pair_number)]);
    
    if (teacherConflict.rows.length > 0) {
      const conflict = teacherConflict.rows[0];
      return NextResponse.json({ 
        error: `Преподаватель уже занят в это время! Занятие: ${conflict.subject_name} с группой ${conflict.group_name} в ${conflict.pair_number} пару`,
        conflict: true,
        type: 'teacher'
      }, { status: 409 });
    }
    
    if (classroom_id) {
      const classroomConflict = await db.query(`
        SELECT s.*, c.name as classroom_name, sub.name as subject_name, g.name as group_name
        FROM schedule s
        JOIN classrooms c ON s.classroom_id = c.id
        JOIN subjects sub ON s.subject_id = sub.id
        JOIN groups g ON s.group_id = g.id
        WHERE s.classroom_id = $1 
          AND s.date = $2::date
          AND s.pair_number = $3
      `, [parseInt(classroom_id), date, parseInt(pair_number)]);
      
      if (classroomConflict.rows.length > 0) {
        const conflict = classroomConflict.rows[0];
        return NextResponse.json({ 
          error: `Аудитория уже занята в это время! Занятие: ${conflict.subject_name} с группой ${conflict.group_name} в ${conflict.pair_number} пару`,
          conflict: true,
          type: 'classroom'
        }, { status: 409 });
      }
    }

    const query = `
      INSERT INTO schedule (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7::date)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      parseInt(group_id), 
      parseInt(teacher_id), 
      parseInt(subject_id), 
      classroom_id ? parseInt(classroom_id) : null, 
      parseInt(pair_number), 
      parseInt(day_of_week),
      date
    ]);

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

// GET - получение расписания
export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const teacherId = searchParams.get('teacherId');
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');
    const date = searchParams.get('date');

    let query = `
      SELECT 
        s.*,
        g.name as group_name,
        t.name as teacher_name,
        sub.name as subject_name,
        c.name as classroom_name,
        TO_CHAR(s.date, 'YYYY-MM-DD') as date_str
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN classrooms c ON s.classroom_id = c.id
      WHERE 1=1
    `;
    let params = [];
    let paramIndex = 1;

    if (groupId) {
      query += ` AND s.group_id = $${paramIndex++}`;
      params.push(parseInt(groupId));
    }
    
    if (teacherId) {
      query += ` AND s.teacher_id = $${paramIndex++}`;
      params.push(parseInt(teacherId));
    }

    if (weekStart && weekEnd) {
      query += ` AND s.date >= $${paramIndex++}::date AND s.date <= $${paramIndex++}::date`;
      params.push(weekStart, weekEnd);
    }
    
    if (date) {
      query += ` AND s.date = $${paramIndex++}::date`;
      params.push(date);
    }

    query += ' ORDER BY s.date, s.day_of_week, s.pair_number';
    
    const result = await db.query(query, params);
    
    const rows = result.rows.map(row => ({
      ...row,
      date: row.date_str
    }));
    
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// PUT - обновление занятия
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const { id } = await params;
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date } = await request.json();

    if (!date) {
      return NextResponse.json({ error: 'Дата занятия обязательна' }, { status: 400 });
    }

    const groupConflict = await db.query(`
      SELECT s.*, g.name as group_name, sub.name as subject_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.group_id = $1 
        AND s.date = $2::date 
        AND s.pair_number = $3
        AND s.id != $4
    `, [parseInt(group_id), date, parseInt(pair_number), parseInt(id)]);
    
    if (groupConflict.rows.length > 0) {
      const conflict = groupConflict.rows[0];
      return NextResponse.json({ 
        error: `Группа уже занята в это время! Занятие: ${conflict.subject_name} в ${conflict.pair_number} пару`,
        conflict: true,
        type: 'group'
      }, { status: 409 });
    }
    
    const teacherConflict = await db.query(`
      SELECT s.*, t.name as teacher_name, sub.name as subject_name, g.name as group_name
      FROM schedule s
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
      JOIN groups g ON s.group_id = g.id
      WHERE s.teacher_id = $1 
        AND s.date = $2::date 
        AND s.pair_number = $3
        AND s.id != $4
    `, [parseInt(teacher_id), date, parseInt(pair_number), parseInt(id)]);
    
    if (teacherConflict.rows.length > 0) {
      const conflict = teacherConflict.rows[0];
      return NextResponse.json({ 
        error: `Преподаватель уже занят в это время! Занятие: ${conflict.subject_name} с группой ${conflict.group_name} в ${conflict.pair_number} пару`,
        conflict: true,
        type: 'teacher'
      }, { status: 409 });
    }
    
    if (classroom_id) {
      const classroomConflict = await db.query(`
        SELECT s.*, c.name as classroom_name, sub.name as subject_name, g.name as group_name
        FROM schedule s
        JOIN classrooms c ON s.classroom_id = c.id
        JOIN subjects sub ON s.subject_id = sub.id
        JOIN groups g ON s.group_id = g.id
        WHERE s.classroom_id = $1 
          AND s.date = $2::date 
          AND s.pair_number = $3
          AND s.id != $4
      `, [parseInt(classroom_id), date, parseInt(pair_number), parseInt(id)]);
      
      if (classroomConflict.rows.length > 0) {
        const conflict = classroomConflict.rows[0];
        return NextResponse.json({ 
          error: `Аудитория уже занята в это время! Занятие: ${conflict.subject_name} с группой ${conflict.group_name} в ${conflict.pair_number} пару`,
          conflict: true,
          type: 'classroom'
        }, { status: 409 });
      }
    }

    await db.query(
      `UPDATE schedule 
       SET group_id = $1, teacher_id = $2, subject_id = $3, classroom_id = $4, 
           pair_number = $5, day_of_week = $6, date = $7::date
       WHERE id = $8`,
      [
        parseInt(group_id), 
        parseInt(teacher_id), 
        parseInt(subject_id), 
        classroom_id ? parseInt(classroom_id) : null, 
        parseInt(pair_number), 
        parseInt(day_of_week), 
        date,
        parseInt(id)
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PUT error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// DELETE - удаление занятия
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

// PATCH - обновление заметок
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