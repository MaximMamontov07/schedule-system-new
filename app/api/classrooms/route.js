import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query('SELECT * FROM classrooms ORDER BY name');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Classrooms GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}