import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('📊 Проверка базы данных...\n');

// Проверяем пользователей
db.all('SELECT id, username, full_name, role, group_id FROM users', (err, users) => {
  if (err) {
    console.error('Ошибка:', err);
  } else {
    console.log('👥 ПОЛЬЗОВАТЕЛИ:');
    users.forEach(user => {
      console.log(`   ID: ${user.id}, Логин: ${user.username}, Имя: ${user.full_name}, Роль: ${user.role}, Группа ID: ${user.group_id || 'НЕТ!'}`);
    });
  }
  
  // Проверяем группы
  db.all('SELECT id, name FROM groups', (err, groups) => {
    console.log('\nГРУППЫ:');
    groups.forEach(group => {
      console.log(`   ID: ${group.id}, Название: ${group.name}`);
    });
    
    // Проверяем преподавателей
    db.all('SELECT id, name, user_id FROM teachers', (err, teachers) => {
      console.log('\nПРЕПОДАВАТЕЛИ:');
      teachers.forEach(teacher => {
        console.log(`   ID: ${teacher.id}, Имя: ${teacher.name}, Привязан к user_id: ${teacher.user_id || 'НЕТ!'}`);
      });
      
      // Проверяем расписание
      db.all('SELECT COUNT(*) as count FROM schedule', (err, result) => {
        console.log(`\n📅 ВСЕГО ЗАНЯТИЙ: ${result[0].count}`);
        db.close();
      });
    });
  });
});