// app/api/schedule/teacher-notes/route.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({ error: 'Только преподаватель' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { week_start_date, group_id, day_of_week, pair_number, notes } = body;

    if (!week_start_date || !group_id || !day_of_week || !pair_number) {
      return NextResponse.json({ error: 'Не все данные' }, { status: 400 });
    }

    // Проверяем, что преподаватель ведёт это занятие
    const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [user.id]);
    if (teacher.rows.length === 0) {
      return NextResponse.json({ error: 'Не найдена учётка преподавателя' }, { status: 404 });
    }
    const teacherId = teacher.rows[0].id;

    // Проверяем наличие занятия в шаблоне с этим преподавателем
    const template = await db.query(`
      SELECT id FROM schedule_templates
      WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3 AND teacher_id = $4
    `, [group_id, day_of_week, pair_number, teacherId]);

    // Проверяем override
    const override = await db.query(`
      SELECT id, status FROM schedule_overrides
      WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
    `, [week_start_date, group_id, day_of_week, pair_number]);

    if (template.rows.length === 0 && (override.rows.length === 0 || override.rows[0].status !== 'added')) {
      return NextResponse.json({ error: 'Занятие не найдено или вы не его преподаватель' }, { status: 404 });
    }

    // Обновляем или создаём override для заметок только на эту неделю
    if (override.rows.length > 0) {
      // Обновляем существующий override
      await db.query(`
        UPDATE schedule_overrides SET notes = $1, updated_at = NOW()
        WHERE id = $2
      `, [notes, override.rows[0].id]);
    } else {
      // Создаём override на основе шаблона
      const tpl = template.rows[0];
      const tplData = await db.query('SELECT * FROM schedule_templates WHERE id = $1', [tpl.id]);
      if (tplData.rows.length > 0) {
        const t = tplData.rows[0];
        await db.query(`
          INSERT INTO schedule_overrides
            (week_start_date, group_id, day_of_week, pair_number,
             teacher_id, subject_id, classroom_id, status, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'modified',$8)
          ON CONFLICT (week_start_date, group_id, day_of_week, pair_number)
          DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()
        `, [week_start_date, group_id, day_of_week, pair_number,
            t.teacher_id, t.subject_id, t.classroom_id, notes]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Teacher notes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}