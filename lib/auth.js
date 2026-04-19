import jwt from 'jsonwebtoken';
import { getDb } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function verifyToken(token) {
  try {
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    
    const user = await db.get(
      'SELECT id, username, full_name, role, group_id FROM users WHERE id = ?',
      [decoded.id]
    );
    
    return user;
  } catch (error) {
    console.error('Verify token error:', error);
    return null;
  }
}

export async function getUserFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  const token = authHeader.split(' ')[1];
  return await verifyToken(token);
}