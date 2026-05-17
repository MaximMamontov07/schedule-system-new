export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST — создать заявку (только teacher)
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({ error: 'Только преподаватель' }, { status: 403 });
    }

    const db = await getDb();
    const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [user.id]);
    if (teacher.rows.length === 0) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 });
    }

    const body = await request.json();
    const {
      group_id, day_of_week, pair_number, week_start_date,
      request_type, new_teacher_id, new_subject_id, new_classroom_id,
      new_pair_number, new_day_of_week, reason
    } = body;

    if (!group_id || !day_of_week || !pair_number || !request_type) {
      return NextResponse.json({ error: 'Обязательные поля не заполнены' }, { status: 400 });
    }

    await db.query(`
      INSERT INTO lesson_change_requests 
        (teacher_id, group_id, day_of_week, pair_number, week_start_date,
         request_type, new_teacher_id, new_subject_id, new_classroom_id,
         new_pair_number, new_day_of_week, reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [
      teacher.rows[0].id, group_id, day_of_week, pair_number, week_start_date || null,
      request_type, new_teacher_id || null, new_subject_id || null, new_classroom_id || null,
      new_pair_number || null, new_day_of_week || null, reason || null
    ]);

    return NextResponse.json({ success: true, message: 'Заявка отправлена' });
  } catch (error) {
    console.error('Change request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — получить заявки (teacher — свои, admin — все)
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const db = await getDb();
    
    if (user.role === 'teacher') {
      const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [user.id]);
      if (teacher.rows.length === 0) return NextResponse.json([]);
      
      const result = await db.query(`
        SELECT r.*, g.name as group_name, t.name as teacher_name,
               nt.name as new_teacher_name, s.name as new_subject_name,
               c.name as new_classroom_name
        FROM lesson_change_requests r
        JOIN groups g ON r.group_id = g.id
        JOIN teachers t ON r.teacher_id = t.id
        LEFT JOIN teachers nt ON r.new_teacher_id = nt.id
        LEFT JOIN subjects s ON r.new_subject_id = s.id
        LEFT JOIN classrooms c ON r.new_classroom_id = c.id
        WHERE r.teacher_id = $1
        ORDER BY r.created_at DESC
      `, [teacher.rows[0].id]);
      return NextResponse.json(result.rows);
    }

    if (['admin', 'methodist'].includes(user.role)) {
      const result = await db.query(`
        SELECT r.*, g.name as group_name, t.name as teacher_name,
               nt.name as new_teacher_name, s.name as new_subject_name,
               c.name as new_classroom_name
        FROM lesson_change_requests r
        JOIN groups g ON r.group_id = g.id
        JOIN teachers t ON r.teacher_id = t.id
        LEFT JOIN teachers nt ON r.new_teacher_id = nt.id
        LEFT JOIN subjects s ON r.new_subject_id = s.id
        LEFT JOIN classrooms c ON r.new_classroom_id = c.id
        ORDER BY r.status ASC, r.created_at DESC
      `);
      return NextResponse.json(result.rows);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('Change requests GET error:', error);
    return NextResponse.json([]);
  }
}

// PATCH — одобрить/отклонить (только admin/methodist)
export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }

    const db = await getDb();
    const { requestId, status, adminComment } = await request.json();

    if (!requestId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Неверные данные' }, { status: 400 });
    }

    await db.query(
      `UPDATE lesson_change_requests SET status = $1, admin_comment = $2, updated_at = NOW() WHERE id = $3`,
      [status, adminComment || null, requestId]
    );

    // Если одобрено — применяем изменения
    if (status === 'approved') {
      const req = await db.query('SELECT * FROM lesson_change_requests WHERE id = $1', [requestId]);
      if (req.rows.length > 0) {
        const r = req.rows[0];
        
        if (r.request_type === 'cancel') {
          // Отмена занятия
          if (r.week_start_date) {
            await db.query(`
              INSERT INTO schedule_overrides (week_start_date, group_id, day_of_week, pair_number, status)
              VALUES ($1,$2,$3,$4,'cancelled')
              ON CONFLICT (week_start_date, group_id, day_of_week, pair_number)
              DO UPDATE SET status = 'cancelled', updated_at = NOW()
            `, [r.week_start_date, r.group_id, r.day_of_week, r.pair_number]);
          } else {
            await db.query('DELETE FROM schedule_templates WHERE group_id=$1 AND day_of_week=$2 AND pair_number=$3',
              [r.group_id, r.day_of_week, r.pair_number]);
          }
        } else if (r.request_type === 'change' || r.request_type === 'replace') {
          const tid = r.new_teacher_id || r.teacher_id;
          const sid = r.new_subject_id;
          const cid = r.new_classroom_id;
          const pair = r.new_pair_number || r.pair_number;
          const day = r.new_day_of_week || r.day_of_week;

          if (r.week_start_date) {
            await db.query(`
              INSERT INTO schedule_overrides (week_start_date, group_id, day_of_week, pair_number, teacher_id, subject_id, classroom_id, status)
              VALUES ($1,$2,$3,$4,$5,$6,$7,'modified')
              ON CONFLICT (week_start_date, group_id, day_of_week, pair_number)
              DO UPDATE SET teacher_id=EXCLUDED.teacher_id, subject_id=EXCLUDED.subject_id, classroom_id=EXCLUDED.classroom_id, status='modified'
            `, [r.week_start_date, r.group_id, day, pair, tid, sid, cid]);
          } else {
            await db.query(`
              INSERT INTO schedule_templates (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week)
              VALUES ($1,$2,$3,$4,$5,$6)
              ON CONFLICT (group_id, day_of_week, pair_number)
              DO UPDATE SET teacher_id=EXCLUDED.teacher_id, subject_id=EXCLUDED.subject_id, classroom_id=EXCLUDED.classroom_id
            `, [r.group_id, tid, sid, cid, pair, day]);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change request PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}