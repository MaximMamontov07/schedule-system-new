
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const teacherId = searchParams.get('teacherId');
    const weekStart = searchParams.get('weekStart');
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

    console.log('📅 Запрос расписания на неделю:', startMonday);
    console.log('🔍 Фильтры - groupId:', groupId, 'teacherId:', teacherId);

    const params = [startMonday];
    let paramIndex = 2;
    const whereClauses = [];

    if (groupId) {
      whereClauses.push(`t.group_id = $${paramIndex++}`);
      params.push(parseInt(groupId));
    }
    if (teacherId) {
      whereClauses.push(`t.teacher_id = $${paramIndex++}`);
      params.push(parseInt(teacherId));
    }

    // Основной запрос: шаблон + переопределения (НЕ показываем cancelled)
    let mainQuery = `
      SELECT
        t.id as template_id,
        o.id as override_id,
        t.group_id,
        g.name AS group_name,
        t.day_of_week,
        t.pair_number,
        COALESCE(o.teacher_id, t.teacher_id) AS teacher_id,
        COALESCE(otch.name, tch.name) AS teacher_name,
        COALESCE(o.subject_id, t.subject_id) AS subject_id,
        COALESCE(os.name, s.name) AS subject_name,
        COALESCE(o.classroom_id, t.classroom_id) AS classroom_id,
        COALESCE(oc.name, c.name) AS classroom_name,
        COALESCE(o.notes, t.notes) AS notes,
        CASE
          WHEN o.status = 'cancelled' THEN 'cancelled'
          WHEN o.status = 'modified' THEN 'modified'
          WHEN o.status = 'added' THEN 'added'
          WHEN o.id IS NOT NULL THEN 'modified'
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
      WHERE (o.id IS NULL OR o.status IS DISTINCT FROM 'cancelled')
    `;

    if (whereClauses.length > 0) {
      mainQuery += ` AND ${whereClauses.join(' AND ')}`;
    }

    console.log('🔍 Main query params:', params);
    const mainResult = await db.query(mainQuery, params);
    console.log('Main result rows:', mainResult.rows.length);

    // Запрос для полностью новых занятий (status = 'added')
    let addedQuery = `
      SELECT
        NULL as template_id,
        o.id as override_id,
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
    let addedIdx = 2;

    if (groupId) {
      addedQuery += ` AND o.group_id = $${addedIdx++}`;
      addedParams.push(parseInt(groupId));
    }
    if (teacherId) {
      addedQuery += ` AND o.teacher_id = $${addedIdx++}`;
      addedParams.push(parseInt(teacherId));
    }

    console.log('🔍 Added query params:', addedParams);
    const addedResult = await db.query(addedQuery, addedParams);
    console.log('Added result rows:', addedResult.rows.length);

    const allRows = [...mainResult.rows, ...addedResult.rows];
    
    // Сортировка
    allRows.sort((a, b) => {
      if (a.lesson_date < b.lesson_date) return -1;
      if (a.lesson_date > b.lesson_date) return 1;
      return a.pair_number - b.pair_number;
    });

    // Убираем дубликаты (если одно и то же занятие попало в оба запроса)
    const seen = new Set();
    const uniqueRows = allRows.filter(row => {
      const key = `${row.group_id}_${row.day_of_week}_${row.pair_number}_${row.lesson_date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const formatted = uniqueRows.map(row => ({
  id: row.override_id || row.template_id || `${row.group_id}_${row.day_of_week}_${row.pair_number}`,
  template_id: row.template_id,   
  override_id: row.override_id,   
  group_id: row.group_id,
  group_name: row.group_name,
  teacher_id: row.teacher_id,
  teacher_name: row.teacher_name,
  subject_id: row.subject_id,
  subject_name: row.subject_name,
  classroom_id: row.classroom_id,
  classroom_name: row.classroom_name,
  pair_number: parseInt(row.pair_number),
  day_of_week: parseInt(row.day_of_week),
  notes: row.notes,
  source: row.source,
  date: row.lesson_date ? new Date(row.lesson_date).toISOString().split('T')[0] : null
}));

    console.log(`Отправлено ${formatted.length} занятий`);
    return NextResponse.json(formatted);
    
  } catch (error) {
    console.error('❌ Schedule GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}