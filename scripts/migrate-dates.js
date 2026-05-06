import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

// Функция для получения даты по дню недели (от текущей недели)
function getDateForDayOfWeek(dayOfWeek) {
  const now = new Date();
  const currentDay = now.getDay();
  const diff = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  
  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + (dayOfWeek - 1));
  
  return targetDate.toISOString().split('T')[0];
}

console.log('📅 Migrating existing schedule entries with dates...');

// Сначала проверяем, есть ли колонка date
db.all("PRAGMA table_info(schedule)", (err, columns) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  const hasDateColumn = columns.some(col => col.name === 'date');
  if (!hasDateColumn) {
    console.log('❌ Date column does not exist. Run add-date-column.js first!');
    db.close();
    return;
  }
  
  db.all('SELECT id, day_of_week FROM schedule WHERE date IS NULL', (err, rows) => {
    if (err) {
      console.error('Error:', err);
      db.close();
      return;
    }
    
    console.log(`Found ${rows.length} entries without date`);
    
    if (rows.length === 0) {
      console.log('✅ No entries need migration');
      db.close();
      return;
    }
    
    let updated = 0;
    rows.forEach(row => {
      const date = getDateForDayOfWeek(row.day_of_week);
      db.run('UPDATE schedule SET date = ? WHERE id = ?', [date, row.id], function(err) {
        if (!err) updated++;
        if (updated === rows.length) {
          console.log(`✅ Updated ${updated} entries with dates`);
          db.close();
        }
      });
    });
  });
});