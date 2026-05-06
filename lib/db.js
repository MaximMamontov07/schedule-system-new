import pg from 'pg';
const { Pool } = pg;

let pool = null;

export async function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL not set');
    }
    
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  
  return {
    query: (text, params) => pool.query(text, params),
    // Добавляем метод get для совместимости с SQLite
    get: async (text, params) => {
      const result = await pool.query(text, params);
      return result.rows[0];
    },
    // Добавляем метод run для совместимости с SQLite
    run: async (text, params) => {
      const result = await pool.query(text, params);
      return { lastID: result.rows[0]?.id, changes: result.rowCount };
    }
  };
}