import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

// Находим первую группу
db.get('SELECT id FROM groups LIMIT 1', (err, group) => {
  if (err || !group) {
    console.log('❌ Нет групп в базе данных');
    db.close();
    return;
  }
  
  // Обновляем студентов, у которых нет группы
  db.run(
    'UPDATE users SET group_id = ? WHERE role = "student" AND (group_id IS NULL OR group_id = 0)',
    [group.id],
    function(err) {
      if (err) {
        console.error('❌ Ошибка обновления:', err);
      } else {
        console.log(`✅ Обновлено ${this.changes} студентов. Группа ID: ${group.id}`);
      }
      db.close();
    }
  );
});