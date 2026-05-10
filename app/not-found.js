export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>404 - Страница не найдена</h1>
      <p>Запрашиваемая страница не существует.</p>
      <Link href="/" style={{ color: '#2c3e66', textDecoration: 'underline' }}>
        Вернуться на главную
      </Link>
    </div>
  );
}