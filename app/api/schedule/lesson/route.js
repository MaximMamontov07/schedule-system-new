export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

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
      pair_number, day_of_week, week_start_date, apply_all,
      template_id, override_id
    } = body;

    console.log('📥 POST body:', JSON.stringify(body, null, 2));

    if (!group_id || !teacher_id || !subject_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Обязательные поля не заполнены' }, { status: 400 });
    }

    const gid = parseInt(group_id);
    const tid = parseInt(teacher_id);
    const sid = parseInt(subject_id);
    const cid = classroom_id ? parseInt(classroom_id) : null;
    const pair = parseInt(pair_number);
    const day = parseInt(day_of_week);

    // 🔥 ЕСЛИ apply_all = true — сохраняем в шаблон
    if (apply_all) {
      console.log('📝 Сохраняем в шаблон (apply_all=true)');
      
      if (template_id) {
        // Обновляем существующий шаблон
        await db.query(`
          UPDATE schedule_templates 
          SET teacher_id = $1, subject_id = $2, classroom_id = $3, updated_at = NOW()
          WHERE id = $4
        `, [tid, sid, cid, template_id]);
      } else {
        // Создаём новый шаблон
        await db.query(`
          INSERT INTO schedule_templates (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (group_id, day_of_week, pair_number)
          DO UPDATE SET teacher_id = EXCLUDED.teacher_id,
                        subject_id = EXCLUDED.subject_id,
                        classroom_id = EXCLUDED.classroom_id,
                        updated_at = NOW()
        `, [gid, tid, sid, cid, pair, day]);
      }

      // Удаляем переопределение для этой недели, если оно было
      if (week_start_date) {
        await db.query(`
          DELETE FROM schedule_overrides
          WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
        `, [week_start_date, gid, day, pair]);
        console.log('🗑 Удалено переопределение для недели:', week_start_date);
      }

      return NextResponse.json({ success: true, source: 'template_updated' });
    }

    // 🔥 apply_all = false — работаем с переопределением для конкретной недели
    if (!week_start_date) {
      return NextResponse.json({ error: 'Укажите дату начала недели' }, { status: 400 });
    }

    console.log('✏️ Сохраняем переопределение для недели:', week_start_date);

    if (override_id) {
      // Обновляем существующее переопределение
      console.log('🔄 Обновляем существующее переопределение, id:', override_id);
      await db.query(`
        UPDATE schedule_overrides
        SET teacher_id = $1, subject_id = $2, classroom_id = $3, status = 'modified', updated_at = NOW()
        WHERE id = $4
      `, [tid, sid, cid, override_id]);
    } else if (template_id) {
      // Создаём переопределение на основе шаблона
      console.log('➕ Создаём переопределение для шаблона, template_id:', template_id);
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
      // Нет ни шаблона, ни переопределения — создаём новое
      console.log('➕ Создаём новое переопределение (без шаблона)');
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

    return NextResponse.json({ success: true, source: 'override_updated' });

  } catch (error) {
    console.error('❌ Lesson POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { group_id, pair_number, day_of_week, week_start_date, apply_all, template_id, override_id } = body;

    console.log('🗑 DELETE body:', JSON.stringify(body, null, 2));

    if (!group_id || !pair_number || !day_of_week) {
      return NextResponse.json({ error: 'Недостаточно данных' }, { status: 400 });
    }

    const gid = parseInt(group_id);
    const pair = parseInt(pair_number);
    const day = parseInt(day_of_week);

    if (apply_all) {
      console.log('🗑 Удаляем из шаблона');
      await db.query(`
        DELETE FROM schedule_templates WHERE id = $1
      `, [template_id]);

      if (override_id) {
        await db.query(`DELETE FROM schedule_overrides WHERE id = $1`, [override_id]);
      }

      return NextResponse.json({ success: true, source: 'template_deleted' });
    }

    if (!week_start_date) {
      return NextResponse.json({ error: 'Укажите дату начала недели' }, { status: 400 });
    }

    if (override_id) {
      // Удаляем существующее переопределение
      console.log('🗑 Удаляем переопределение, id:', override_id);
      await db.query(`DELETE FROM schedule_overrides WHERE id = $1`, [override_id]);
    } else if (template_id) {
      // Создаём переопределение с cancelled
      console.log('🚫 Отменяем занятие шаблона на неделю:', week_start_date);
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
    }

    return NextResponse.json({ success: true, source: 'override_deleted' });

  } catch (error) {
    console.error('❌ Lesson DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}