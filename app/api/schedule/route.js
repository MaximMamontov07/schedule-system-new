// app/api/schedule/route.js - ОБНОВЛЁННАЯ ВЕРСИЯ
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET - возвращает расписание на неделю с учётом шаблона и исключений
export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const teacherId = searchParams.get('teacherId');
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');
    const date = searchParams.get('date');

    // Если нужна конкретная дата с исключениями
    if (date && groupId) {
      const schedule = await getScheduleForDate(db, parseInt(groupId), date);
      return NextResponse.json(schedule);
    }

    // Если нужна неделя
    if (weekStart && weekEnd && groupId) {
      const schedule = await getScheduleForWeek(db, parseInt(groupId), weekStart, weekEnd);
      return NextResponse.json(schedule);
    }

    // Для совместимости со старым кодом
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
      query += ` AND s.date >= $${paramIndex++} AND s.date <= $${paramIndex++}`;
      params.push(weekStart, weekEnd);
    }
    
    if (date) {
      query += ` AND s.date = $${paramIndex++}`;
      params.push(date);
    }

    query += ' ORDER BY s.date, s.day_of_week, s.pair_number';
    
    const result = await db.query(query, params);
    
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// Функция получения расписания на конкретную дату
async function getScheduleForDate(db, groupId, date) {
  // Получаем день недели
  const dayOfWeek = new Date(date).getDay();
  const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
  
  // Получаем шаблон
  const templateResult = await db.query(`
    SELECT 
      t.*,
      sub.name as subject_name,
      tea.name as teacher_name,
      c.name as classroom_name
    FROM schedule_template t
    JOIN subjects sub ON t.subject_id = sub.id
    JOIN teachers tea ON t.teacher_id = tea.id
    LEFT JOIN classrooms c ON t.classroom_id = c.id
    WHERE t.group_id = $1 AND t.day_of_week = $2
  `, [groupId, dbDayOfWeek]);
  
  const templateLessons = templateResult.rows || [];
  
  // Получаем исключения на эту дату
  const exceptionsResult = await db.query(`
    SELECT * FROM schedule_exceptions 
    WHERE group_id = $1 AND exception_date = $2
  `, [groupId, date]);
  
  const exceptions = exceptionsResult.rows || [];
  
  // Применяем исключения
  const finalSchedule = [];
  
  for (const lesson of templateLessons) {
    const exception = exceptions.find(e => 
      e.pair_number === lesson.pair_number && 
      (!e.template_id || e.template_id === lesson.id)
    );
    
    if (exception && exception.exception_type === 'canceled') {
      continue; // Занятие отменено
    }
    
    if (exception && exception.exception_type === 'replaced') {
      // Заменённое занятие
      finalSchedule.push({
        ...lesson,
        id: `exception_${exception.id}`,
        subject_name: exception.replacement_subject_id 
          ? (await db.query('SELECT name FROM subjects WHERE id = $1', [exception.replacement_subject_id])).rows[0]?.name 
          : lesson.subject_name,
        teacher_name: exception.replacement_teacher_id
          ? (await db.query('SELECT name FROM teachers WHERE id = $1', [exception.replacement_teacher_id])).rows[0]?.name
          : lesson.teacher_name,
        classroom_name: exception.replacement_classroom_id
          ? (await db.query('SELECT name FROM classrooms WHERE id = $1', [exception.replacement_classroom_id])).rows[0]?.name
          : lesson.classroom_name,
        notes: exception.notes,
        is_exception: true,
        exception_type: 'replaced'
      });
    } else {
      finalSchedule.push(lesson);
    }
  }
  
  // Добавляем дополнительные занятия (added)
  for (const exception of exceptions.filter(e => e.exception_type === 'added')) {
    const subject = await db.query('SELECT name FROM subjects WHERE id = $1', [exception.subject_id]);
    const teacher = await db.query('SELECT name FROM teachers WHERE id = $1', [exception.teacher_id]);
    const classroom = exception.classroom_id 
      ? await db.query('SELECT name FROM classrooms WHERE id = $1', [exception.classroom_id])
      : { rows: [null] };
    
    finalSchedule.push({
      id: `exception_added_${exception.id}`,
      group_id: exception.group_id,
      teacher_id: exception.teacher_id,
      subject_id: exception.subject_id,
      classroom_id: exception.classroom_id,
      pair_number: exception.pair_number,
      day_of_week: dbDayOfWeek,
      subject_name: subject.rows[0]?.name,
      teacher_name: teacher.rows[0]?.name,
      classroom_name: classroom.rows[0]?.name,
      notes: exception.notes,
      is_exception: true,
      exception_type: 'added'
    });
  }
  
  return finalSchedule.sort((a, b) => a.pair_number - b.pair_number);
}

// Функция получения расписания на неделю
async function getScheduleForWeek(db, groupId, weekStart, weekEnd) {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  const result = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dailySchedule = await getScheduleForDate(db, groupId, dateStr);
    result.push(...dailySchedule.map(l => ({ ...l, date: dateStr })));
  }
  
  return result;
}

// POST - создание/обновление шаблона
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type, is_exception, exception_date } = body;

    // Если это исключение
    if (is_exception && exception_date) {
      // Проверяем, не создавали ли уже исключение
      const existing = await db.query(`
        SELECT id FROM schedule_exceptions 
        WHERE group_id = $1 AND pair_number = $2 AND exception_date = $3
      `, [parseInt(group_id), parseInt(pair_number), exception_date]);
      
      if (existing.rows.length > 0) {
        // Обновляем
        await db.query(`
          UPDATE schedule_exceptions 
          SET teacher_id = $1, subject_id = $2, classroom_id = $3, 
              exception_type = 'replaced', notes = $4
          WHERE id = $5
        `, [
          parseInt(teacher_id), parseInt(subject_id), 
          classroom_id ? parseInt(classroom_id) : null,
          body.notes || null,
          existing.rows[0].id
        ]);
      } else {
        // Создаём
        await db.query(`
          INSERT INTO schedule_exceptions 
          (group_id, teacher_id, subject_id, classroom_id, pair_number, exception_date, exception_type)
          VALUES ($1, $2, $3, $4, $5, $6, 'replaced')
        `, [
          parseInt(group_id), parseInt(teacher_id), parseInt(subject_id),
          classroom_id ? parseInt(classroom_id) : null,
          parseInt(pair_number), exception_date
        ]);
      }
      return NextResponse.json({ success: true, type: 'exception' });
    }
    
    // Иначе работаем с шаблоном
    // Проверяем конфликты в шаблоне
    const conflict = await db.query(`
      SELECT * FROM schedule_template 
      WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
    `, [parseInt(group_id), parseInt(day_of_week), parseInt(pair_number)]);
    
    if (conflict.rows.length > 0) {
      return NextResponse.json({ 
        error: `В шаблоне уже есть занятие в ${day_of_week} день, ${pair_number} пару`,
        conflict: true
      }, { status: 409 });
    }
    
    const query = `
      INSERT INTO schedule_template (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      parseInt(group_id), 
      parseInt(teacher_id), 
      parseInt(subject_id), 
      classroom_id ? parseInt(classroom_id) : null, 
      parseInt(pair_number), 
      parseInt(day_of_week),
      week_type || 'all'
    ]);

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - удаление из шаблона или создание исключения на отмену
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isTemplate = searchParams.get('isTemplate') === 'true';
    const groupId = searchParams.get('groupId');
    const pairNumber = searchParams.get('pairNumber');
    const dayOfWeek = searchParams.get('dayOfWeek');
    const date = searchParams.get('date'); // для исключения

    const db = await getDb();
    
    if (isTemplate) {
      // Удаляем из шаблона
      await db.query('DELETE FROM schedule_template WHERE id = $1', [id]);
    } else if (date && groupId && pairNumber) {
      // Создаём исключение на отмену для конкретной даты
      await db.query(`
        INSERT INTO schedule_exceptions 
        (group_id, pair_number, exception_date, exception_type)
        VALUES ($1, $2, $3, 'canceled')
      `, [parseInt(groupId), parseInt(pairNumber), date]);
    } else {
      // Совместимость со старым API
      await db.query('DELETE FROM schedule WHERE id = $1', [id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// PUT - обновление шаблона
export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { id, group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type } = body;

    await db.query(`
      UPDATE schedule_template 
      SET group_id = $1, teacher_id = $2, subject_id = $3, classroom_id = $4, 
          pair_number = $5, day_of_week = $6, week_type = $7
      WHERE id = $8
    `, [
      parseInt(group_id), parseInt(teacher_id), parseInt(subject_id),
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number), parseInt(day_of_week), week_type || 'all',
      parseInt(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PUT error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}