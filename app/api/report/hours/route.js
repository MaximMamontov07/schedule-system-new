import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function GET(request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Только администратор' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');

    if (!teacherId) {
      return NextResponse.json({ error: 'Выберите преподавателя' }, { status: 400 });
    }

    const db = await getDb();

    // Получаем информацию о преподавателе
    const teacher = await db.query('SELECT name FROM teachers WHERE id = $1', [parseInt(teacherId)]);
    if (teacher.rows.length === 0) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 });
    }

    // Получаем все занятия преподавателя
    const result = await db.query(`
      SELECT 
        s.*,
        g.name as group_name,
        sub.name as subject_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.teacher_id = $1
      ORDER BY s.day_of_week, s.pair_number
    `, [parseInt(teacherId)]);

    const lessons = result.rows;
    const totalHours = lessons.length;

    // Подсчет часов по дням недели
    const weekdayHours = lessons.filter(l => l.day_of_week <= 5).length;
    const saturdayHours = lessons.filter(l => l.day_of_week === 6).length;

    return NextResponse.json({
      teacher: {
        id: parseInt(teacherId),
        name: teacher.rows[0].name
      },
      summary: {
        totalHours: totalHours,
        weekdayHours: weekdayHours,
        saturdayHours: saturdayHours,
        totalLessons: lessons.length
      },
      lessons: lessons.map(lesson => ({
        id: lesson.id,
        group_name: lesson.group_name,
        subject_name: lesson.subject_name,
        pair_number: lesson.pair_number,
        day_of_week: lesson.day_of_week
      }))
    });
  } catch (error) {
    console.error('Report hours error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}