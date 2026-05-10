import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Pool } = pg;

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL не установлен');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
  });
  
  console.log('🔧 Подключение к базе данных...');
  
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'add-template-system.sql'), 'utf8');
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
        console.log('✅ Выполнен запрос');
      }
    }
    
    console.log('🎉 Миграция успешно завершена!');
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();