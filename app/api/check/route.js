import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    const db = await getDb();
    
    // Проверяем структуру таблиц
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Проверяем колонки в teachers
    const teachersColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teachers'
      ORDER BY ordinal_position
    `);
    
    // Проверяем колонки в schedule
    const scheduleColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schedule'
      ORDER BY ordinal_position
    `);
    
    // Проверяем количество записей
    const groupsCount = await db.query('SELECT COUNT(*) as count FROM groups');
    const teachersCount = await db.query('SELECT COUNT(*) as count FROM teachers');
    const subjectsCount = await db.query('SELECT COUNT(*) as count FROM subjects');
    const scheduleCount = await db.query('SELECT COUNT(*) as count FROM schedule');
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    
    return NextResponse.json({
      authenticated: !!user,
      user: user ? { id: user.id, role: user.role, username: user.username } : null,
      tables: tables.rows.map(t => t.table_name),
      teachersColumns: teachersColumns.rows,
      scheduleColumns: scheduleColumns.rows,
      counts: {
        groups: parseInt(groupsCount.rows[0].count),
        teachers: parseInt(teachersCount.rows[0].count),
        subjects: parseInt(subjectsCount.rows[0].count),
        schedule: parseInt(scheduleCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}