import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET - возвращает расписание на неделю с учётом шаблона и исключений
export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');

    if (!groupId || !weekStart || !weekEnd) {
      return NextResponse.json([]);
    }

    console.log(`📡 Запрос: группа ${groupId}, неделя ${weekStart} - ${weekEnd}`);

    // 1. Получаем шаблон для группы
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

    // 2. Получаем исключения на эту неделю
    const exceptionsResult = await db.query(`
      SELECT * FROM schedule_exceptions 
      WHERE group_id = $1 AND exception_date BETWEEN $2 AND $3
    `, [parseInt(groupId), weekStart, weekEnd]);

    const exceptions = exceptionsResult.rows || [];

    // 3. Генерируем расписание для каждого дня
    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);
    const result = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();
      const dbDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
      
      const dayLessons = template.filter(l => l.day_of_week === dbDayOfWeek);
      
      for (const lesson of dayLessons) {
        const exception = exceptions.find(e => 
          e.pair_number === lesson.pair_number && e.exception_date === dateStr
        );
        
        if (exception?.exception_type === 'canceled') continue;
        
        if (exception?.exception_type === 'replaced') {
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
            const clsRes = await db.query('SELECT name FROM classrooms WHERE id = $1', [exception.replacement_classroom_id]);
            classroomName = clsRes.rows[0]?.name || lesson.classroom_name;
          }
          
          result.push({
            ...lesson,
            date: dateStr,
            subject_name: subjectName,
            teacher_name: teacherName,
            classroom_name: classroomName,
            is_exception: true,
            exception_type: 'replaced',
            notes: exception.notes
          });
        } else {
          result.push({ ...lesson, date: dateStr, is_exception: false });
        }
      }
      
      // Добавляем дополнительные занятия
      const addedExceptions = exceptions.filter(e => 
        e.exception_type === 'added' && e.exception_date === dateStr
      );
      
      for (const ex of addedExceptions) {
        const subject = await db.query('SELECT name FROM subjects WHERE id = $1', [ex.subject_id]);
        const teacher = await db.query('SELECT name FROM teachers WHERE id = $1', [ex.teacher_id]);
        const classroom = ex.classroom_id 
          ? await db.query('SELECT name FROM classrooms WHERE id = $1', [ex.classroom_id])
          : { rows: [null] };
        
        result.push({
          id: `exception_${ex.id}`,
          group_id: ex.group_id,
          teacher_id: ex.teacher_id,
          subject_id: ex.subject_id,
          classroom_id: ex.classroom_id,
          pair_number: ex.pair_number,
          day_of_week: dbDayOfWeek,
          date: dateStr,
          subject_name: subject.rows[0]?.name || 'Новый предмет',
          teacher_name: teacher.rows[0]?.name || 'Нет преподавателя',
          classroom_name: classroom.rows[0]?.name,
          notes: ex.notes,
          is_exception: true,
          exception_type: 'added'
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST - создание занятия (в шаблон или исключение)
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    console.log('📥 POST body:', body);
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type, is_exception, exception_date } = body;

    // Если это исключение (только на конкретную дату)
    if (is_exception || exception_date) {
      const existing = await db.query(`
        SELECT id FROM schedule_exceptions 
        WHERE group_id = $1 AND pair_number = $2 AND exception_date = $3
      `, [parseInt(group_id), parseInt(pair_number), exception_date]);
      
      if (existing.rows.length > 0) {
        await db.query(`
          UPDATE schedule_exceptions 
          SET teacher_id = $1, subject_id = $2, classroom_id = $3, exception_type = 'replaced'
          WHERE id = $4
        `, [parseInt(teacher_id), parseInt(subject_id), classroom_id ? parseInt(classroom_id) : null, existing.rows[0].id]);
      } else {
        await db.query(`
          INSERT INTO schedule_exceptions 
          (group_id, teacher_id, subject_id, classroom_id, pair_number, exception_date, exception_type)
          VALUES ($1, $2, $3, $4, $5, $6, 'added')
        `, [parseInt(group_id), parseInt(teacher_id), parseInt(subject_id), classroom_id ? parseInt(classroom_id) : null, parseInt(pair_number), exception_date]);
      }
      return NextResponse.json({ success: true });
    }
    
    // Иначе работаем с шаблоном
    const conflict = await db.query(`
      SELECT id FROM schedule_template 
      WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
    `, [parseInt(group_id), parseInt(day_of_week), parseInt(pair_number)]);
    
    if (conflict.rows.length > 0) {
      return NextResponse.json({ 
        error: `В шаблоне уже есть занятие в ${day_of_week} день, ${pair_number} пару`,
        conflict: true
      }, { status: 409 });
    }
    
    const result = await db.query(`
      INSERT INTO schedule_template 
      (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, week_type) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      parseInt(group_id), parseInt(teacher_id), parseInt(subject_id),
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number), parseInt(day_of_week), week_type || 'all'
    ]);

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('POST error:', error);
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
    console.error('PUT error:', error);
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
    const date = searchParams.get('date');

    const db = await getDb();
    
    if (isTemplate) {
      await db.query('DELETE FROM schedule_template WHERE id = $1', [parseInt(id)]);
    } else if (date && groupId && pairNumber) {
      await db.query(`
        INSERT INTO schedule_exceptions 
        (group_id, pair_number, exception_date, exception_type)
        VALUES ($1, $2, $3, 'canceled')
      `, [parseInt(groupId), parseInt(pairNumber), date]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}