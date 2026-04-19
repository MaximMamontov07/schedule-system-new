// Добавьте этот метод в конец файла schedule/route.js
export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id, notes, status } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'ID занятия обязателен' }, { status: 400 });
    }

    const db = await getDb();
    
    // Проверяем, что занятие принадлежит преподавателю (если пользователь - преподаватель)
    if (user.role === 'teacher') {
      const teacher = await db.query('SELECT id FROM teachers WHERE user_id = $1', [user.id]);
      if (teacher.rows.length > 0) {
        const lessonCheck = await db.query(
          'SELECT id FROM schedule WHERE id = $1 AND teacher_id = $2',
          [id, teacher.rows[0].id]
        );
        if (lessonCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Это не ваше занятие' }, { status: 403 });
        }
      }
    }
    
    // Обновляем заметки
    await db.query(
      'UPDATE schedule SET notes = $1, status = $2 WHERE id = $3',
      [notes || null, status || 'planned', id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule PATCH error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}