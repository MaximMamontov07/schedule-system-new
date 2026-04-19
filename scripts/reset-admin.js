import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

async function resetAdmin() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Проверяем существование админа
        db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, row) => {
          if (err) {
            console.error('Error checking admin:', err);
            reject(err);
            return;
          }
          
          const hashedPassword = await bcrypt.hash('1234', 10);
          
          if (row) {
            // Обновляем пароль существующего админа
            db.run(
              'UPDATE users SET password = ? WHERE username = ?',
              [hashedPassword, 'admin'],
              function(err) {
                if (err) {
                  console.error('Error updating admin:', err);
                  reject(err);
                } else {
                  console.log('✅ Admin password reset successfully!');
                  console.log('📧 Login: admin');
                  console.log('🔑 Password: 1234');
                  resolve();
                }
              }
            );
          } else {
            // Создаём нового админа
            db.run(
              'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
              ['admin', hashedPassword, 'Администратор системы', 'admin'],
              function(err) {
                if (err) {
                  console.error('Error creating admin:', err);
                  reject(err);
                } else {
                  console.log('✅ Admin user created successfully!');
                  console.log('📧 Login: admin');
                  console.log('🔑 Password: 1234');
                  resolve();
                }
              }
            );
          }
        });
      } catch (error) {
        console.error('Error:', error);
        reject(error);
      }
    });
  });
}

// Запускаем сброс
resetAdmin()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });