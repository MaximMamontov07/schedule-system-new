// app/api/schedule/route.js - ОБНОВЛЁННАЯ ВЕРСИЯ
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET - возвращает расписание на неделю с учётом шаблона и исключений
// app/api/schedule/route.js - исправленный GET
export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');

    // Если нет группы или дат - возвращаем пустой массив
    if (!groupId || !weekStart || !weekEnd) {
      return NextResponse.json([]);
    }

    console.log(`📡 Запрос расписания: группа ${groupId}, неделя ${weekStart} - ${weekEnd}`);

    // 1. Получаем шаблон для этой группы
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
      WHERE t.group_id = $1
    `, [parseInt(groupId)]);

    const template = templateResult.rows || [];
    console.log(`📋 Шаблон: ${template.length} занятий`);

    // 2. Получаем исключения на эту неделю
    const exceptionsResult = await db.query(`
      SELECT * FROM schedule_exceptions 
      WHERE group_id = $1 AND exception_date BETWEEN $2 AND $3
    `, [parseInt(groupId), weekStart, weekEnd]);

    const exceptions = exceptionsResult.rows || [];
    console.log(`⚠️ Исключения: ${exceptions.length}`);

    // 3. Генерируем расписание для каждого дня недели
    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);
    const result = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();
      const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
      
      // Берём занятия из шаблона для этого дня
      const dayLessons = template.filter(l => l.day_of_week === dbDayOfWeek);
      
      for (const lesson of dayLessons) {
        // Проверяем, есть ли исключение для этого занятия
        const exception = exceptions.find(e => 
          e.pair_number === lesson.pair_number && 
          e.exception_date === dateStr
        );
        
        if (exception && exception.exception_type === 'canceled') {
          continue; // Пропускаем отменённое занятие
        }
        
        if (exception && exception.exception_type === 'replaced') {
          // Заменённое занятие
          let subjectName = lesson.subject_name;
          let teacherName = lesson.teacher_name;
          let classroomName = lesson.classroom_name;
          
          if (exception.replacement_subject_id) {
            const subRes = await db.query('SELECT name FROM subjects WHERE id = $1', [exception.replacement_subject_id]);
            subjectName = subRes.rows[0]?.name || lesson.subject_name;
          }
          if (exception.replacement_teacher_id) {
            const teaRes = await db.query('SELECT name FROM teachers WHERE id = $1', [exception.replacement_teacher_id]);
            teacherName = teaRes.rows[0]?.name || lesson.teacher_name;
          }
          if (exception.replacement_classroom_id) {
            const classRes = await db.query('SELECT name FROM classrooms WHERE id = $1', [exception.replacement_classroom_id]);
            classroomName = classRes.rows[0]?.name || lesson.classroom_name;
          }
          
          result.push({
            id: lesson.id,
            group_id: lesson.group_id,
            teacher_id: lesson.teacher_id,
            subject_id: lesson.subject_id,
            classroom_id: lesson.classroom_id,
            pair_number: lesson.pair_number,
            day_of_week: lesson.day_of_week,
            date: dateStr,
            subject_name: subjectName,
            teacher_name: teacherName,
            classroom_name: classroomName,
            is_exception: true,
            exception_type: 'replaced',
            notes: exception.notes
          });
        } else {
          // Обычное занятие из шаблона
          result.push({
            ...lesson,
            date: dateStr,
            is_exception: false
          });
        }
      }
      
      // Добавляем дополнительные занятия (added)
      const addedExceptions = exceptions.filter(e => 
        e.exception_type === 'added' && e.exception_date === dateStr
      );
      
      for (const exception of addedExceptions) {
        const subject = await db.query('SELECT name FROM subjects WHERE id = $1', [exception.subject_id]);
        const teacher = await db.query('SELECT name FROM teachers WHERE id = $1', [exception.teacher_id]);
        const classroom = exception.classroom_id 
          ? await db.query('SELECT name FROM classrooms WHERE id = $1', [exception.classroom_id])
          : { rows: [null] };
        
        result.push({
          id: `exception_${exception.id}`,
          group_id: exception.group_id,
          teacher_id: exception.teacher_id,
          subject_id: exception.subject_id,
          classroom_id: exception.classroom_id,
          pair_number: exception.pair_number,
          day_of_week: dbDayOfWeek,
          date: dateStr,
          subject_name: subject.rows[0]?.name || 'Новый предмет',
          teacher_name: teacher.rows[0]?.name || 'Нет преподавателя',
          classroom_name: classroom.rows[0]?.name || null,
          notes: exception.notes,
          is_exception: true,
          exception_type: 'added'
        });
      }
    }

    console.log(`✅ Сгенерировано ${result.length} занятий для недели`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// app/api/schedule/route.js - исправленный POST
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type } = body;

    console.log('📝 Создание занятия в шаблоне:', body);

    // Проверяем обязательные поля
    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ 
        error: 'Не все обязательные поля заполнены',
        received: { group_id, teacher_id, subject_id, pair_number, day_of_week }
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

    console.log('✅ Занятие создано, ID:', result.rows[0].id);

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