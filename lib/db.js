import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Определяем путь к базе данных
let dbPath;
if (process.env.RENDER) {
  // На Render используем persistent disk
  const dataDir = '/var/data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dbPath = path.join(dataDir, 'database.db');
} else {
  // Локальная разработка
  dbPath = path.join(process.cwd(), 'database.db');
}

console.log(`Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbExec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export async function getDb() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      group_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await dbExec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await dbExec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      user_id INTEGER UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await dbExec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await dbExec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      building TEXT,
      floor INTEGER,
      capacity INTEGER,
      type TEXT DEFAULT 'standard',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await dbExec(`
    CREATE TABLE IF NOT EXISTS schedule (
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
  
  return {
    get: dbGet,
    all: dbAll,
    run: dbRun,
    exec: dbExec
  };
}