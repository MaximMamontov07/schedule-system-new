// scripts/migrate-to-template.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: NEXT_PUBLIC_SUPABASE_URL или SUPABASE_KEY не заданы');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('🔄 Начинаем миграцию данных в schedule_template...');

  // 1. Проверяем, есть ли данные в schedule
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedule')
    .select('*');

  if (scheduleError) {
    console.error('❌ Ошибка чтения schedule:', scheduleError);
    return;
  }

  console.log(`📊 Найдено ${scheduleData?.length || 0} занятий в schedule`);

  if (!scheduleData || scheduleData.length === 0) {
    console.log('⚠️ Нет данных для миграции');
    return;
  }

  // 2. Переносим каждое занятие в schedule_template
  let migrated = 0;
  let errors = 0;

  for (const lesson of scheduleData) {
    // Проверяем, нет ли уже такого в шаблоне
    const { data: existing } = await supabase
      .from('schedule_template')
      .select('id')
      .eq('group_id', lesson.group_id)
      .eq('day_of_week', lesson.day_of_week)
      .eq('pair_number', lesson.pair_number)
      .maybeSingle();

    if (existing) {
      console.log(`⏭️ Пропускаем дубликат: группа ${lesson.group_id}, день ${lesson.day_of_week}, пара ${lesson.pair_number}`);
      continue;
    }

    // Вставляем в шаблон
    const templateData = {
      group_id: lesson.group_id,
      teacher_id: lesson.teacher_id,
      subject_id: lesson.subject_id,
      classroom_id: lesson.classroom_id || null,
      pair_number: lesson.pair_number,
      day_of_week: lesson.day_of_week,
      week_type: 'all'
    };

    const { error: insertError } = await supabase
      .from('schedule_template')
      .insert(templateData);

    if (insertError) {
      console.error(`❌ Ошибка вставки:`, insertError);
      errors++;
    } else {
      migrated++;
      console.log(`✅ Перенесено: группа ${lesson.group_id}, день ${lesson.day_of_week}, пара ${lesson.pair_number}`);
    }
  }

  console.log(`\n📊 Результат миграции:`);
  console.log(`   - Всего занятий в schedule: ${scheduleData.length}`);
  console.log(`   - Перенесено в template: ${migrated}`);
  console.log(`   - Ошибок: ${errors}`);

  // 3. Проверяем результат
  const { count: templateCount, error: countError } = await supabase
    .from('schedule_template')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`   - Всего в template теперь: ${templateCount}`);
  }

  console.log('\n✨ Миграция завершена!');
}

migrate();