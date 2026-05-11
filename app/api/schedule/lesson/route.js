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

    console.log('📥 POST body:', body);

    // Проверка обязательных полей
    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Обязательные поля не заполнены' }, { status: 400 });
    }

    // Если не apply_all и нет даты – ошибка
    if (!apply_all && !week_start_date) {
      return NextResponse.json({ error: 'Укажите дату начала недели или отметьте "Применить для всех"' }, { status: 400 });
    }

    // Преобразуем типы
    const gid = parseInt(group_id);
    const tid = parseInt(teacher_id);
    const sid = parseInt(subject_id);
    const cid = classroom_id ? parseInt(classroom_id) : null;
    const pair = parseInt(pair_number);
    const day = parseInt(day_of_week);

    // Применить ко всем неделям – работаем с шаблоном
    if (apply_all) {
      console.log('📝 Сохраняем в шаблон');
      
      await db.query(`
        INSERT INTO schedule_templates (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (group_id, day_of_week, pair_number)
        DO UPDATE SET teacher_id = EXCLUDED.teacher_id,
                      subject_id = EXCLUDED.subject_id,
                      classroom_id = EXCLUDED.classroom_id,
                      updated_at = NOW()
      `, [gid, tid, sid, cid, pair, day]);

      // Если передана неделя, удаляем переопределение для неё
      if (week_start_date) {
        await db.query(`
          DELETE FROM schedule_overrides
          WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
        `, [week_start_date, gid, day, pair]);
        console.log('🗑 Удалено переопределение для недели:', week_start_date);
      }

      return NextResponse.json({ success: true, source: 'template' });
    }

    // Для конкретной недели – проверяем существование шаблона
    const templateExists = await db.query(
      'SELECT id FROM schedule_templates WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3',
      [gid, day, pair]
    );

    if (templateExists.rows.length > 0) {
      // Есть шаблон – создаём/обновляем переопределение
      console.log('✏️ Создаём переопределение для существующего шаблона');
      
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
      `, [week_start_date, gid, day, pair, tid, sid, cid]);
    } else {
      // Нет шаблона – создаём переопределение как новое занятие
      console.log('➕ Создаём новое занятие для недели (без шаблона)');
      
      await db.query(`
        INSERT INTO schedule_overrides
          (week_start_date, group_id, day_of_week, pair_number,
           teacher_id, subject_id, classroom_id, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'added')
        ON CONFLICT (week_start_date, group_id, day_of_week, pair_number)
        DO UPDATE SET teacher_id = EXCLUDED.teacher_id,
                      subject_id = EXCLUDED.subject_id,
                      classroom_id = EXCLUDED.classroom_id,
                      status = 'added',
                      updated_at = NOW()
      `, [week_start_date, gid, day, pair, tid, sid, cid]);
    }

    return NextResponse.json({ success: true, source: 'override' });

  } catch (error) {
    console.error('❌ Lesson POST error:', error);
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

    console.log('🗑 DELETE body:', body);

    if (!group_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Недостаточно данных' }, { status: 400 });
    }
    if (!apply_all && !week_start_date) {
      return NextResponse.json({ error: 'Укажите неделю или выберите "Удалить из шаблона"' }, { status: 400 });
    }

    const gid = parseInt(group_id);
    const pair = parseInt(pair_number);
    const day = parseInt(day_of_week);

    if (apply_all) {
      // Удаляем из шаблона навсегда
      console.log('🗑 Удаляем из шаблона');
      
      await db.query(`
        DELETE FROM schedule_templates
        WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
      `, [gid, day, pair]);

      if (week_start_date) {
        await db.query(`
          DELETE FROM schedule_overrides
          WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
        `, [week_start_date, gid, day, pair]);
      }

      return NextResponse.json({ success: true, source: 'template_deleted' });
    }

    // Проверяем, есть ли шаблон
    const templateExists = await db.query(
      'SELECT id FROM schedule_templates WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3',
      [gid, day, pair]
    );

    if (templateExists.rows.length > 0) {
      // Отменяем занятие из шаблона только на эту неделю
      console.log('🚫 Отменяем занятие на неделю:', week_start_date);
      
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
      `, [week_start_date, gid, day, pair]);
    } else {
      // Удаляем переопределение, если нет шаблона
      console.log('🗑 Удаляем переопределение для недели:', week_start_date);
      
      await db.query(`
        DELETE FROM schedule_overrides
        WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
      `, [week_start_date, gid, day, pair]);
    }

    return NextResponse.json({ success: true, source: 'override_deleted' });

  } catch (error) {
    console.error('❌ Lesson DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}