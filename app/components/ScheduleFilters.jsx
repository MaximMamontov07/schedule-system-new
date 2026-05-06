import { memo } from 'react';
import { DAYS, PAIRS } from '@/lib/schedule-service';
import { SearchableSelect } from './SearchableSelect';
import { DateUtils } from '@/lib/schedule-service';

export const ScheduleFilters = memo(({
  filters,
  onFilterChange,
  groups,
  teachers,
  subjects,
  classrooms,
  onReset,
  onOpenCalendar,
  currentDate,
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
  showGroupFilter = true,
  isStudent = false,
  selectedGroupId,
  loading = false
}) => {
  const weekDates = DateUtils.getWeekDates(currentDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const groupOptions = groups?.map(g => ({ value: String(g.id), label: g.name })) || [];
  const teacherOptions = teachers?.map(t => ({ value: String(t.id), label: t.name })) || [];
  const subjectOptions = subjects?.map(s => ({ value: String(s.id), label: s.name })) || [];
  const classroomOptions = classrooms?.map(c => ({ value: String(c.id), label: c.name })) || [];
  const dayOptions = DAYS.map(day => ({ value: String(day.value), label: day.name }));
  const pairOptions = PAIRS.map(p => ({ value: String(p.number), label: `${p.name} (${p.time})` }));

  const areControlsDisabled = loading;

  return (
    <div className="filter-section">
      <div className="filter-section-header">
        <div className="week-navigation">
          <button 
            className="calendar-icon-btn" 
            onClick={onOpenCalendar}
            disabled={areControlsDisabled}
          >
            <i className="fas fa-calendar-alt"></i>
            <span>{DateUtils.formatDate(currentDate, 'ru')}</span>
          </button>
          
          <div className="week-controls">
            <button onClick={onPrevWeek} className="week-nav-btn" disabled={areControlsDisabled}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <div className="week-display">
              <i className="fas fa-calendar-week"></i>
              <span>
                {DateUtils.formatDate(weekStart)} - {DateUtils.formatDate(weekEnd)}
              </span>
              <span className="week-number">
                ({DateUtils.getWeekNumber(currentDate)} неделя)
              </span>
            </div>
            <button onClick={onNextWeek} className="week-nav-btn" disabled={areControlsDisabled}>
              <i className="fas fa-chevron-right"></i>
            </button>
            <button onClick={onCurrentWeek} className="week-today-btn" disabled={areControlsDisabled}>
              <i className="fas fa-calendar-day"></i> Сегодня
            </button>
          </div>
        </div>
        <button className="reset-filters-btn" onClick={onReset} disabled={areControlsDisabled}>
          <i className="fas fa-undo-alt"></i> Сбросить фильтры
        </button>
      </div>
      
      <div className="filter-grid">
        {showGroupFilter && !isStudent && (
          <div className="filter-group">
            <SearchableSelect
              options={groupOptions}
              value={selectedGroupId ? String(selectedGroupId) : filters.groupId}
              onChange={(val) => onFilterChange('groupId', val)}
              placeholder="Выберите группу"
              label="Группа"
              icon="fas fa-users"
              disabled={loading}
            />
          </div>
        )}

        <div className="filter-group">
          <SearchableSelect
            options={teacherOptions}
            value={filters.teacherId}
            onChange={(val) => onFilterChange('teacherId', val)}
            placeholder="Выберите преподавателя"
            label="Преподаватель"
            icon="fas fa-chalkboard-teacher"
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <SearchableSelect
            options={subjectOptions}
            value={filters.subjectId}
            onChange={(val) => onFilterChange('subjectId', val)}
            placeholder="Выберите предмет"
            label="Предмет"
            icon="fas fa-book"
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <SearchableSelect
            options={dayOptions}
            value={filters.dayOfWeek}
            onChange={(val) => onFilterChange('dayOfWeek', val)}
            placeholder="Выберите день"
            label="День недели"
            icon="fas fa-calendar-day"
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <SearchableSelect
            options={pairOptions}
            value={filters.pairNumber}
            onChange={(val) => onFilterChange('pairNumber', val)}
            placeholder="Выберите пару"
            label="Пара"
            icon="fas fa-clock"
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <SearchableSelect
            options={classroomOptions}
            value={filters.classroomId}
            onChange={(val) => onFilterChange('classroomId', val)}
            placeholder="Выберите аудиторию"
            label="Аудитория"
            icon="fas fa-door-open"
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
});

ScheduleFilters.displayName = 'ScheduleFilters';