import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

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

    // Проверка конфликтов
    const groupConflict = await db.query(`
      SELECT s.*, g.name as group_name, sub.name as subject_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.group_id = $1 
        AND s.date = $2 
        AND s.pair_number = $3
        AND s.id != $4
    `, [parseInt(group_id), date, parseInt(pair_number), parseInt(id)]);
    
    if (groupConflict.rows.length > 0) {
      const conflict = groupConflict.rows[0];
      return NextResponse.json({ 
        error: `Группа уже занята в это время! Занятие: ${conflict.subject_name}`,
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
        AND s.date = $2 
        AND s.pair_number = $3
        AND s.id != $4
    `, [parseInt(teacher_id), date, parseInt(pair_number), parseInt(id)]);
    
    if (teacherConflict.rows.length > 0) {
      const conflict = teacherConflict.rows[0];
      return NextResponse.json({ 
        error: `Преподаватель уже занят в это время! Занятие: ${conflict.subject_name} с группой ${conflict.group_name}`,
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
          AND s.date = $2 
          AND s.pair_number = $3
          AND s.id != $4
      `, [parseInt(classroom_id), date, parseInt(pair_number), parseInt(id)]);
      
      if (classroomConflict.rows.length > 0) {
        const conflict = classroomConflict.rows[0];
        return NextResponse.json({ 
          error: `Аудитория уже занята в это время! Занятие: ${conflict.subject_name} с группой ${conflict.group_name}`,
          conflict: true,
          type: 'classroom'
        }, { status: 409 });
      }
    }

    // Обновляем занятие и помечаем как исключение (ручное изменение)
    await db.query(
      `UPDATE schedule 
       SET group_id = $1, teacher_id = $2, subject_id = $3, classroom_id = $4, 
           pair_number = $5, day_of_week = $6, date = $7, is_exception = true, updated_at = NOW()
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