// scripts/add-date-column.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const db = await open({
    filename: path.join(__dirname, '..', 'database.db'),
    driver: sqlite3.Database
  });

  try {
    console.log('Начинаем миграцию SQLite...');
    
    // Проверяем, существует ли колонка date
    const tableInfo = await db.all("PRAGMA table_info(schedule)");
    const hasDateColumn = tableInfo.some(col => col.name === 'date');
    
    if (!hasDateColumn) {
      console.log('Добавляем колонку date...');
      await db.exec('ALTER TABLE schedule ADD COLUMN date TEXT');
      console.log('✓ Колонка date добавлена');
    } else {
      console.log('Колонка date уже существует');
    }
    
    // Создаем индекс
    try {
      await db.exec('CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule(date)');
      console.log('✓ Индекс создан');
    } catch (e) {
      console.log('Индекс уже существует');
    }
    
    // Получаем понедельник текущей недели
    const now = new Date();
    const currentDay = now.getDay();
    const diff = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }
    
    // Обновляем записи без даты
    const rows = await db.all('SELECT id, day_of_week FROM schedule WHERE date IS NULL');
    
    for (const row of rows) {
      const date = weekDates[row.day_of_week - 1];
      await db.run('UPDATE schedule SET date = ? WHERE id = ?', [date, row.id]);
    }
    
    console.log(`✓ Обновлено ${rows.length} записей`);
    console.log('Миграция завершена успешно!');
    
  } catch (error) {
    console.error('Ошибка миграции:', error);
  } finally {
    await db.close();
  }
}

migrate();