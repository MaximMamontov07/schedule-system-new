import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const db = await getDb();
    
    // Создаем хеш для пароля "1234"
    const hashedPassword = await bcrypt.hash('1234', 10);
    
    // Удаляем старого admin
    await db.query('DELETE FROM users WHERE username = $1', ['admin']);
    
    // Создаем нового admin
    await db.query(
      'INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4)',
      ['admin', hashedPassword, 'Администратор', 'admin']
    );
    
    return NextResponse.json({ 
      success: true, 
      message: 'Admin created! Password: 1234',
      hash: hashedPassword
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}