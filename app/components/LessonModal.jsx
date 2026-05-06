import { memo, useState, useEffect } from 'react';
import { DAYS, PAIRS } from '@/lib/schedule-service';
import { SearchableSelect } from './SearchableSelect';

export const LessonModal = memo(({
  isOpen,
  lesson,
  groups,
  teachers,
  subjects,
  classrooms,
  onSave,
  onClose,
  isEditing = false
}) => {
  const [formData, setFormData] = useState({
    group_id: '',
    teacher_id: '',
    subject_id: '',
    classroom_id: '',
    pair_number: '1',
    day_of_week: '1',
    date: ''
  });

  useEffect(() => {
    if (lesson) {
      setFormData({
        group_id: lesson.group_id || '',
        teacher_id: lesson.teacher_id || '',
        subject_id: lesson.subject_id || '',
        classroom_id: lesson.classroom_id || '',
        pair_number: String(lesson.pair_number || '1'),
        day_of_week: String(lesson.day_of_week || '1'),
        date: lesson.date || ''
      });
    } else {
      setFormData({
        group_id: '',
        teacher_id: '',
        subject_id: '',
        classroom_id: '',
        pair_number: '1',
        day_of_week: '1',
        date: ''
      });
    }
  }, [lesson]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const groupOptions = groups?.map(g => ({ value: String(g.id), label: g.name })) || [];
  const teacherOptions = teachers?.map(t => ({ value: String(t.id), label: t.name })) || [];
  const subjectOptions = subjects?.map(s => ({ value: String(s.id), label: s.name })) || [];
  const classroomOptions = classrooms?.map(c => ({ value: String(c.id), label: c.name })) || [];
  const dayOptions = DAYS.map(day => ({ value: String(day.value), label: day.name }));
  const pairOptions = PAIRS.map(p => ({ value: String(p.number), label: `${p.name} (${p.time})` }));

  if (!isOpen) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <i className="fas fa-calendar-plus"></i>
            {isEditing ? 'Редактировать занятие' : 'Добавить занятие'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label><i className="fas fa-users"></i> Группа</label>
            <SearchableSelect
              options={groupOptions}
              value={formData.group_id}
              onChange={(val) => handleChange('group_id', val)}
              placeholder="Выберите группу"
              label=""
              icon="fas fa-users"
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-book"></i> Предмет</label>
            <SearchableSelect
              options={subjectOptions}
              value={formData.subject_id}
              onChange={(val) => handleChange('subject_id', val)}
              placeholder="Выберите предмет"
              label=""
              icon="fas fa-book"
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-chalkboard-teacher"></i> Преподаватель</label>
            <SearchableSelect
              options={teacherOptions}
              value={formData.teacher_id}
              onChange={(val) => handleChange('teacher_id', val)}
              placeholder="Выберите преподавателя"
              label=""
              icon="fas fa-chalkboard-teacher"
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-door-open"></i> Аудитория</label>
            <SearchableSelect
              options={classroomOptions}
              value={formData.classroom_id}
              onChange={(val) => handleChange('classroom_id', val)}
              placeholder="Выберите аудиторию"
              label=""
              icon="fas fa-door-open"
            />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label><i className="fas fa-calendar-day"></i> День недели</label>
              <SearchableSelect
                options={dayOptions}
                value={formData.day_of_week}
                onChange={(val) => handleChange('day_of_week', val)}
                placeholder="День недели"
                label=""
                icon="fas fa-calendar-day"
              />
            </div>

            <div className="form-group half">
              <label><i className="fas fa-clock"></i> Пара</label>
              <SearchableSelect
                options={pairOptions}
                value={formData.pair_number}
                onChange={(val) => handleChange('pair_number', val)}
                placeholder="Пара"
                label=""
                icon="fas fa-clock"
              />
            </div>
          </div>

          <div className="form-group">
            <label><i className="fas fa-calendar-alt"></i> Дата занятия</label>
            <input 
              type="date" 
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              required
              className="date-input"
            />
            <small className="filter-hint">Выберите конкретную дату занятия</small>
          </div>

          <button type="submit" className="submit-btn">
            <i className="fas fa-save"></i>
            {isEditing ? ' Сохранить изменения' : ' Добавить занятие'}
          </button>
        </form>
      </div>
    </div>
  );
});

LessonModal.displayName = 'LessonModal';