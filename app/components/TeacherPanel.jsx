import { memo, useState } from 'react';
import { DAYS, PAIRS, DateUtils } from '@/lib/schedule-service';

export const TeacherPanel = memo(({ data, weekDates, onUpdateNotes }) => {
  const [localNotes, setLocalNotes] = useState({});
  const [saving, setSaving] = useState({});

  const scheduleMatrix = (() => {
    const matrix = Array(7).fill().map(() => Array(6).fill().map(() => []));
    data.forEach(lesson => {
      const dayIndex = lesson.day_of_week - 1;
      const pairIndex = lesson.pair_number - 1;
      if (dayIndex >= 0 && dayIndex < 7 && pairIndex >= 0 && pairIndex < 6) {
        matrix[dayIndex][pairIndex].push(lesson);
      }
    });
    return matrix;
  })();

  const handleSave = async (lessonId, notes) => {
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    try {
      await onUpdateNotes(lessonId, notes);
      setLocalNotes(prev => {
        const newState = { ...prev };
        delete newState[lessonId];
        return newState;
      });
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  return (
    <div className="schedule-grid-wrapper">
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header"><div className="time-header-content"><i className="fas fa-clock"></i><span>Время</span></div></th>
            {DAYS.map((day, idx) => {
              const date = weekDates?.[idx];
              const isToday = date && DateUtils.isToday(date);
              return (
                <th key={day.value} className={`day-header ${isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`}>
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
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'}`}>
                    {hasLessons && (
                      <div className="teacher-lessons-container">
                        {lessons.map(lesson => {
                          const notes = localNotes[lesson.id] !== undefined ? localNotes[lesson.id] : (lesson.notes || '');
                          const isSaving = saving[lesson.id];
                          
                          return (
                            <div key={lesson.id} className="teacher-lesson-card">
                              <div className="lesson-header">
                                <h4 className="lesson-title">{lesson.subject_name}</h4>
                                <span className="lesson-group-tag">{lesson.group_name}</span>
                              </div>
                              <div className="lesson-body">
                                <div className="lesson-info">
                                  <i className="fas fa-door-open"></i>
                                  <span>{lesson.classroom_name || 'Аудитория не указана'}</span>
                                </div>
                                <textarea
                                  value={notes}
                                  onChange={(e) => setLocalNotes(prev => ({ ...prev, [lesson.id]: e.target.value }))}
                                  placeholder="Заметки (домашнее задание, материалы...)"
                                  rows="2"
                                  className="teacher-notes-textarea"
                                />
                                {(localNotes[lesson.id] !== undefined && localNotes[lesson.id] !== lesson.notes) && (
                                  <div className="teacher-actions-modern">
                                    <button onClick={() => handleSave(lesson.id, notes)} disabled={isSaving} className="teacher-action-btn save">
                                      {isSaving ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-check"></i>} Сохранить
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
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

TeacherPanel.displayName = 'TeacherPanel';