import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    console.log('User in POST:', user);
    
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const db = await getDb();
    const body = await request.json();
    console.log('Request body:', body);
    
    const { group_id, teacher_id, subject_id, pair_number, day_of_week } = body;

    const query = `
      INSERT INTO schedule (group_id, teacher_id, subject_id, pair_number, day_of_week) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      group_id, 
      teacher_id, 
      subject_id, 
      pair_number, 
      day_of_week
    ]);

    console.log('Created schedule id:', result.rows[0].id);

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id 
    });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT 
        s.*,
        g.name as group_name,
        t.name as teacher_name,
        sub.name as subject_name
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN teachers t ON s.teacher_id = t.id
      JOIN subjects sub ON s.subject_id = sub.id
      ORDER BY s.day_of_week, s.pair_number
    `);
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}