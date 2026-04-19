import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // Добавляем колонку user_id в teachers
    await db.query(`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE
    `).catch(e => console.log('Column user_id already exists'));
    
    // Добавляем колонку classroom_id в schedule
    await db.query(`
      ALTER TABLE schedule ADD COLUMN IF NOT EXISTS classroom_id INTEGER
    `).catch(e => console.log('Column classroom_id already exists'));
    
    // Добавляем колонку notes в schedule
    await db.query(`
      ALTER TABLE schedule ADD COLUMN IF NOT EXISTS notes TEXT
    `).catch(e => console.log('Column notes already exists'));
    
    // Добавляем колонку status в schedule
    await db.query(`
      ALTER TABLE schedule ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned'
    `).catch(e => console.log('Column status already exists'));
    
    // Проверяем структуру
    const teachersColumns = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'teachers' ORDER BY ordinal_position
    `);
    
    const scheduleColumns = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'schedule' ORDER BY ordinal_position
    `);
    
    return NextResponse.json({
      success: true,
      message: 'Database fixed!',
      teachersColumns: teachersColumns.rows.map(r => r.column_name),
      scheduleColumns: scheduleColumns.rows.map(r => r.column_name)
    });
  } catch (error) {
    console.error('Fix DB error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}