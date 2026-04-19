import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const db = await getDb();
    const user = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const teacherId = searchParams.get('teacherId');

    let query = `
      SELECT 
        s.*,
        g.name as group_name,
        t.name as teacher_name,
        sub.name as subject_name,
        c.name as classroom_name,
        c.building as classroom_building
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN classrooms c ON s.classroom_id = c.id
    `;
    let params = [];
    let conditions = [];

    if (user) {
      if (user.role === 'student' && user.groupId) {
        conditions.push('s.group_id = ?');
        params.push(user.groupId);
      } 
      else if (user.role === 'teacher') {
        const teacher = await db.get('SELECT id FROM teachers WHERE user_id = ?', [user.id]);
        if (teacher) {
          conditions.push('s.teacher_id = ?');
          params.push(teacher.id);
        } else {
          return NextResponse.json([]);
        }
      }
      else if (groupId && ['admin', 'methodist'].includes(user.role)) {
        conditions.push('s.group_id = ?');
        params.push(groupId);
      }
      else if (teacherId && user.role === 'admin') {
        conditions.push('s.teacher_id = ?');
        params.push(teacherId);
      }
    } 
    else if (groupId) {
      conditions.push('s.group_id = ?');
      params.push(groupId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.day_of_week, s.pair_number';
    
    const schedule = await db.all(query, params);
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Только методист и админ могут создавать занятия' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week } = body;

    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
    }

    // Проверяем конфликты аудитории
    if (classroom_id) {
      const conflict = await db.get(
        `SELECT s.*, g.name as group_name, t.name as teacher_name, sub.name as subject_name 
         FROM schedule s
         JOIN groups g ON s.group_id = g.id
         JOIN teachers t ON s.teacher_id = t.id
         JOIN subjects sub ON s.subject_id = sub.id
         WHERE s.classroom_id = ? AND s.day_of_week = ? AND s.pair_number = ?`,
        [classroom_id, day_of_week, pair_number]
      );
      
      if (conflict) {
        const classroom = await db.get('SELECT name FROM classrooms WHERE id = ?', [classroom_id]);
        return NextResponse.json({ 
          error: `Аудитория ${classroom?.name} уже занята в это время группой ${conflict.group_name} (${conflict.subject_name})` 
        }, { status: 409 });
      }
    }

    await db.run(
      `INSERT INTO schedule (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [group_id, teacher_id, subject_id, classroom_id || null, pair_number, day_of_week]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['teacher', 'methodist', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав для изменения' }, { status: 403 });
    }

    const body = await request.json();
    const { id, notes } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'ID занятия обязателен' }, { status: 400 });
    }

    const db = await getDb();
    const lesson = await db.get('SELECT * FROM schedule WHERE id = ?', [id]);
    
    if (!lesson) {
      return NextResponse.json({ error: 'Занятие не найдено' }, { status: 404 });
    }

    if (user.role === 'teacher') {
      const teacher = await db.get('SELECT id FROM teachers WHERE user_id = ?', [user.id]);
      if (!teacher || teacher.id !== lesson.teacher_id) {
        return NextResponse.json({ error: 'Это не ваше занятие' }, { status: 403 });
      }
      
      await db.run(
        'UPDATE schedule SET notes = ? WHERE id = ?',
        [notes !== undefined ? notes : lesson.notes, id]
      );
    }
    else if (['methodist', 'admin'].includes(user.role)) {
      await db.run(
        'UPDATE schedule SET notes = ? WHERE id = ?',
        [notes !== undefined ? notes : lesson.notes, id]
      );
    }
    else {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PATCH error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// Экспортируем только те методы, которые поддерживаются
export const runtime = 'nodejs';