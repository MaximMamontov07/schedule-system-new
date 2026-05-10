// app/api/schedule/lesson/route.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST – создание / изменение занятия (только admin/methodist)
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const {
      group_id, teacher_id, subject_id, classroom_id,
      pair_number, day_of_week, week_start_date, apply_all
    } = body;

    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Обязательные поля не заполнены' }, { status: 400 });
    }
    if (!apply_all && !week_start_date) {
      return NextResponse.json({ error: 'Укажите дату начала недели или выберите "Применить для всех недель"' }, { status: 400 });
    }

    // Применить ко всем неделям – работаем с шаблоном
    if (apply_all) {
      await db.query(`
        INSERT INTO schedule_templates (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (group_id, day_of_week, pair_number)
        DO UPDATE SET teacher_id = EXCLUDED.teacher_id,
                      subject_id = EXCLUDED.subject_id,
                      classroom_id = EXCLUDED.classroom_id,
                      updated_at = NOW()
      `, [group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week]);

      // Удаляем все переопределения для этой комбинации на указанной неделе (если неделя задана)
      if (week_start_date) {
        await db.query(`
          DELETE FROM schedule_overrides
          WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
        `, [week_start_date, group_id, day_of_week, pair_number]);
      }

      return NextResponse.json({ success: true, source: 'template' });
    }

    // Только для этой недели (переопределение)
    await db.query(`
      INSERT INTO schedule_overrides
        (week_start_date, group_id, day_of_week, pair_number,
         teacher_id, subject_id, classroom_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'modified')
      ON CONFLICT (week_start_date, group_id, day_of_week, pair_number)
      DO UPDATE SET teacher_id = EXCLUDED.teacher_id,
                    subject_id = EXCLUDED.subject_id,
                    classroom_id = EXCLUDED.classroom_id,
                    status = 'modified',
                    updated_at = NOW()
    `, [week_start_date, group_id, day_of_week, pair_number,
        teacher_id, subject_id, classroom_id]);

    return NextResponse.json({ success: true, source: 'override' });

  } catch (error) {
    console.error('Lesson POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE – отмена занятия (только admin/methodist)
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { group_id, pair_number, day_of_week, week_start_date, apply_all } = body;

    if (!group_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Недостаточно данных' }, { status: 400 });
    }
    if (!apply_all && !week_start_date) {
      return NextResponse.json({ error: 'Укажите дату начала недели или выберите "Удалить из шаблона"' }, { status: 400 });
    }

    if (apply_all) {
      // Удаляем из шаблона навсегда
      await db.query(`
        DELETE FROM schedule_templates
        WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
      `, [group_id, day_of_week, pair_number]);

      // Удаляем переопределения на эту неделю, если неделя указана
      if (week_start_date) {
        await db.query(`
          DELETE FROM schedule_overrides
          WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
        `, [week_start_date, group_id, day_of_week, pair_number]);
      }

      return NextResponse.json({ success: true, source: 'template_deleted' });
    }

    // Только для этой недели – отмена (cancelled)
    await db.query(`
      INSERT INTO schedule_overrides
        (week_start_date, group_id, day_of_week, pair_number, status)
      VALUES ($1,$2,$3,$4,'cancelled')
      ON CONFLICT (week_start_date, group_id, day_of_week, pair_number)
      DO UPDATE SET teacher_id = NULL,
                    subject_id = NULL,
                    classroom_id = NULL,
                    status = 'cancelled',
                    notes = NULL,
                    updated_at = NOW()
    `, [week_start_date, group_id, day_of_week, pair_number]);

    return NextResponse.json({ success: true, source: 'override_cancelled' });

  } catch (error) {
    console.error('Lesson DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}