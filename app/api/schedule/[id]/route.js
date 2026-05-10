// app/api/schedule/route.js - обновлённая версия
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

    // Fallback - возвращаем пустой массив
    return NextResponse.json([]);
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
    const exception = exceptions.find(e => e.pair_number === lesson.pair_number);
    
    if (exception && exception.exception_type === 'canceled') {
      continue; // Занятие отменено
    }
    
    if (exception && exception.exception_type === 'replaced') {
      // Заменённое занятие
      let replacementSubject = lesson.subject_name;
      let replacementTeacher = lesson.teacher_name;
      let replacementClassroom = lesson.classroom_name;
      
      if (exception.replacement_subject_id) {
        const subRes = await db.query('SELECT name FROM subjects WHERE id = $1', [exception.replacement_subject_id]);
        replacementSubject = subRes.rows[0]?.name || lesson.subject_name;
      }
      if (exception.replacement_teacher_id) {
        const teaRes = await db.query('SELECT name FROM teachers WHERE id = $1', [exception.replacement_teacher_id]);
        replacementTeacher = teaRes.rows[0]?.name || lesson.teacher_name;
      }
      if (exception.replacement_classroom_id) {
        const classRes = await db.query('SELECT name FROM classrooms WHERE id = $1', [exception.replacement_classroom_id]);
        replacementClassroom = classRes.rows[0]?.name || lesson.classroom_name;
      }
      
      finalSchedule.push({
        ...lesson,
        subject_name: replacementSubject,
        teacher_name: replacementTeacher,
        classroom_name: replacementClassroom,
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
      subject_name: subject.rows[0]?.name || 'Новый предмет',
      teacher_name: teacher.rows[0]?.name || 'Нет преподавателя',
      classroom_name: classroom.rows[0]?.name || null,
      notes: exception.notes,
      date: exception.exception_date,
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
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type } = body;

    // Проверяем обязательные поля
    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ 
        error: 'Не все обязательные поля заполнены'
      }, { status: 400 });
    }

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
      INSERT INTO schedule_template 
      (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type) 
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

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    await db.query(`
      UPDATE schedule_template 
      SET group_id = $1, teacher_id = $2, subject_id = $3, classroom_id = $4, 
          pair_number = $5, day_of_week = $6, week_type = $7
      WHERE id = $8
    `, [
      parseInt(group_id), 
      parseInt(teacher_id), 
      parseInt(subject_id),
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number), 
      parseInt(day_of_week), 
      week_type || 'all',
      parseInt(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PUT error:', error);
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
    const id = searchParams.get('id');
    const isTemplate = searchParams.get('isTemplate') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    const db = await getDb();
    
    if (isTemplate) {
      // Удаляем из шаблона
      await db.query('DELETE FROM schedule_template WHERE id = $1', [parseInt(id)]);
    } else {
      // Удаляем из старой таблицы (совместимость)
      await db.query('DELETE FROM schedule WHERE id = $1', [parseInt(id)]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}