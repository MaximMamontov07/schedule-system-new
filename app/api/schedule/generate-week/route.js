import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Функция для получения дат недели
function getWeekDates(targetDate) {
  const date = new Date(targetDate);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diff);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// POST - генерация расписания на неделю из шаблона
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }
    
    const db = await getDb();
    const { groupId, weekStartDate } = await request.json();
    
    if (!groupId || !weekStartDate) {
      return NextResponse.json({ error: 'groupId и weekStartDate обязательны' }, { status: 400 });
    }
    
    // Получаем шаблон для группы
    const template = await db.query(`
      SELECT * FROM schedule_templates 
      WHERE group_id = $1
      ORDER BY day_of_week, pair_number
    `, [groupId]);
    
    if (template.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Нет шаблона расписания для этой группы. Сначала создайте шаблон.' 
      }, { status: 400 });
    }
    
    // Получаем даты недели
    const weekDates = getWeekDates(weekStartDate);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results = [];
    
    // Для каждого занятия в шаблоне создаём/обновляем запись в schedule
    for (const tpl of template.rows) {
      const date = weekDates[tpl.day_of_week - 1];
      
      if (!date) continue;
      
      // Проверяем, существует ли уже занятие на эту дату, пару и группу
      const existing = await db.query(`
        SELECT id, is_exception FROM schedule 
        WHERE group_id = $1 AND date = $2 AND pair_number = $3
      `, [groupId, date, tpl.pair_number]);
      
      if (existing.rows.length > 0) {
        // Если есть исключение (пользователь вручную изменил) - пропускаем
        if (existing.rows[0].is_exception === true) {
          skipped++;
          results.push({
            day: tpl.day_of_week,
            pair: tpl.pair_number,
            date,
            status: 'skipped (has manual exception)'
          });
          continue;
        }
        
        // Иначе обновляем существующее занятие по шаблону
        await db.query(`
          UPDATE schedule 
          SET teacher_id = $1, subject_id = $2, classroom_id = $3,
              day_of_week = $4, is_exception = false, template_id = $5, updated_at = NOW()
          WHERE id = $6
        `, [tpl.teacher_id, tpl.subject_id, tpl.classroom_id, tpl.day_of_week, tpl.id, existing.rows[0].id]);
        
        updated++;
        results.push({
          day: tpl.day_of_week,
          pair: tpl.pair_number,
          date,
          status: 'updated'
        });
      } else {
        // Создаём новое занятие
        await db.query(`
          INSERT INTO schedule (
            group_id, teacher_id, subject_id, classroom_id, 
            pair_number, day_of_week, date, template_id, is_exception
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        `, [groupId, tpl.teacher_id, tpl.subject_id, tpl.classroom_id, 
            tpl.pair_number, tpl.day_of_week, date, tpl.id]);
        
        created++;
        results.push({
          day: tpl.day_of_week,
          pair: tpl.pair_number,
          date,
          status: 'created'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Сгенерировано расписание на неделю (создано: ${created}, обновлено: ${updated}, пропущено (исключения): ${skipped})`,
      results
    });
    
  } catch (error) {
    console.error('Generate week error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - копирование расписания с прошлой недели
export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !['admin', 'methodist'].includes(user.role)) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 });
    }
    
    const db = await getDb();
    const { groupId, sourceDate, targetDate } = await request.json();
    
    if (!groupId || !sourceDate || !targetDate) {
      return NextResponse.json({ error: 'groupId, sourceDate, targetDate обязательны' }, { status: 400 });
    }
    
    // Получаем занятия с исходной даты
    const sourceLessons = await db.query(`
      SELECT * FROM schedule 
      WHERE group_id = $1 AND date = $2
    `, [groupId, sourceDate]);
    
    let copied = 0;
    
    for (const lesson of sourceLessons.rows) {
      // Проверяем, есть ли уже занятие на целевую дату
      const existing = await db.query(`
        SELECT id FROM schedule 
        WHERE group_id = $1 AND date = $2 AND pair_number = $3
      `, [groupId, targetDate, lesson.pair_number]);
      
      if (existing.rows.length === 0) {
        // Копируем занятие
        await db.query(`
          INSERT INTO schedule (
            group_id, teacher_id, subject_id, classroom_id, 
            pair_number, day_of_week, date, notes, is_exception
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        `, [groupId, lesson.teacher_id, lesson.subject_id, lesson.classroom_id,
            lesson.pair_number, lesson.day_of_week, targetDate, lesson.notes]);
        copied++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Скопировано ${copied} занятий с ${sourceDate} на ${targetDate}`
    });
    
  } catch (error) {
    console.error('Copy week error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}