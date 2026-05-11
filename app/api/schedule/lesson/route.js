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

    // ============================================
    // ПРОВЕРКА КОНФЛИКТОВ
    // ============================================

    if (apply_all) {
      // Проверяем конфликт в шаблоне
      const templateConflict = await db.query(`
        SELECT t.*, g.name as group_name, s.name as subject_name, tch.name as teacher_name
        FROM schedule_templates t
        JOIN groups g ON t.group_id = g.id
        JOIN subjects s ON t.subject_id = s.id
        JOIN teachers tch ON t.teacher_id = tch.id
        WHERE t.group_id = $1 
          AND t.day_of_week = $2 
          AND t.pair_number = $3
          AND (t.id != $4 OR $4 IS NULL)
      `, [gid, day, pair, template_id || null]);

      if (templateConflict.rows.length > 0) {
        const conflict = templateConflict.rows[0];
        return NextResponse.json({
          error: `⚠️ Конфликт в шаблоне! Группа "${conflict.group_name}" уже имеет занятие "${conflict.subject_name}" с преподавателем ${conflict.teacher_name} на ${pair} паре в этот день.`,
          conflict: true,
          type: 'template'
        }, { status: 409 });
      }
    }

    if (!apply_all) {
      // Для конкретной недели
      if (!week_start_date) {
        return NextResponse.json({ error: 'Укажите дату начала недели' }, { status: 400 });
      }

      // Проверяем конфликт переопределений для этой недели
      const overrideConflict = await db.query(`
        SELECT o.*, g.name as group_name, 
               COALESCE(s.name, 'Отменено') as subject_name, 
               COALESCE(tch.name, '—') as teacher_name
        FROM schedule_overrides o
        JOIN groups g ON o.group_id = g.id
        LEFT JOIN subjects s ON o.subject_id = s.id
        LEFT JOIN teachers tch ON o.teacher_id = tch.id
        WHERE o.week_start_date = $1
          AND o.group_id = $2
          AND o.day_of_week = $3
          AND o.pair_number = $4
          AND o.status != 'cancelled'
          AND (o.id != $5 OR $5 IS NULL)
      `, [week_start_date, gid, day, pair, override_id || null]);

      if (overrideConflict.rows.length > 0) {
        const conflict = overrideConflict.rows[0];
        return NextResponse.json({
          error: `⚠️ Конфликт на этой неделе! Группа "${conflict.group_name}" уже имеет занятие "${conflict.subject_name}" с преподавателем ${conflict.teacher_name} на ${pair} паре.`,
          conflict: true,
          type: 'override'
        }, { status: 409 });
      }
    }

    // ============================================
    // СОХРАНЕНИЕ В ШАБЛОН (apply_all = true)
    // ============================================
    if (apply_all) {
      console.log('📝 Сохраняем в шаблон (apply_all=true)');
      
      if (template_id) {
        // Обновляем существующий шаблон
        await db.query(`
          UPDATE schedule_templates 
          SET teacher_id = $1, subject_id = $2, classroom_id = $3, updated_at = NOW()
          WHERE id = $4
        `, [tid, sid, cid, template_id]);
        console.log('🔄 Шаблон обновлён, id:', template_id);
      } else {
        // Создаём новый шаблон
        const result = await db.query(`
          INSERT INTO schedule_templates 
            (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (group_id, day_of_week, pair_number)
          DO UPDATE SET teacher_id = EXCLUDED.teacher_id,
                        subject_id = EXCLUDED.subject_id,
                        classroom_id = EXCLUDED.classroom_id,
                        updated_at = NOW()
          RETURNING id
        `, [gid, tid, sid, cid, pair, day]);
        console.log('➕ Шаблон создан, id:', result.rows[0]?.id);
      }

      
      const deletedOverrides = await db.query(`
        DELETE FROM schedule_overrides
        WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
        RETURNING id, week_start_date, status
      `, [gid, day, pair]);
      
      if (deletedOverrides.rows.length > 0) {
        console.log(`🗑 Удалено ${deletedOverrides.rows.length} переопределений:`);
        deletedOverrides.rows.forEach(r => {
          console.log(`   - id=${r.id}, неделя=${r.week_start_date}, статус=${r.status}`);
        });
      } else {
        console.log('📭 Переопределений для удаления не найдено');
      }

      return NextResponse.json({ 
        success: true, 
        source: 'template_updated',
        deleted_overrides: deletedOverrides.rows.length
      });
    }

    // ============================================
    // СОХРАНЕНИЕ ДЛЯ КОНКРЕТНОЙ НЕДЕЛИ (apply_all = false)
    // ============================================
    console.log('✏️ Сохраняем переопределение для недели:', week_start_date);

    // Сначала удаляем cancelled для этой ячейки, если есть
    const deletedCancelled = await db.query(`
      DELETE FROM schedule_overrides
      WHERE week_start_date = $1 
        AND group_id = $2 
        AND day_of_week = $3 
        AND pair_number = $4 
        AND status = 'cancelled'
      RETURNING id
    `, [week_start_date, gid, day, pair]);
    
    if (deletedCancelled.rows.length > 0) {
      console.log('🔄 Удалена предыдущая отмена, id:', deletedCancelled.rows[0].id);
    }

    if (override_id) {
      // Обновляем существующее переопределение
      console.log('🔄 Обновляем переопределение, id:', override_id);
      await db.query(`
        UPDATE schedule_overrides
        SET teacher_id = $1, subject_id = $2, classroom_id = $3, 
            status = 'modified', updated_at = NOW()
        WHERE id = $4
      `, [tid, sid, cid, override_id]);
      
      return NextResponse.json({ success: true, source: 'override_updated' });
    }

    if (template_id) {
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
      
      return NextResponse.json({ success: true, source: 'override_created' });
    }

    // Нет ни шаблона, ни переопределения — создаём новое занятие
    console.log('➕ Создаём новое занятие (added)');
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
    
    return NextResponse.json({ success: true, source: 'override_added' });

  } catch (error) {
    console.error('❌ Lesson POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE – удаление / отмена занятия (только admin/methodist)
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const body = await request.json();
    const { 
      group_id, pair_number, day_of_week, week_start_date, 
      apply_all, template_id, override_id 
    } = body;

    console.log('🗑 DELETE запрос:');
    console.log('  group_id:', group_id);
    console.log('  pair_number:', pair_number);
    console.log('  day_of_week:', day_of_week);
    console.log('  week_start_date:', week_start_date);
    console.log('  apply_all:', apply_all);
    console.log('  template_id:', template_id);
    console.log('  override_id:', override_id);

    if (!group_id || !pair_number || !day_of_week) {
      return NextResponse.json({ 
        error: 'Недостаточно данных (group_id, pair_number, day_of_week)' 
      }, { status: 400 });
    }

    const gid = parseInt(group_id);
    const pair = parseInt(pair_number);
    const day = parseInt(day_of_week);

    // ============================================
    // УДАЛЕНИЕ ИЗ ШАБЛОНА (apply_all = true)
    // ============================================
    if (apply_all) {
      console.log('🗑 Удаляем из шаблона');
      
      if (template_id) {
        await db.query(`DELETE FROM schedule_templates WHERE id = $1`, [template_id]);
        console.log('Шаблон удалён, id:', template_id);
      } else {
        // Если нет template_id, удаляем по координатам
        await db.query(`
          DELETE FROM schedule_templates 
          WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
        `, [gid, day, pair]);
        console.log('Шаблон удалён по координатам');
      }

      // Удаляем ВСЕ связанные переопределения
      const deletedOverrides = await db.query(`
        DELETE FROM schedule_overrides
        WHERE group_id = $1 AND day_of_week = $2 AND pair_number = $3
        RETURNING id, week_start_date, status
      `, [gid, day, pair]);
      
      if (deletedOverrides.rows.length > 0) {
        console.log(`🗑 Удалено ${deletedOverrides.rows.length} переопределений:`);
        deletedOverrides.rows.forEach(r => {
          console.log(`   - id=${r.id}, неделя=${r.week_start_date}, статус=${r.status}`);
        });
      }

      return NextResponse.json({ 
        success: true, 
        source: 'template_deleted',
        deleted_overrides: deletedOverrides.rows.length
      });
    }

    // ============================================
    // УДАЛЕНИЕ ДЛЯ КОНКРЕТНОЙ НЕДЕЛИ (apply_all = false)
    // ============================================
    if (!week_start_date) {
      return NextResponse.json({ error: 'Укажите дату начала недели' }, { status: 400 });
    }

    // Если есть override_id — удаляем переопределение
    if (override_id) {
      console.log('🗑 Удаляем переопределение, id:', override_id);
      await db.query(`DELETE FROM schedule_overrides WHERE id = $1`, [override_id]);
      console.log('Переопределение удалено');
      return NextResponse.json({ success: true, source: 'override_deleted' });
    }

    // Если есть template_id — создаём cancelled для этой недели
    if (template_id) {
      console.log('Отменяем занятие шаблона на неделю:', week_start_date);
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
      console.log('Занятие отменено (cancelled)');
      return NextResponse.json({ success: true, source: 'override_cancelled' });
    }

    // Если нет ни template_id, ни override_id — удаляем по координатам
    console.log('🗑 Удаляем переопределение по координатам');
    await db.query(`
      DELETE FROM schedule_overrides
      WHERE week_start_date = $1 AND group_id = $2 AND day_of_week = $3 AND pair_number = $4
    `, [week_start_date, gid, day, pair]);
    console.log('Переопределение удалено по координатам');
    
    return NextResponse.json({ success: true, source: 'override_deleted' });

  } catch (error) {
    console.error('❌ Lesson DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}