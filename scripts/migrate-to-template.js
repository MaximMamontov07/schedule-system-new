// scripts/migrate-to-template.js
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Миграция на шаблонную систему...');

db.serialize(() => {
  // Создаём таблицу шаблонов
  db.run(`
    CREATE TABLE IF NOT EXISTS schedule_template (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      classroom_id INTEGER,
      pair_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      week_type TEXT DEFAULT 'all', -- 'all', 'even', 'odd'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    )
  `);
  console.log('✅ Таблица schedule_template создана');

  // Создаём таблицу исключений
  db.run(`
    CREATE TABLE IF NOT EXISTS schedule_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER, -- ссылка на шаблон, который заменяем (опционально)
      group_id INTEGER NOT NULL,
      teacher_id INTEGER,
      subject_id INTEGER,
      classroom_id INTEGER,
      pair_number INTEGER,
      day_of_week INTEGER,
      exception_date TEXT NOT NULL, -- конкретная дата
      exception_type TEXT NOT NULL, -- 'canceled', 'replaced', 'moved', 'added'
      replacement_teacher_id INTEGER,
      replacement_subject_id INTEGER,
      replacement_classroom_id INTEGER,
      replacement_pair_number INTEGER,
      replacement_day_of_week INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    )
  `);
  console.log('✅ Таблица schedule_exceptions создана');

  // Создаём индексы для быстрого поиска
  db.run('CREATE INDEX IF NOT EXISTS idx_exceptions_date ON schedule_exceptions(exception_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_exceptions_group ON schedule_exceptions(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_template_group ON schedule_template(group_id)');

  // Переносим существующие занятия в шаблон
  db.all('SELECT * FROM schedule', (err, rows) => {
    if (err) {
      console.error('Ошибка чтения schedule:', err);
      return;
    }

    if (rows.length === 0) {
      console.log('Нет существующих занятий для переноса');
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO schedule_template 
      (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    rows.forEach(row => {
      stmt.run([
        row.group_id,
        row.teacher_id,
        row.subject_id,
        row.classroom_id,
        row.pair_number,
        row.day_of_week
      ]);
    });

    stmt.finalize();
    console.log(`✅ Перенесено ${rows.length} занятий в шаблон`);
  });

  console.log('\n📌 ВАЖНО: старые занятия остались в таблице schedule для истории');
  console.log('🔧 Новая система:');
  console.log('   - schedule_template: шаблон расписания');
  console.log('   - schedule_exceptions: изменения на конкретные дни');
  console.log('   - schedule (старая): для истории/бэкапа');
});

setTimeout(() => {
  console.log('\n✨ Миграция завершена!');
  db.close();
}, 1000);