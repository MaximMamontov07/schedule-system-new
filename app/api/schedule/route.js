// app/api/schedule/route.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET – получение актуального расписания (шаблон + переопределения)
export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const teacherId = searchParams.get('teacherId');
    const weekStart = searchParams.get('weekStart'); // YYYY-MM-DD (понедельник)
    const date = searchParams.get('date');

    // Определяем понедельник недели
    let startMonday = weekStart;
    if (!startMonday && date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - ((day === 0 ? 6 : day - 1));
      d.setDate(diff);
      startMonday = d.toISOString().split('T')[0];
    }
    if (!startMonday) {
      return NextResponse.json([]);
    }

    // Параметры для фильтрации
    const whereClauses = [];
    const params = [startMonday];
    let paramIndex = 2;

    if (groupId) {
      whereClauses.push(`effective.group_id = $${paramIndex++}`);
      params.push(parseInt(groupId));
    }
    if (teacherId) {
      whereClauses.push(`effective.teacher_id = $${paramIndex++}`);
      params.push(parseInt(teacherId));
    }

    // Основной запрос: шаблон + существующие переопределения (кроме cancelled)
    let query = `
      WITH effective AS (
        SELECT
          t.group_id,
          g.name AS group_name,
          t.day_of_week,
          t.pair_number,
          COALESCE(o.teacher_id, t.teacher_id) AS teacher_id,
          COALESCE(tch.name, otch.name) AS teacher_name,
          COALESCE(o.subject_id, t.subject_id) AS subject_id,
          COALESCE(s.name, os.name) AS subject_name,
          COALESCE(o.classroom_id, t.classroom_id) AS classroom_id,
          COALESCE(c.name, oc.name) AS classroom_name,
          COALESCE(o.notes, t.notes) AS notes,
          CASE
            WHEN o.status = 'cancelled' THEN 'cancelled'
            WHEN o.status IS NOT NULL THEN o.status
            ELSE 'template'
          END AS source,
          o.status AS override_status,
          $1::date + (t.day_of_week - 1) AS lesson_date
        FROM schedule_templates t
        JOIN groups g ON t.group_id = g.id
        LEFT JOIN teachers tch ON t.teacher_id = tch.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN classrooms c ON t.classroom_id = c.id
        LEFT JOIN schedule_overrides o
          ON o.week_start_date = $1::date
         AND o.group_id = t.group_id
         AND o.day_of_week = t.day_of_week
         AND o.pair_number = t.pair_number
        LEFT JOIN teachers otch ON o.teacher_id = otch.id
        LEFT JOIN subjects os ON o.subject_id = os.id
        LEFT JOIN classrooms oc ON o.classroom_id = oc.id
      )
      SELECT * FROM effective
      WHERE override_status IS DISTINCT FROM 'cancelled'
      ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
    `;

    // Запрос для полностью новых занятий (status = 'added')
    let addedQuery = `
      SELECT
        o.group_id,
        g.name AS group_name,
        o.day_of_week,
        o.pair_number,
        o.teacher_id,
        otch.name AS teacher_name,
        o.subject_id,
        os.name AS subject_name,
        o.classroom_id,
        oc.name AS classroom_name,
        o.notes,
        'added' AS source,
        o.status AS override_status,
        o.week_start_date + (o.day_of_week - 1) AS lesson_date
      FROM schedule_overrides o
      JOIN groups g ON o.group_id = g.id
      LEFT JOIN teachers otch ON o.teacher_id = otch.id
      LEFT JOIN subjects os ON o.subject_id = os.id
      LEFT JOIN classrooms oc ON o.classroom_id = oc.id
      WHERE o.status = 'added'
        AND o.week_start_date = $1::date
    `;
    const addedParams = [startMonday];
    let addedParamIdx = 2;
    if (groupId) {
      addedQuery += ` AND o.group_id = $${addedParamIdx++}`;
      addedParams.push(parseInt(groupId));
    }
    if (teacherId) {
      addedQuery += ` AND o.teacher_id = $${addedParamIdx++}`;
      addedParams.push(parseInt(teacherId));
    }

    const [mainResult, addedResult] = await Promise.all([
      db.query(query, params),
      db.query(addedQuery, addedParams)
    ]);

    const allRows = [...mainResult.rows, ...addedResult.rows];
    // Сортировка
    allRows.sort((a, b) => {
      if (a.lesson_date < b.lesson_date) return -1;
      if (a.lesson_date > b.lesson_date) return 1;
      return a.pair_number - b.pair_number;
    });

    const formatted = allRows.map(row => ({
      ...row,
      date: row.lesson_date ? new Date(row.lesson_date).toISOString().split('T')[0] : null,
      day_of_week: parseInt(row.day_of_week),
      pair_number: parseInt(row.pair_number),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}