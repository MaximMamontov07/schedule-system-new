import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('📦 Initializing database at:', dbPath);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Удаляем старые таблицы
      db.run('DROP TABLE IF EXISTS schedule');
      db.run('DROP TABLE IF EXISTS subjects');
      db.run('DROP TABLE IF EXISTS teachers');
      db.run('DROP TABLE IF EXISTS groups');
      db.run('DROP TABLE IF EXISTS classrooms');
      db.run('DROP TABLE IF EXISTS users');
      
      console.log('🗑️ Old tables dropped');
      
      // Таблица пользователей
      db.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'student',
          group_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Users table created');
      
      // Таблица групп
      db.run(`
        CREATE TABLE groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Groups table created');
      
      // Таблица преподавателей
      db.run(`
        CREATE TABLE teachers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          user_id INTEGER UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      console.log('✅ Teachers table created');
      
      // Таблица предметов
      db.run(`
        CREATE TABLE subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Subjects table created');
      
      // Таблица аудиторий (НОВАЯ)
      db.run(`
        CREATE TABLE classrooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          building TEXT,
          floor INTEGER,
          capacity INTEGER,
          type TEXT DEFAULT 'standard',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Classrooms table created');
      
      // Таблица расписания (с аудиторией)
      db.run(`
        CREATE TABLE schedule (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          teacher_id INTEGER NOT NULL,
          subject_id INTEGER NOT NULL,
          classroom_id INTEGER,
          pair_number INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL,
          status TEXT DEFAULT 'planned',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (teacher_id) REFERENCES teachers(id),
          FOREIGN KEY (subject_id) REFERENCES subjects(id),
          FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
        )
      `);
      console.log('✅ Schedule table created');
    });

    // Создаём пользователей и тестовые данные
    setTimeout(async () => {
      try {
        const hashedPassword = await bcrypt.hash('1234', 10);
        
        // Админ
        db.run(
          'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
          ['admin', hashedPassword, 'Администратор', 'admin'],
          function(err) {
            if (err) reject(err);
            else console.log('👑 Admin user created (ID: ' + this.lastID + ')');
          }
        );
        
        // Методист
        db.run(
          'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
          ['methodist', hashedPassword, 'Методист Иванова', 'methodist'],
          function(err) {
            if (!err) console.log('📋 Methodist user created (ID: ' + this.lastID + ')');
          }
        );
        
        // Преподаватель
        db.run(
          'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
          ['teacher', hashedPassword, 'Преподаватель Петров', 'teacher'],
          function(err) {
            if (!err) {
              const teacherUserId = this.lastID;
              console.log('👨‍🏫 Teacher user created (ID: ' + teacherUserId + ')');
              
              db.run(
                'INSERT INTO teachers (name, user_id) VALUES (?, ?)',
                ['Петров И.И.', teacherUserId],
                function(err) {
                  if (!err) console.log('✅ Teacher record created');
                }
              );
            }
          }
        );
        
        // Студент
        db.run(
          'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
          ['student', hashedPassword, 'Студент Сидоров', 'student'],
          function(err) {
            if (!err) console.log('🎓 Student user created (ID: ' + this.lastID + ')');
          }
        );
        
        // Добавляем тестовые данные
        setTimeout(() => {
          db.run("INSERT INTO groups (name) VALUES ('ИС-21')");
          db.run("INSERT INTO groups (name) VALUES ('ИС-22')");
          db.run("INSERT INTO teachers (name) VALUES ('Сидорова М.А.')");
          db.run("INSERT INTO teachers (name) VALUES ('Козлов Д.В.')");
          db.run("INSERT INTO subjects (name) VALUES ('Математика')");
          db.run("INSERT INTO subjects (name) VALUES ('Программирование')");
          db.run("INSERT INTO subjects (name) VALUES ('Базы данных')");
          
          // Добавляем аудитории
          db.run("INSERT INTO classrooms (name, building, floor, capacity, type) VALUES ('305', 'Главный корпус', 3, 30, 'lecture')");
          db.run("INSERT INTO classrooms (name, building, floor, capacity, type) VALUES ('412', 'Главный корпус', 4, 25, 'computer')");
          db.run("INSERT INTO classrooms (name, building, floor, capacity, type) VALUES ('208', 'Лабораторный корпус', 2, 20, 'lab')");
          db.run("INSERT INTO classrooms (name, building, floor, capacity, type) VALUES ('101', 'Главный корпус', 1, 60, 'lecture')");
          
          console.log('📊 Test data added');
          
          setTimeout(() => {
            db.get("SELECT id FROM groups WHERE name = 'ИС-21'", (err, group) => {
              db.get("SELECT id FROM teachers WHERE name = 'Петров И.И.'", (err, teacher) => {
                db.get("SELECT id FROM subjects WHERE name = 'Программирование'", (err, subject) => {
                  db.get("SELECT id FROM classrooms WHERE name = '412'", (err, classroom) => {
                    if (group && teacher && subject && classroom) {
                      db.run(
                        `INSERT INTO schedule (group_id, teacher_id, subject_id, classroom_id, pair_number, day_of_week) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [group.id, teacher.id, subject.id, classroom.id, 1, 1]
                      );
                      console.log('📅 Test schedule added');
                    }
                  });
                });
              });
            });
            
            resolve();
          }, 100);
        }, 100);
        
      } catch (error) {
        reject(error);
      }
    }, 100);
  });
};

initDb()
  .then(() => {
    console.log('🎉 Database initialization complete!');
    console.log('🔑 Test accounts (password: 1234 for all):');
    console.log('   Admin: admin');
    console.log('   Methodist: methodist');
    console.log('   Teacher: teacher');
    console.log('   Student: student');
    db.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    db.close();
    process.exit(1);
  });