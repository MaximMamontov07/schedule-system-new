import pg from 'pg';
const { Pool } = pg;

let pool = null;

export async function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Создаем таблицы
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        user_id INTEGER UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        building TEXT,
        floor INTEGER,
        capacity INTEGER,
        type TEXT DEFAULT 'standard',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        group_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // СОЗДАЕМ ТАБЛИЦУ schedule С classroom_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
        pair_number INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        status TEXT DEFAULT 'planned',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ДОБАВЛЯЕМ КОЛОНКУ, ЕСЛИ ЕЁ НЕТ
    try {
      await pool.query(`
        ALTER TABLE schedule ADD COLUMN IF NOT EXISTS classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL
      `);
    } catch (err) {
      console.log('Column classroom_id already exists or error:', err.message);
    }
    
    try {
      await pool.query(`
        ALTER TABLE schedule ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned'
      `);
    } catch (err) {}
    
    try {
      await pool.query(`
        ALTER TABLE schedule ADD COLUMN IF NOT EXISTS notes TEXT
      `);
    } catch (err) {}
    
    // Добавляем тестовые данные
    const result = await pool.query('SELECT COUNT(*) as count FROM groups');
    if (parseInt(result.rows[0].count) === 0) {
      console.log('Добавление тестовых данных...');
      await pool.query("INSERT INTO groups (name) VALUES ('ИС-21')");
      await pool.query("INSERT INTO groups (name) VALUES ('ИС-22')");
      await pool.query("INSERT INTO teachers (name) VALUES ('Иванов А.А.')");
      await pool.query("INSERT INTO teachers (name) VALUES ('Петрова Е.М.')");
      await pool.query("INSERT INTO subjects (name) VALUES ('Программирование')");
      await pool.query("INSERT INTO subjects (name) VALUES ('Базы данных')");
      await pool.query("INSERT INTO classrooms (name) VALUES ('305')");
      await pool.query("INSERT INTO classrooms (name) VALUES ('412')");
    }
  }
  
  return {
    query: (text, params) => pool.query(text, params),
    get: async (text, params) => {
      const result = await pool.query(text, params);
      return result.rows[0];
    },
    all: async (text, params) => {
      const result = await pool.query(text, params);
      return result.rows;
    },
    run: async (text, params) => {
      const result = await pool.query(text, params);
      return result;
    }
  };
}