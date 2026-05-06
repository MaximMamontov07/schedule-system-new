import { memo, useMemo } from 'react';
import { DAYS, PAIRS, DateUtils } from '@/lib/schedule-service';

const LessonCard = memo(({ lesson, canEdit, onEdit, onDelete }) => (
  <div className="lesson-card-modern">
    <div className="lesson-header">
      <h4 className="lesson-title">{lesson.subject_name}</h4>
      <span className="lesson-group-tag">{lesson.group_name}</span>
    </div>
    <div className="lesson-body">
      <div className="lesson-info">
        <i className="fas fa-chalkboard-teacher"></i>
        <span>{lesson.teacher_name}</span>
      </div>
      {lesson.classroom_name && (
        <div className="lesson-info">
          <i className="fas fa-door-open"></i>
          <span>{lesson.classroom_name}</span>
        </div>
      )}
      {lesson.date && (
        <div className="lesson-info">
          <i className="fas fa-calendar-alt"></i>
          <span>{new Date(lesson.date).toLocaleDateString('ru-RU')}</span>
        </div>
      )}
      {lesson.notes && (
        <div className="lesson-notes-badge" title={lesson.notes}>
          <i className="fas fa-sticky-note"></i>
          <span>{lesson.notes.length > 35 ? lesson.notes.substring(0, 35) + '...' : lesson.notes}</span>
        </div>
      )}
    </div>
    {canEdit && (
      <div className="lesson-actions-modern">
        <button className="lesson-action-btn edit" onClick={() => onEdit(lesson)} title="Редактировать">
          <i className="fas fa-edit"></i>
        </button>
        <button className="lesson-action-btn delete" onClick={() => onDelete(lesson.id)} title="Удалить">
          <i className="fas fa-trash-alt"></i>
        </button>
      </div>
    )}
  </div>
));

LessonCard.displayName = 'LessonCard';

const EmptyCell = memo(({ canEdit, onAdd, dayOfWeek, pairNumber }) => (
  canEdit ? (
    <button 
      className="add-lesson-btn"
      onClick={() => onAdd({ day_of_week: dayOfWeek, pair_number: pairNumber })}
      title="Добавить занятие"
    >
      <i className="fas fa-plus"></i>
    </button>
  ) : (
    <div className="empty-cell"></div>
  )
));

EmptyCell.displayName = 'EmptyCell';

export const ScheduleGrid = memo(({ 
  data, 
  weekDates,
  canEdit = false, 
  onEditClick, 
  onDeleteClick, 
  onAddClick,
  loading = false 
}) => {
  const scheduleMatrix = useMemo(() => {
    const matrix = Array(7).fill().map(() => Array(6).fill().map(() => []));
    if (Array.isArray(data)) {
      data.forEach(lesson => {
        const dayIndex = lesson.day_of_week - 1;
        const pairIndex = lesson.pair_number - 1;
        if (dayIndex >= 0 && dayIndex < 7 && pairIndex >= 0 && pairIndex < 6) {
          matrix[dayIndex][pairIndex].push(lesson);
        }
      });
    }
    return matrix;
  }, [data]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Загрузка расписания...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-calendar-times"></i>
        <p>Нет занятий на выбранную неделю</p>
      </div>
    );
  }

  return (
    <div className="schedule-grid-wrapper">
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header">
              <div className="time-header-content">
                <i className="fas fa-clock"></i>
                <span>Время</span>
              </div>
            </th>
            {DAYS.map((day, idx) => {
              const date = weekDates?.[idx];
              const isToday = date && DateUtils.isToday(date);
              const isWeekend = day.isWeekend;
              return (
                <th key={day.value} className={`day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
                  <div className="day-header-content">
                    <span className="day-name">{day.name}</span>
                    <span className="day-date">{date ? DateUtils.formatDate(date) : ''}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot">
                <div className="time-slot-card">
                  <span className="pair-number">{pair.name}</span>
                  <span className="pair-time">{pair.time}</span>
                </div>
              </td>
              {DAYS.map((day, dayIndex) => {
                const lessons = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLessons = lessons.length > 0;
                const date = weekDates?.[dayIndex];
                const isToday = date && DateUtils.isToday(date);
                const isWeekend = day.isWeekend;
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} 
                      className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'} ${isToday ? 'today-column' : ''} ${isWeekend ? 'weekend-column' : ''}`}>
                    {hasLessons ? (
                      <div className="lessons-container">
                        {lessons.map(lesson => (
                          <LessonCard
                            key={lesson.id}
                            lesson={lesson}
                            canEdit={canEdit}
                            onEdit={onEditClick}
                            onDelete={onDeleteClick}
                          />
                        ))}
                        {canEdit && onAddClick && lessons.length < 6 && (
                          <button 
                            className="add-lesson-btn-mini"
                            onClick={() => onAddClick({ day_of_week: day.value, pair_number: pair.number })}
                            title="Добавить занятие"
                          >
                            <i className="fas fa-plus"></i>
                          </button>
                        )}
                      </div>
                    ) : (
                      <EmptyCell 
                        canEdit={canEdit}
                        onAdd={onAddClick}
                        dayOfWeek={day.value}
                        pairNumber={pair.number}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

ScheduleGrid.displayName = 'ScheduleGrid';