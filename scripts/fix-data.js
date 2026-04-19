import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Исправление данных...\n');

// 1. Проверяем и создаём группы если нет
db.run(`INSERT OR IGNORE INTO groups (id, name) VALUES (1, 'ИС-21')`);
db.run(`INSERT OR IGNORE INTO groups (id, name) VALUES (2, 'ИС-22')`);

// 2. Назначаем студентам группу (группу с ID=1)
db.run(`UPDATE users SET group_id = 1 WHERE role = 'student' AND (group_id IS NULL OR group_id = 0)`, function(err) {
  if (!err) console.log(`✅ Студентам назначена группа, обновлено: ${this.changes}`);
});

// 3. Создаём преподавателя если нет
db.get(`SELECT id FROM users WHERE role = 'teacher'`, (err, teacherUser) => {
  if (!teacherUser) {
    console.log('⚠️ Преподаватель не найден в users, создаём...');
    // Тут нужно создать преподавателя, но лучше через регистрацию
  } else {
    // Привязываем teachers к user_id
    db.run(`UPDATE teachers SET user_id = ? WHERE user_id IS NULL LIMIT 1`, [teacherUser.id], function(err) {
      if (!err) console.log(`✅ Преподаватель привязан к user_id: ${teacherUser.id}, обновлено: ${this.changes}`);
    });
  }
});

// 4. Проверяем результат
setTimeout(() => {
  console.log('\n📊 РЕЗУЛЬТАТ:');
  db.all(`SELECT id, username, role, group_id FROM users`, (err, users) => {
    users.forEach(user => {
      console.log(`   ${user.username} (${user.role}) - группа: ${user.group_id || 'НЕТ'}`);
    });
    
    db.all(`SELECT id, name, user_id FROM teachers`, (err, teachers) => {
      teachers.forEach(teacher => {
        console.log(`   Преподаватель: ${teacher.name} - привязан: ${teacher.user_id || 'НЕТ'}`);
      });
      db.close();
    });
  });
}, 500);