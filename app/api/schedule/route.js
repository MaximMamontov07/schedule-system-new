// app/api/schedule/route.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST - создание занятия (работает напрямую с schedule для простоты)
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    console.log('📥 POST /api/schedule - получены данные:', body);
    
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date } = body;

    // Проверяем обязательные поля
    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      console.log('❌ Не все поля заполнены:', { group_id, teacher_id, subject_id, pair_number, day_of_week });
      return NextResponse.json({ 
        error: 'Не все обязательные поля заполнены',
        required: { group_id, teacher_id, subject_id, pair_number, day_of_week }
      }, { status: 400 });
    }

    // Если дата не указана - используем текущую дату для дня недели
    let finalDate = date;
    if (!finalDate) {
      const today = new Date();
      const currentDay = today.getDay();
      const targetDay = parseInt(day_of_week);
      const diff = targetDay - (currentDay === 0 ? 7 : currentDay);
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      finalDate = targetDate.toISOString().split('T')[0];
    }

    console.log('📝 Сохраняем в schedule:', {
      group_id: parseInt(group_id),
      teacher_id: parseInt(teacher_id),
      subject_id: parseInt(subject_id),
      classroom_id: classroom_id ? parseInt(classroom_id) : null,
      pair_number: parseInt(pair_number),
      day_of_week: parseInt(day_of_week),
      date: finalDate
    });

    // Сохраняем напрямую в таблицу schedule (проще и надёжнее)
    const query = `
      INSERT INTO schedule 
      (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned')
      RETURNING id
    `;
    
    const result = await db.query(query, [
      parseInt(group_id), 
      parseInt(teacher_id), 
      parseInt(subject_id), 
      classroom_id ? parseInt(classroom_id) : null, 
      parseInt(pair_number), 
      parseInt(day_of_week),
      finalDate
    ]);

    console.log('✅ Занятие создано, ID:', result.rows[0]?.id);

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0]?.id,
      message: 'Занятие добавлено'
    });
  } catch (error) {
    console.error('❌ Schedule POST error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: error.toString()
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

    console.log('📡 GET /api/schedule - параметры:', { groupId, teacherId, weekStart, weekEnd, date });

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
    
    console.log('📝 Выполняем запрос:', query);
    console.log('📝 Параметры:', params);
    
    const result = await db.query(query, params);
    
    console.log(`✅ Найдено ${result.rows?.length || 0} занятий`);
    
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('❌ Schedule GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - обновление занятия
export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    
    console.log('📥 PUT /api/schedule - получены данные:', body);
    
    const { id, group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week, date } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    let finalDate = date;
    if (!finalDate) {
      const today = new Date();
      const currentDay = today.getDay();
      const targetDay = parseInt(day_of_week);
      const diff = targetDay - (currentDay === 0 ? 7 : currentDay);
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      finalDate = targetDate.toISOString().split('T')[0];
    }

    const query = `
      UPDATE schedule 
      SET group_id = $1, teacher_id = $2, subject_id = $3, 
          classroom_id = $4, pair_number = $5, day_of_week = $6, date = $7
      WHERE id = $8
    `;
    
    await db.query(query, [
      parseInt(group_id), 
      parseInt(teacher_id), 
      parseInt(subject_id),
      classroom_id ? parseInt(classroom_id) : null,
      parseInt(pair_number), 
      parseInt(day_of_week),
      finalDate,
      parseInt(id)
    ]);

    console.log('✅ Занятие обновлено, ID:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Schedule PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - удаление занятия
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
    await db.query('DELETE FROM schedule WHERE id = $1', [parseInt(id)]);

    console.log('✅ Занятие удалено, ID:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Schedule DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}