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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!teacherId) {
      return NextResponse.json({ error: 'Выберите преподавателя' }, { status: 400 });
    }

    const db = await getDb();

    // Получаем информацию о преподавателе
    const teacher = await db.query('SELECT name FROM teachers WHERE id = $1', [parseInt(teacherId)]);
    if (teacher.rows.length === 0) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 });
    }

    // Базовый запрос для расчета часов
    let query = `
      SELECT 
        s.*,
        g.name as group_name,
        sub.name as subject_name,
        COUNT(*) as total_lessons,
        SUM(CASE WHEN s.day_of_week <= 5 THEN 1 ELSE 0 END) as weekday_lessons,
        SUM(CASE WHEN s.day_of_week = 6 THEN 1 ELSE 0 END) as saturday_lessons
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.teacher_id = $1
    `;
    
    let params = [parseInt(teacherId)];

    if (startDate && endDate) {
      query += ` AND s.created_at BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    query += ` GROUP BY s.id, g.name, sub.name ORDER BY s.day_of_week, s.pair_number`;

    const result = await db.query(query, params);

    // Подсчет общей нагрузки
    const totalHours = result.rows.reduce((sum, lesson) => sum + 1, 0);
    const weekdayHours = result.rows.reduce((sum, lesson) => sum + (lesson.day_of_week <= 5 ? 1 : 0), 0);
    const saturdayHours = result.rows.reduce((sum, lesson) => sum + (lesson.day_of_week === 6 ? 1 : 0), 0);

    return NextResponse.json({
      teacher: {
        id: parseInt(teacherId),
        name: teacher.rows[0].name
      },
      period: {
        startDate: startDate || 'все время',
        endDate: endDate || 'все время'
      },
      summary: {
        totalHours: totalHours,
        weekdayHours: weekdayHours,
        saturdayHours: saturdayHours,
        totalLessons: result.rows.length
      },
      lessons: result.rows.map(lesson => ({
        id: lesson.id,
        group_name: lesson.group_name,
        subject_name: lesson.subject_name,
        pair_number: lesson.pair_number,
        day_of_week: lesson.day_of_week,
        date: lesson.created_at
      }))
    });
  } catch (error) {
    console.error('Report hours error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}