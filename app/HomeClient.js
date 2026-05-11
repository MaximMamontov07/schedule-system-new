'use client';

import React, { useState, useEffect, useMemo, useRef, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const PAIRS = [
  { number: 1, time: '8:30-10:00', name: '1 пара' },
  { number: 2, time: '10:10-11:40', name: '2 пара' },
  { number: 3, time: '12:10-13:40', name: '3 пара' },
  { number: 4, time: '13:50-15:20', name: '4 пара' },
  { number: 5, time: '15:30-17:00', name: '5 пара' },
  { number: 6, time: '17:10-18:40', name: '6 пара' }
];
const ROLES = { admin: 'Администратор', teacher: 'Преподаватель', student: 'Студент' };

const scheduleCache = new Map();

// ---------- Функции для дат ----------
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  try {
    if (dateString instanceof Date) {
      return new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate());
    }
    let str = String(dateString);
    if (str.includes('T')) str = str.split('T')[0];
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    if (str.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const [day, month, year] = str.split('.').map(Number);
      return new Date(year, month - 1, day);
    }
    return null;
  } catch (e) { return null; }
};

const formatForInput = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    const parsed = parseLocalDate(date);
    if (parsed && !isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateRu = (dateString) => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return 'Дата не указана';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') date = parseLocalDate(date);
  if (!date) return '';
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

const getWeekNumber = (date) => {
  if (typeof date === 'string') date = parseLocalDate(date);
  if (!date) return 1;
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getMonday = (date) => {
  if (typeof date === 'string') date = parseLocalDate(date);
  if (!date) return new Date();
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
};

const getWeekDates = (date) => {
  if (typeof date === 'string') date = parseLocalDate(date);
  if (!date) date = new Date();
  const monday = getMonday(date);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// ---------- SearchableSelect ----------
const SearchableSelect = ({ options, value, onChange, placeholder, label, icon, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    if (isOpen && selectedOption) setSearchTerm(selectedOption.label);
    else if (!isOpen) { setSearchTerm(''); setHighlightedIndex(-1); }
  }, [isOpen, selectedOption]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  useEffect(() => {
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (disabled) {
    return (
      <div className="searchable-select disabled">
        <label><i className={icon}></i> {label}</label>
        <div className="searchable-select-input disabled">
          <span>{selectedOption?.label || placeholder}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="searchable-select" ref={dropdownRef}>
      <label><i className={icon}></i> {label}</label>
      <div className={`searchable-select-input ${isOpen ? 'focused' : ''} ${value ? 'has-value' : ''}`}>
        <input ref={inputRef} type="text" className="searchable-select-input-field" placeholder={placeholder}
          value={isOpen ? searchTerm : (selectedOption?.label || '')}
          onChange={(e) => { setSearchTerm(e.target.value); if (!isOpen) setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        />
        <div className="searchable-select-icons">
          {value && <button className="searchable-select-clear-btn" onClick={(e) => { e.stopPropagation(); onChange(''); }}><i className="fas fa-times-circle"></i></button>}
          <i className={`fas fa-chevron-down ${isOpen ? 'rotated' : ''}`}></i>
        </div>
      </div>
      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-empty"><i className="fas fa-search"></i> Ничего не найдено</div>
            ) : (
              filteredOptions.map((option, idx) => (
                <div key={option.value} className={`searchable-select-option ${value === option.value ? 'selected' : ''} ${highlightedIndex === idx ? 'highlighted' : ''}`}
                  onClick={() => handleSelect(option)} onMouseEnter={() => setHighlightedIndex(idx)}>
                  <div className="searchable-select-option-content">
                    <span>{option.label}</span>
                    {value === option.value && <span><i className="fas fa-check"></i></span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- DatePicker ----------
const DatePicker = ({ onDateSelect, onClose, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const [viewMode, setViewMode] = useState('month');
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false, day: prevLast - i });
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true, day: i });
    for (let i = 1; days.length < 42; i++) days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, day: i });
    return days;
  };

  const isToday = (date) => { const t = new Date(); return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear(); };
  const isSel = (date) => selectedDate && date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();

  return (
    <div className="datepicker-modal" onClick={e => e.stopPropagation()}>
      <div className="datepicker-header">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><i className="fas fa-chevron-left"></i></button>
        <button onClick={() => setViewMode(viewMode === 'month' ? 'year' : 'month')}>
          {viewMode === 'month' ? `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}` : currentMonth.getFullYear()}
        </button>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><i className="fas fa-chevron-right"></i></button>
        <button onClick={onClose}><i className="fas fa-times"></i></button>
      </div>
      {viewMode === 'month' ? (
        <>
          <div className="datepicker-weekdays">{weekdays.map(d => <div key={d}>{d}</div>)}</div>
          <div className="datepicker-days">
            {getDaysInMonth(currentMonth).map((day, i) => (
              <button key={i} className={`datepicker-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday(day.date) ? 'today' : ''} ${isSel(day.date) ? 'selected' : ''}`}
                onClick={() => { onDateSelect(day.date); onClose(); }}>{day.day}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="datepicker-years">
          {Array.from({ length: 11 }, (_, i) => currentMonth.getFullYear() - 5 + i).map(year => (
            <button key={year} className={`datepicker-year ${year === currentMonth.getFullYear() ? 'active' : ''}`}
              onClick={() => { setCurrentMonth(new Date(year, currentMonth.getMonth(), 1)); setViewMode('month'); }}>{year}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- ScheduleGrid ----------
const ScheduleGrid = React.memo(({ data, canEdit = false, onEditClick, onDeleteClick, onAddClick, weekDates, selectedDate, isLoading = false }) => {
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

  return (
    <div className={`schedule-grid-wrapper ${isLoading ? 'loading' : ''}`}>
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header"><div className="time-header-content"><i className="fas fa-clock"></i><span>Время</span></div></th>
            {DAYS.map((day, idx) => {
              const date = weekDates?.[idx];
              const isToday = date && date.toDateString() === new Date().toDateString();
              const isSelected = selectedDate && date && date.toDateString() === selectedDate.toDateString();
              const isWeekend = idx === 5 || idx === 6;
              return (
                <th key={day} className={`day-header ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''}`}>
                  <div className="day-header-content"><span className="day-name">{day}</span><span className="day-date">{date ? formatDate(date) : ''}</span></div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot"><div className="time-slot-card"><span className="pair-number">{pair.name}</span><span className="pair-time">{pair.time}</span></div></td>
              {DAYS.map((_, dayIndex) => {
                const lessons = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLessons = lessons.length > 0;
                const date = weekDates?.[dayIndex];
                const isToday = date && date.toDateString() === new Date().toDateString();
                const isWeekend = dayIndex === 5 || dayIndex === 6;
                const dateStr = date ? formatForInput(date) : '';
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'} ${isToday ? 'today-column' : ''} ${isWeekend ? 'weekend-column' : ''}`}>
                    {hasLessons ? (
                      <div className="lessons-container">
                        {lessons.map((lesson, idx) => (
                          <div key={lesson.id || idx} className={`lesson-card-modern ${lesson.source === 'cancelled' ? 'cancelled' : ''}`}>
                            <div className="lesson-header">
                              <h4 className="lesson-title">{lesson.subject_name}</h4>
                              <span className="lesson-group-tag">{lesson.group_name}</span>
                            </div>
                            <div className="lesson-body">
                              <div className="lesson-info"><i className="fas fa-chalkboard-teacher"></i><span>{lesson.teacher_name}</span></div>
                              {lesson.classroom_name && <div className="lesson-info"><i className="fas fa-door-open"></i><span>{lesson.classroom_name}</span></div>}
                              {lesson.date && <div className="lesson-info"><i className="fas fa-calendar-alt"></i><span>{formatDateRu(lesson.date)}</span></div>}
                              {lesson.notes && <div className="lesson-notes-badge" title={lesson.notes}><i className="fas fa-sticky-note"></i><span>{lesson.notes.length > 35 ? lesson.notes.substring(0, 35) + '...' : lesson.notes}</span></div>}
                              {lesson.source && lesson.source !== 'template' && (
                                <div className={`lesson-status-badge status-${lesson.source}`}>
                                  {lesson.source === 'cancelled' ? <><i className="fas fa-ban"></i> Отменено</>
                                  : lesson.source === 'modified' ? <><i className="fas fa-pencil-alt"></i> Изменено</>
                                  : lesson.source === 'added' ? <><i className="fas fa-plus-circle"></i> Добавлено</>
                                  : null}
                                </div>
                              )}
                            </div>
                            {canEdit && (
                              <div className="lesson-actions-modern">
                                <button className="lesson-action-btn edit" onClick={() => onEditClick(lesson)} title="Редактировать"><i className="fas fa-edit"></i></button>
                                <button className="lesson-action-btn delete" onClick={() => onDeleteClick(lesson)} title="Удалить"><i className="fas fa-trash-alt"></i></button>
                              </div>
                            )}
                          </div>
                        ))}
                        {canEdit && onAddClick && lessons.length < 6 && (
                          <button className="add-lesson-btn-mini" onClick={() => onAddClick({ day_of_week: dayIndex + 1, pair_number: pair.number, date: dateStr })} title="Добавить занятие">
                            <i className="fas fa-plus"></i> Добавить
                          </button>
                        )}
                      </div>
                    ) : (
                      canEdit && onAddClick && (
                        <button className="add-lesson-btn" onClick={() => onAddClick({ day_of_week: dayIndex + 1, pair_number: pair.number, date: dateStr })} title="Добавить занятие">
                          <i className="fas fa-plus"></i>
                        </button>
                      )
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

// ---------- FilterSection ----------
const FilterSection = ({ filters, onFilterChange, groups, teachers, subjects, classrooms, onReset, onOpenCalendar, currentDate, onPrevWeek, onNextWeek, onCurrentWeek, showGroupFilter = true, isStudent = false, selectedGroupId, onGroupChange, isLoading = false }) => {
  const weekDates = getWeekDates(currentDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const groupOptions = groups?.map(g => ({ value: String(g.id), label: g.name })) || [];
  const teacherOptions = teachers?.map(t => ({ value: String(t.id), label: t.name })) || [];
  const subjectOptions = subjects?.map(s => ({ value: String(s.id), label: s.name })) || [];
  const classroomOptions = classrooms?.map(c => ({ value: String(c.id), label: c.name })) || [];
  const dayOptions = DAYS.map((day, idx) => ({ value: String(idx + 1), label: day }));
  const pairOptions = PAIRS.map(p => ({ value: String(p.number), label: `${p.name} (${p.time})` }));

  return (
    <div className="filter-section">
      <div className="filter-section-header">
        <div className="week-navigation">
          <button className="calendar-icon-btn" onClick={onOpenCalendar} disabled={isLoading}>
            <i className="fas fa-calendar-alt"></i>
            {currentDate && <span className="selected-date-badge">{currentDate.getDate()}.{currentDate.getMonth() + 1}</span>}
          </button>
          <div className="week-controls">
            <button onClick={onPrevWeek} className="week-nav-btn" disabled={isLoading}><i className="fas fa-chevron-left"></i></button>
            <div className="week-display">
              <i className="fas fa-calendar-week"></i>
              <span>{formatDate(weekStart)} - {formatDate(weekEnd)}</span>
              <span className="week-number">({getWeekNumber(weekStart)} нед.)</span>
            </div>
            <button onClick={onNextWeek} className="week-nav-btn" disabled={isLoading}><i className="fas fa-chevron-right"></i></button>
            <button onClick={onCurrentWeek} className="week-today-btn" disabled={isLoading}><i className="fas fa-calendar-day"></i> Сегодня</button>
          </div>
        </div>
        <button className="reset-filters-btn" onClick={onReset} disabled={isLoading}><i className="fas fa-undo-alt"></i> Сбросить фильтры</button>
      </div>
      <div className="filter-grid">
        {showGroupFilter && !isStudent && (
          <div className="filter-group">
            <SearchableSelect options={groupOptions} value={selectedGroupId ? String(selectedGroupId) : filters.groupId}
              onChange={(val) => { if (onGroupChange) onGroupChange(val); onFilterChange('groupId', val); }}
              placeholder="Выберите группу" label="Группа" icon="fas fa-users" />
          </div>
        )}
        <div className="filter-group"><SearchableSelect options={teacherOptions} value={filters.teacherId} onChange={(val) => onFilterChange('teacherId', val)} placeholder="Выберите преподавателя" label="Преподаватель" icon="fas fa-chalkboard-teacher" /></div>
        <div className="filter-group"><SearchableSelect options={subjectOptions} value={filters.subjectId} onChange={(val) => onFilterChange('subjectId', val)} placeholder="Выберите предмет" label="Предмет" icon="fas fa-book" /></div>
        <div className="filter-group"><SearchableSelect options={dayOptions} value={filters.dayOfWeek} onChange={(val) => onFilterChange('dayOfWeek', val)} placeholder="Выберите день" label="День недели" icon="fas fa-calendar-day" /></div>
        <div className="filter-group"><SearchableSelect options={pairOptions} value={filters.pairNumber} onChange={(val) => onFilterChange('pairNumber', val)} placeholder="Выберите пару" label="Пара" icon="fas fa-clock" /></div>
        <div className="filter-group"><SearchableSelect options={classroomOptions} value={filters.classroomId} onChange={(val) => onFilterChange('classroomId', val)} placeholder="Выберите аудиторию" label="Аудитория" icon="fas fa-door-open" /></div>
      </div>
    </div>
  );
};

// ---------- ScheduleView ----------
const ScheduleView = ({ schedule, groups, teachers, subjects, classrooms, loading, userRole, userGroupId, loadScheduleForWeek }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(userRole === 'student' ? userGroupId : null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const isStudent = userRole === 'student';
  const [filters, setFilters] = useState({
    groupId: isStudent && userGroupId ? String(userGroupId) : '',
    teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: ''
  });

  const loadFnRef = useRef(loadScheduleForWeek);
  useEffect(() => { loadFnRef.current = loadScheduleForWeek; }, [loadScheduleForWeek]);

  const debouncedLoadRef = useRef(null);
  if (!debouncedLoadRef.current) {
    debouncedLoadRef.current = debounce(async (start, end, groupId) => {
      setIsLoadingLocal(true);
      await loadFnRef.current(start, end, groupId);
      setIsLoadingLocal(false);
    }, 300);
  }

  useEffect(() => {
    if (isStudent && userGroupId) {
      setHasAppliedFilter(true);
      setSelectedGroupId(userGroupId);
    }
  }, [isStudent, userGroupId]);

  const weekDates = getWeekDates(currentDate);

  useEffect(() => {
    if (weekDates.length > 0 && hasAppliedFilter) {
      const startDate = formatForInput(weekDates[0]);
      const endDate = formatForInput(weekDates[6]);
      const groupId = selectedGroupId || filters.groupId;
      debouncedLoadRef.current(startDate, endDate, groupId);
    }
  }, [weekDates, selectedGroupId, filters.groupId, hasAppliedFilter]);

  const filteredSchedule = useMemo(() => {
    let filtered = [...schedule];
    if (filters.teacherId) filtered = filtered.filter(s => s.teacher_id === parseInt(filters.teacherId));
    if (filters.subjectId) filtered = filtered.filter(s => s.subject_id === parseInt(filters.subjectId));
    if (filters.dayOfWeek) filtered = filtered.filter(s => s.day_of_week === parseInt(filters.dayOfWeek));
    if (filters.pairNumber) filtered = filtered.filter(s => s.pair_number === parseInt(filters.pairNumber));
    if (filters.classroomId) filtered = filtered.filter(s => s.classroom_id === parseInt(filters.classroomId));
    return filtered;
  }, [schedule, filters, isLoadingLocal]);

  const handleFilterChange = (key, value) => {
    if (key === 'groupId') setSelectedGroupId(value);
    setFilters(prev => ({ ...prev, [key]: value }));
    setHasAppliedFilter(true);
  };

  const resetFilters = () => {
    if (isStudent && userGroupId) {
      setFilters({ groupId: String(userGroupId), teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' });
      setSelectedGroupId(userGroupId);
      setHasAppliedFilter(true);
    } else {
      setFilters({ groupId: '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' });
      setSelectedGroupId(null);
      setHasAppliedFilter(false);
    }
    setCurrentDate(new Date());
  };

  const handleDateSelect = (date) => { setCurrentDate(date); setShowCalendar(false); };

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Загрузка...</p></div>;

  return (
    <div className="schedule-container">
      <FilterSection filters={filters} onFilterChange={handleFilterChange} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms}
        onReset={resetFilters} onOpenCalendar={() => setShowCalendar(true)} currentDate={currentDate}
        onPrevWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
        onNextWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
        onCurrentWeek={() => setCurrentDate(new Date())}
        showGroupFilter={!isStudent} isStudent={isStudent} selectedGroupId={selectedGroupId} onGroupChange={setSelectedGroupId} isLoading={isLoadingLocal} />
      {showCalendar && createPortal(<div className="datepicker-overlay" onClick={() => setShowCalendar(false)}><DatePicker onDateSelect={handleDateSelect} onClose={() => setShowCalendar(false)} selectedDate={currentDate} /></div>, document.body)}
      {!hasAppliedFilter && !isStudent ? (
        <div className="filter-placeholder"><i className="fas fa-filter"></i><h3>Выберите параметры для просмотра расписания</h3><p>Используйте фильтры выше</p></div>
      ) : filteredSchedule.length === 0 && !isLoadingLocal ? (
        <div className="empty-state"><i className="fas fa-search"></i><p>Нет занятий</p></div>
      ) : (
        <ScheduleGrid data={filteredSchedule} canEdit={false} weekDates={weekDates} selectedDate={currentDate} isLoading={isLoadingLocal} />
      )}
    </div>
  );
};

// ---------- PublicScheduleView ----------
const PublicScheduleView = ({ schedule, groups, teachers, subjects, classrooms, loading, loadScheduleForWeek }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [filters, setFilters] = useState({ groupId: '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' });

  const loadFnRef = useRef(loadScheduleForWeek);
  useEffect(() => { loadFnRef.current = loadScheduleForWeek; }, [loadScheduleForWeek]);

  const debouncedLoadRef = useRef(null);
  if (!debouncedLoadRef.current) {
    debouncedLoadRef.current = debounce(async (start, end, groupId) => {
      setIsLoadingLocal(true);
      await loadFnRef.current(start, end, groupId);
      setIsLoadingLocal(false);
    }, 300);
  }

  const weekDates = getWeekDates(currentDate);

  useEffect(() => {
    if (weekDates.length > 0 && hasAppliedFilter) {
      const startDate = formatForInput(weekDates[0]);
      const endDate = formatForInput(weekDates[6]);
      const groupId = selectedGroupId || filters.groupId;
      debouncedLoadRef.current(startDate, endDate, groupId);
    }
  }, [weekDates, selectedGroupId, filters.groupId, hasAppliedFilter]);

  const filteredSchedule = useMemo(() => {
    let filtered = [...schedule];
    if (filters.teacherId) filtered = filtered.filter(s => s.teacher_id === parseInt(filters.teacherId));
    if (filters.subjectId) filtered = filtered.filter(s => s.subject_id === parseInt(filters.subjectId));
    if (filters.dayOfWeek) filtered = filtered.filter(s => s.day_of_week === parseInt(filters.dayOfWeek));
    if (filters.pairNumber) filtered = filtered.filter(s => s.pair_number === parseInt(filters.pairNumber));
    if (filters.classroomId) filtered = filtered.filter(s => s.classroom_id === parseInt(filters.classroomId));
    return filtered;
  }, [schedule, filters, isLoadingLocal]);

  const handleFilterChange = (key, value) => {
    if (key === 'groupId') setSelectedGroupId(value);
    setFilters(prev => ({ ...prev, [key]: value }));
    setHasAppliedFilter(true);
  };

  const resetFilters = () => {
    setFilters({ groupId: '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' });
    setSelectedGroupId(null);
    setHasAppliedFilter(false);
    setCurrentDate(new Date());
  };

  const handleDateSelect = (date) => { setCurrentDate(date); setShowCalendar(false); };

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Загрузка...</p></div>;

  return (
    <div className="public-schedule-container">
      <FilterSection filters={filters} onFilterChange={handleFilterChange} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms}
        onReset={resetFilters} onOpenCalendar={() => setShowCalendar(true)} currentDate={currentDate}
        onPrevWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
        onNextWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
        onCurrentWeek={() => setCurrentDate(new Date())}
        showGroupFilter={true} isStudent={false} selectedGroupId={selectedGroupId} onGroupChange={setSelectedGroupId} isLoading={isLoadingLocal} />
      {showCalendar && createPortal(<div className="datepicker-overlay" onClick={() => setShowCalendar(false)}><DatePicker onDateSelect={handleDateSelect} onClose={() => setShowCalendar(false)} selectedDate={currentDate} /></div>, document.body)}
      {!hasAppliedFilter ? (
        <div className="filter-placeholder"><i className="fas fa-filter"></i><h3>Выберите параметры</h3></div>
      ) : filteredSchedule.length === 0 && !isLoadingLocal ? (
        <div className="empty-state"><i className="fas fa-search"></i><p>Нет занятий</p></div>
      ) : (
        <ScheduleGrid data={filteredSchedule} canEdit={false} weekDates={weekDates} selectedDate={currentDate} isLoading={isLoadingLocal} />
      )}
    </div>
  );
};

// ---------- TeacherPanel ----------
const TeacherPanel = ({ data, localData, hasChanges, saving, onNotesChange, onSave, onCancel, currentDate, onPrevWeek, onNextWeek, onCurrentWeek }) => {
  const weekDates = getWeekDates(currentDate || new Date());
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

  return (
    <div className="schedule-grid-wrapper">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', flexWrap: 'wrap', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onPrevWeek} className="week-nav-btn" style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
          <i className="fas fa-chevron-left"></i> Пред.
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', borderRadius: '2rem', color: 'white', fontWeight: 500 }}>
          <i className="fas fa-calendar-week"></i>
          <span>{formatDate(weekDates[0])} - {formatDate(weekDates[6])}</span>
          <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>({getWeekNumber(weekDates[0])} нед.)</span>
        </span>
        <button onClick={onNextWeek} className="week-nav-btn" style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
          След. <i className="fas fa-chevron-right"></i>
        </button>
        <button onClick={onCurrentWeek} className="week-today-btn" style={{ padding: '0.5rem 1rem', borderRadius: '2rem', background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer' }}>
          <i className="fas fa-calendar-day"></i> Сегодня
        </button>
      </div>
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header"><div className="time-header-content"><i className="fas fa-clock"></i><span>Время</span></div></th>
            {DAYS.map((day, idx) => {
              const date = weekDates[idx];
              const isToday = date && date.toDateString() === new Date().toDateString();
              const isWeekend = idx === 5 || idx === 6;
              return (
                <th key={day} className={`day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
                  <div className="day-header-content"><span className="day-name">{day}</span><span className="day-date">{date ? formatDate(date) : ''}</span></div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot"><div className="time-slot-card"><span className="pair-number">{pair.name}</span><span className="pair-time">{pair.time}</span></div></td>
              {DAYS.map((_, dayIndex) => {
                const lessons = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLessons = lessons.length > 0;
                const date = weekDates[dayIndex];
                const isToday = date && date.toDateString() === new Date().toDateString();
                const isWeekend = dayIndex === 5 || dayIndex === 6;
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'} ${isToday ? 'today-column' : ''} ${isWeekend ? 'weekend-column' : ''}`}>
                    {hasLessons ? (
                      <div className="teacher-lessons-container">
                        {lessons.map((lesson, idx) => {
                          const currentData = localData[lesson.id] || { notes: lesson.notes || '' };
                          const isChanged = hasChanges[lesson.id] || false;
                          const isSaving = saving[lesson.id] || false;
                          return (
                            <div key={lesson.id || idx} className="teacher-lesson-card">
                              <div className="lesson-header">
                                <h4 className="lesson-title">{lesson.subject_name}</h4>
                                <div className="lesson-badges">
                                  <span className="lesson-group-tag">{lesson.group_name}</span>
                                  {isChanged && <span className="unsaved-badge"><i className="fas fa-circle"></i> Не сохранено</span>}
                                </div>
                              </div>
                              <div className="lesson-body">
                                <div className="lesson-info"><i className="fas fa-door-open"></i><span>{lesson.classroom_name || '—'}</span></div>
                                {lesson.date && <div className="lesson-info"><i className="fas fa-calendar-alt"></i><span>{formatDateRu(lesson.date)}</span></div>}
                                <textarea placeholder="Заметки..." value={currentData.notes || ''} onChange={(e) => onNotesChange(lesson.id, e.target.value)} rows="2" disabled={isSaving} className="teacher-notes-textarea" />
                                {isChanged && (
                                  <div className="teacher-actions-modern">
                                    <button onClick={() => onCancel(lesson.id)} disabled={isSaving} className="teacher-action-btn cancel"><i className="fas fa-times"></i> Отмена</button>
                                    <button onClick={() => onSave(lesson)} disabled={isSaving} className="teacher-action-btn save">{isSaving ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-check"></i>} Сохранить</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <div className="empty-cell"></div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------- TeacherReportModal ----------
const TeacherReportModal = ({ teachers, schedule, onClose, onGenerate }) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [generating, setGenerating] = useState(false);
  const teacherOptions = teachers?.map(t => ({ value: String(t.id), label: t.name })) || [];

  const handleGenerate = async () => {
    if (!selectedTeacherId) { alert('Выберите преподавателя'); return; }
    setGenerating(true);
    await onGenerate(selectedTeacherId);
    setGenerating(false);
    onClose();
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2><i className="fas fa-chart-line"></i> Отчет по часам</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-form">
          <div className="form-group"><SearchableSelect options={teacherOptions} value={selectedTeacherId} onChange={setSelectedTeacherId} placeholder="Выберите преподавателя" label="Преподаватель" icon="fas fa-chalkboard-teacher" /></div>
          <button className="submit-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-download"></i>} {generating ? ' Формирование...' : ' Сформировать отчет'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- HomeContent ----------
function HomeContent() {
  const { theme, toggleTheme } = useTheme();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [showTeacherReportModal, setShowTeacherReportModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', password: '', fullName: '', role: 'student', groupId: '' });
  const [editingLesson, setEditingLesson] = useState(null);
  const [newGroup, setNewGroup] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newClassroom, setNewClassroom] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [manageCurrentDate, setManageCurrentDate] = useState(new Date());
  const [teacherCurrentDate, setTeacherCurrentDate] = useState(new Date());
  const [localData, setLocalData] = useState({});
  const [hasChanges, setHasChanges] = useState({});
  const [saving, setSaving] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const showNotification = (msg, type = 'success') => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };
  const canEditSchedule = user && (user.role === 'admin' || user.role === 'methodist');
  const canManageUsers = user && user.role === 'admin';
  const isTeacher = user && user.role === 'teacher';

  // ---------- Загрузка данных ----------
  const loadScheduleForWeek = useCallback(async (weekStart, weekEnd, groupId = null, forceReload = false) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    let start = weekStart, end = weekEnd;
    if (weekStart instanceof Date) start = formatForInput(weekStart);
    if (weekEnd instanceof Date) end = formatForInput(weekEnd);
    const effectiveGroupId = groupId ?? selectedGroupFilter;
    const cacheKey = `${start}|${end}|${effectiveGroupId || ''}`;
    if (forceReload) scheduleCache.delete(cacheKey);
    const cached = scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000 && !forceReload) { setSchedule(cached.data); return cached.data; }
    let url = `/api/schedule?weekStart=${start}`;
    if (effectiveGroupId) url += `&groupId=${effectiveGroupId}`;
    try {
      const scheduleRes = await fetch(url, { headers });
      const scheduleData = await scheduleRes.json();
      scheduleCache.set(cacheKey, { data: scheduleData, timestamp: Date.now() });
      setSchedule(scheduleData);
      return scheduleData;
    } catch (e) { showNotification('Ошибка загрузки расписания', 'error'); return []; }
  }, [token, selectedGroupFilter]);

  const loadScheduleForWeekForManage = useCallback(async () => {
    const weekDates = getWeekDates(manageCurrentDate);
    await loadScheduleForWeek(formatForInput(weekDates[0]), formatForInput(weekDates[6]), selectedGroupFilter, true);
  }, [manageCurrentDate, selectedGroupFilter, loadScheduleForWeek]);

  const loadTeacherSchedule = useCallback(async (date) => {
    if (!token || !isTeacher) return;
    const teacher = teachers.find(t => t.user_id === user?.id);
    if (!teacher) return;
    const weekDates = getWeekDates(date || new Date());
    const url = `/api/schedule?weekStart=${formatForInput(weekDates[0])}&teacherId=${teacher.id}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch (e) { console.error('Ошибка загрузки расписания преподавателя:', e); }
  }, [token, isTeacher, teachers, user]);

  const loadData = useCallback(async () => {
    try {
      const [groupsRes, teachersRes, subjectsRes] = await Promise.all([fetch('/api/groups'), fetch('/api/teachers'), fetch('/api/subjects')]);
      setGroups(await groupsRes.json()); setTeachers(await teachersRes.json()); setSubjects(await subjectsRes.json());
      try { const cr = await fetch('/api/classrooms'); if (cr.ok) setClassrooms(await cr.json()); else setClassrooms([]); } catch (e) { setClassrooms([]); }
      const monday = getMonday(new Date());
      await loadScheduleForWeek(formatForInput(monday), null, selectedGroupFilter, true);
    } catch (e) { showNotification('Ошибка загрузки данных', 'error'); } finally { setLoading(false); }
  }, [loadScheduleForWeek, selectedGroupFilter]);

  const loadUsers = useCallback(async () => {
    if (!token || !canManageUsers) return;
    try { const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setUsers(await res.json()); } catch (e) {}
  }, [token, canManageUsers]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try { const res = await fetch('/api/schedule/template'); setTemplates(await res.json()); } catch (e) {} finally { setLoadingTemplates(false); }
  }, []);

  // ============ БЛОК ЭКСПОРТА ============

  // ---------- Улучшенный экспорт в Excel ----------
  const exportToExcel = useCallback(() => {
    let exportData = [];
    if (activeTab === 'my-lessons' && isTeacher) {
      const teacher = teachers.find(t => t.user_id === user?.id);
      exportData = teacher ? schedule.filter(l => l.teacher_id === teacher.id).map(lesson => ({
        'Дата': lesson.date ? formatDateRu(lesson.date) : '-',
        'День недели': DAYS[lesson.day_of_week - 1],
        'Пара': `${lesson.pair_number} (${PAIRS[lesson.pair_number - 1].time})`,
        'Группа': lesson.group_name,
        'Предмет': lesson.subject_name,
        'Аудитория': lesson.classroom_name || '—',
        'Статус': lesson.source === 'cancelled' ? 'Отменено' : lesson.source === 'modified' ? 'Изменено' : lesson.source === 'added' ? 'Добавлено' : 'По шаблону',
        'Заметки': lesson.notes || '—'
      })) : [];
    } else if (user && user.role === 'student' && user.groupId) {
      exportData = schedule.filter(s => s.group_id === user.groupId).map(lesson => ({
        'Дата': lesson.date ? formatDateRu(lesson.date) : '-',
        'День недели': DAYS[lesson.day_of_week - 1],
        'Время': PAIRS[lesson.pair_number - 1].time,
        'Пара': lesson.pair_number,
        'Предмет': lesson.subject_name,
        'Преподаватель': lesson.teacher_name,
        'Аудитория': lesson.classroom_name || '—',
        'Заметки': lesson.notes || '—'
      }));
    } else {
      exportData = schedule.map(lesson => ({
        'Дата': lesson.date ? formatDateRu(lesson.date) : '-',
        'День недели': DAYS[lesson.day_of_week - 1],
        'Время': PAIRS[lesson.pair_number - 1].time,
        'Пара': lesson.pair_number,
        'Группа': lesson.group_name,
        'Предмет': lesson.subject_name,
        'Преподаватель': lesson.teacher_name,
        'Аудитория': lesson.classroom_name || '—',
        'Статус': lesson.source === 'cancelled' ? 'Отменено' : lesson.source === 'modified' ? 'Изменено' : lesson.source === 'added' ? 'Добавлено' : 'По шаблону',
        'Заметки': lesson.notes || '—'
      }));
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
          fill: { fgColor: { rgb: "2c3e66" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: { top: { style: "thin", color: { rgb: "1e2a4a" } }, bottom: { style: "thin", color: { rgb: "1e2a4a" } }, left: { style: "thin", color: { rgb: "1e2a4a" } }, right: { style: "thin", color: { rgb: "1e2a4a" } } }
        };
      }
    }
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 10 },
            alignment: { horizontal: "left", vertical: "center", wrapText: true },
            border: { top: { style: "thin", color: { rgb: "e2e8f0" } }, bottom: { style: "thin", color: { rgb: "e2e8f0" } }, left: { style: "thin", color: { rgb: "e2e8f0" } }, right: { style: "thin", color: { rgb: "e2e8f0" } } }
          };
        }
      }
    }
    const colWidths = {};
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) { const value = String(ws[cellRef].v || ''); colWidths[col] = Math.max(colWidths[col] || 10, value.length + 4); }
      }
    }
    ws['!cols'] = Object.keys(colWidths).map(col => ({ wch: Math.min(colWidths[col], 40) }));
    XLSX.utils.book_append_sheet(wb, ws, "Расписание");
    XLSX.writeFile(wb, `Расписание_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('✅ Excel файл сохранен', 'success');
  }, [schedule, activeTab, isTeacher, teachers, user]);

  // ---------- Улучшенный экспорт в PDF ----------
  const exportToPDF = useCallback(async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      let exportData = [];
      let title = 'Расписание занятий';
      let subtitle = `Дата формирования: ${new Date().toLocaleString('ru-RU')}`;

      if (activeTab === 'my-lessons' && isTeacher) {
        const teacher = teachers.find(t => t.user_id === user?.id);
        title = 'Мои занятия';
        subtitle = `Преподаватель: ${teacher?.name || ''}`;
        exportData = teacher ? schedule.filter(l => l.teacher_id === teacher.id) : [];
      } else if (user && user.role === 'student' && user.groupId) {
        const group = groups.find(g => g.id === user.groupId);
        title = 'Расписание занятий';
        subtitle = `Группа: ${group?.name || ''}`;
        exportData = schedule.filter(s => s.group_id === user.groupId);
      } else { exportData = schedule; }

      const grouped = {};
      exportData.forEach(lesson => { const dk = lesson.date || 'Без даты'; if (!grouped[dk]) grouped[dk] = []; grouped[dk].push(lesson); });
      const sortedDates = Object.keys(grouped).sort();
      const totalLessons = exportData.length;
      const totalHours = (totalLessons * 1.5).toFixed(1);
      const cancelledCount = exportData.filter(l => l.source === 'cancelled').length;
      const modifiedCount = exportData.filter(l => l.source === 'modified').length;
      const addedCount = exportData.filter(l => l.source === 'added').length;

      const element = document.createElement('div');
      element.innerHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:30px 25px;color:#1e293b;background:#fff}
        .header{background:linear-gradient(135deg,#2c3e66 0%,#1e2a4a 100%);color:white;padding:25px 30px;border-radius:12px;margin-bottom:25px;box-shadow:0 4px 15px rgba(44,62,102,0.2)}
        .header h1{font-size:26px;margin-bottom:8px;font-weight:700;letter-spacing:-0.5px}
        .header .subtitle{font-size:14px;opacity:0.9;font-weight:400}
        .stats-bar{display:flex;gap:15px;margin-bottom:25px;flex-wrap:wrap}
        .stat-card{flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:15px;text-align:center}
        .stat-card .stat-value{font-size:28px;font-weight:700;color:#2c3e66}
        .stat-card .stat-label{font-size:11px;color:#64748b;text-transform:uppercase;margin-top:4px;letter-spacing:0.5px}
        .stat-card.warning .stat-value{color:#c4a35a}.stat-card.success .stat-value{color:#2c5f2d}.stat-card.danger .stat-value{color:#c1666b}
        .date-section{margin-bottom:25px;page-break-inside:avoid}
        .date-title{font-size:16px;font-weight:700;color:#2c3e66;padding:10px 15px;background:#f1f5f9;border-radius:8px;margin-bottom:10px;border-left:4px solid #2c3e66}
        .date-title .day-name{font-weight:400;color:#64748b;margin-left:8px}
        table{width:100%;border-collapse:collapse;margin-bottom:15px;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border-radius:8px;overflow:hidden}
        thead{background:linear-gradient(135deg,#2c3e66 0%,#1e2a4a 100%);color:white}
        th{padding:10px 8px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap}
        td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
        tr:nth-child(even) td{background:#f8fafc}tr:hover td{background:#e8f0fe}
        .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:600;white-space:nowrap}
        .badge-cancelled{background:#fee2e2;color:#991b1b}.badge-modified{background:#fef3c7;color:#92400e}.badge-added{background:#dcfce7;color:#166534}.badge-template{background:#e0e7ff;color:#3730a3}
        .notes-cell{max-width:150px;font-size:9px;color:#64748b;font-style:italic}
        .footer{margin-top:30px;padding-top:15px;border-top:2px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}
        .total-row td{font-weight:700;background:#f1f5f9!important;border-top:2px solid #2c3e66}
      </style></head><body>
        <div class="header"><h1>📅 ${title}</h1><div class="subtitle">${subtitle}</div></div>
        <div class="stats-bar">
          <div class="stat-card"><div class="stat-value">${totalLessons}</div><div class="stat-label">Всего занятий</div></div>
          <div class="stat-card success"><div class="stat-value">${totalHours}</div><div class="stat-label">Академ. часов</div></div>
          ${cancelledCount > 0 ? `<div class="stat-card danger"><div class="stat-value">${cancelledCount}</div><div class="stat-label">Отменено</div></div>` : ''}
          ${modifiedCount > 0 ? `<div class="stat-card warning"><div class="stat-value">${modifiedCount}</div><div class="stat-label">Изменено</div></div>` : ''}
          ${addedCount > 0 ? `<div class="stat-card success"><div class="stat-value">${addedCount}</div><div class="stat-label">Добавлено</div></div>` : ''}
        </div>
        ${sortedDates.map(dateKey => {
          const lessons = grouped[dateKey];
          const date = parseLocalDate(dateKey);
          const dayName = date ? DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1] : '';
          return `<div class="date-section"><div class="date-title">📌 ${dateKey !== 'Без даты' ? formatDateRu(dateKey) : dateKey}<span class="day-name">${dayName}</span><span style="float:right;font-weight:400;font-size:12px">${lessons.length} пар(ы)</span></div>
          <table><thead><tr><th>Пара</th><th>Время</th>${activeTab !== 'my-lessons' && user?.role !== 'student' ? '<th>Группа</th>' : ''}<th>Предмет</th><th>Преподаватель</th><th>Аудитория</th><th>Статус</th><th>Заметки</th></tr></thead><tbody>
          ${lessons.sort((a,b) => a.pair_number - b.pair_number).map(lesson => `<tr>
            <td><strong>${lesson.pair_number}</strong></td><td>${PAIRS[lesson.pair_number-1]?.time||''}</td>
            ${activeTab !== 'my-lessons' && user?.role !== 'student' ? `<td>${lesson.group_name}</td>` : ''}
            <td><strong>${lesson.subject_name}</strong></td><td>${lesson.teacher_name}</td><td>${lesson.classroom_name||'—'}</td>
            <td><span class="badge badge-${lesson.source||'template'}">${lesson.source==='cancelled'?'❌ Отменено':lesson.source==='modified'?'✏️ Изменено':lesson.source==='added'?'➕ Добавлено':'📋 Шаблон'}</span></td>
            <td class="notes-cell">${lesson.notes||'—'}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="${activeTab !== 'my-lessons' && user?.role !== 'student' ? '8' : '7'}"><strong>Итого за день:</strong> ${lessons.length} пар • ${(lessons.length*1.5).toFixed(1)} ак. часов</td></tr></tbody></table></div>`;
        }).join('')}
        <div class="footer"><p>📊 Отчет сгенерирован автоматически • Система управления расписанием колледжа</p><p>Дата формирования: ${new Date().toLocaleString('ru-RU')}</p><p>Всего в отчете: ${totalLessons} занятий • ${totalHours} академических часов</p></div>
      </body></html>`;

      await html2pdf().set({ margin: [0.3,0.3,0.3,0.3], filename: `Расписание_${new Date().toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, letterRendering: true, useCORS: true, logging: false }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }, pagebreak: { mode: ['avoid-all','css','legacy'] } }).from(element).save();
      showNotification('✅ PDF файл сохранен', 'success');
    } catch (error) { console.error('Ошибка экспорта PDF:', error); showNotification('Ошибка экспорта PDF', 'error'); }
  }, [schedule, activeTab, isTeacher, teachers, user, groups]);

  // ---------- Улучшенный отчёт по часам преподавателя ----------
  const generateTeacherReport = useCallback(async (teacherId) => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const teacher = teachers.find(t => t.id === parseInt(teacherId));
      if (!teacher) { showNotification('Преподаватель не найден', 'error'); return; }

      const teacherLessons = schedule.filter(l => l.teacher_id === teacher.id);
      const subjectsHours = {};
      teacherLessons.forEach(lesson => {
        const sn = lesson.subject_name;
        if (!subjectsHours[sn]) subjectsHours[sn] = { name: sn, hours: 0, lessons: [], groups: new Set() };
        subjectsHours[sn].hours += 1.5; subjectsHours[sn].lessons.push(lesson); subjectsHours[sn].groups.add(lesson.group_name);
      });
      const weeksMap = {};
      teacherLessons.forEach(lesson => {
        if (lesson.date) {
          const ws = formatForInput(getMonday(parseLocalDate(lesson.date)));
          if (!weeksMap[ws]) weeksMap[ws] = { lessons: [], subjects: new Set() };
          weeksMap[ws].lessons.push(lesson); weeksMap[ws].subjects.add(lesson.subject_name);
        }
      });
      const sortedWeeks = Object.keys(weeksMap).sort();
      const totalHours = (teacherLessons.length * 1.5).toFixed(1);
      const uniqueSubjects = Object.keys(subjectsHours).length;
      const uniqueGroups = new Set(teacherLessons.map(l => l.group_name)).size;
      const now = new Date();

      const element = document.createElement('div');
      element.innerHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:35px 30px;color:#1e293b;background:#fff}
        .report-header{background:linear-gradient(135deg,#2c3e66 0%,#1e2a4a 100%);color:white;padding:30px 35px;border-radius:16px;margin-bottom:30px;box-shadow:0 8px 25px rgba(44,62,102,0.25)}
        .report-header h1{font-size:28px;margin-bottom:6px;font-weight:700}
        .report-header .teacher-name{font-size:20px;opacity:0.95;margin-bottom:15px;font-weight:500}
        .report-header .report-meta{font-size:12px;opacity:0.8}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:15px;margin-bottom:30px}
        .summary-card{background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center}
        .summary-card .card-value{font-size:32px;font-weight:700;color:#2c3e66;margin-bottom:5px}
        .summary-card .card-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600}
        .summary-card.accent{border-color:#4a6fa5}.summary-card.accent .card-value{color:#4a6fa5}
        .summary-card.success{border-color:#2c5f2d}.summary-card.success .card-value{color:#2c5f2d}
        .section-title{font-size:18px;font-weight:700;color:#2c3e66;margin-bottom:15px;padding-bottom:10px;border-bottom:3px solid #2c3e66;display:flex;align-items:center;gap:10px}
        table{width:100%;border-collapse:collapse;margin-bottom:25px;font-size:11px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-radius:10px;overflow:hidden}
        thead{background:linear-gradient(135deg,#2c3e66 0%,#1e2a4a 100%);color:white}
        th{padding:12px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
        td{padding:10px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafc}
        .total-row td{font-weight:700;background:#e2e8f0!important;border-top:2px solid #2c3e66}
        .week-section{margin-bottom:20px;page-break-inside:avoid}
        .week-title{font-weight:700;color:#2c3e66;padding:8px 12px;background:#f1f5f9;border-radius:6px;margin-bottom:8px;font-size:13px}
        .footer{margin-top:30px;padding-top:20px;border-top:2px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}
      </style></head><body>
        <div class="report-header"><h1>📊 Отчет о нагрузке преподавателя</h1><div class="teacher-name">👨‍🏫 ${teacher.name}</div><div class="report-meta">Период: ${sortedWeeks.length > 0 ? formatDateRu(sortedWeeks[0]) + ' — ' + formatDateRu(sortedWeeks[sortedWeeks.length-1]) : 'Нет данных'} • Сформирован: ${now.toLocaleString('ru-RU')}</div></div>
        <div class="summary-grid">
          <div class="summary-card accent"><div class="card-value">${totalHours}</div><div class="card-label">Всего часов</div></div>
          <div class="summary-card"><div class="card-value">${teacherLessons.length}</div><div class="card-label">Всего занятий</div></div>
          <div class="summary-card success"><div class="card-value">${uniqueSubjects}</div><div class="card-label">Предметов</div></div>
          <div class="summary-card"><div class="card-value">${uniqueGroups}</div><div class="card-label">Групп</div></div>
          <div class="summary-card"><div class="card-value">${sortedWeeks.length}</div><div class="card-label">Недель</div></div>
        </div>
        <h2 class="section-title">📚 Сводка по предметам</h2>
        <table><thead><tr><th>№</th><th>Предмет</th><th>Кол-во занятий</th><th>Часов</th><th>Группы</th></tr></thead><tbody>
        ${Object.values(subjectsHours).sort((a,b)=>b.hours-a.hours).map((item,idx)=>`<tr><td>${idx+1}</td><td><strong>${item.name}</strong></td><td>${item.lessons.length} пар(ы)</td><td><strong>${item.hours.toFixed(1)} ч.</strong></td><td>${[...item.groups].join(', ')}</td></tr>`).join('')}
        <tr class="total-row"><td colspan="2"><strong>ИТОГО</strong></td><td><strong>${teacherLessons.length} пар</strong></td><td colspan="2"><strong>${totalHours} академических часов</strong></td></tr></tbody></table>
        <h2 class="section-title">📅 Детализация по неделям</h2>
        ${sortedWeeks.map(ws=>{const wd=weeksMap[ws];const we=new Date(parseLocalDate(ws));we.setDate(we.getDate()+6);const wn=getWeekNumber(parseLocalDate(ws));return`<div class="week-section"><div class="week-title">📌 Неделя ${wn} • ${formatDateRu(ws)} — ${formatDateRu(formatForInput(we))}<span style="float:right;font-weight:400">${wd.lessons.length} пар • ${(wd.lessons.length*1.5).toFixed(1)} ч.</span></div><table><thead><tr><th>Дата</th><th>День</th><th>Пара</th><th>Предмет</th><th>Группа</th><th>Аудитория</th></tr></thead><tbody>${wd.lessons.sort((a,b)=>{if(a.date<b.date)return-1;if(a.date>b.date)return 1;return a.pair_number-b.pair_number}).map(l=>`<tr><td>${l.date?formatDateRu(l.date):'—'}</td><td>${DAYS[l.day_of_week-1]}</td><td><strong>${l.pair_number}</strong> (${PAIRS[l.pair_number-1]?.time||''})</td><td>${l.subject_name}</td><td>${l.group_name}</td><td>${l.classroom_name||'—'}</td></tr>`).join('')}</tbody></table></div>`}).join('')}
        <div class="footer"><p>📊 Отчет сгенерирован автоматически • Система управления расписанием колледжа</p><p>Дата формирования: ${now.toLocaleString('ru-RU')} • Всего в отчете: ${teacherLessons.length} занятий • ${totalHours} часов</p></div>
      </body></html>`;

      await html2pdf().set({ margin: [0.4,0.4,0.4,0.4], filename: `Отчет_по_часам_${teacher.name.replace(/\s+/g,'_')}_${now.toISOString().split('T')[0]}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, letterRendering: true, useCORS: true, logging: false }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all','css','legacy'] } }).from(element).save();
      showNotification(`✅ Отчет по преподавателю "${teacher.name}" успешно сформирован`, 'success');
    } catch (error) { console.error('Ошибка формирования отчета:', error); showNotification('❌ Ошибка формирования отчета', 'error'); }
  }, [teachers, schedule]);

  const exportTeacherHoursReport = useCallback(async () => {
    if (!user || user.role !== 'teacher') return;
    const teacher = teachers.find(t => t.user_id === user.id);
    if (!teacher) { showNotification('Преподаватель не найден', 'error'); return; }
    await generateTeacherReport(teacher.id);
  }, [user, teachers, generateTeacherReport]);

  // ============ КОНЕЦ БЛОКА ЭКСПОРТА ============

  // ---------- Аутентификация ----------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginData) });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token); setUser(data.user);
        localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
        setShowLogin(false); showNotification(`Добро пожаловать, ${data.user.fullName}!`);
        await loadData(); if (data.user.role === 'admin') await loadUsers();
        if (data.user.role === 'teacher') setActiveTab('my-lessons'); else setActiveTab('schedule');
      } else { showNotification(data.error, 'error'); }
    } catch (e) { showNotification('Ошибка входа', 'error'); }
  };

  const handleLogout = () => {
    setToken(null); setUser(null); localStorage.clear(); scheduleCache.clear();
    showNotification('Вы вышли из системы', 'info'); setSchedule([]); setSelectedGroupFilter(''); setActiveTab('schedule');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(registerData) });
      const data = await res.json();
      if (res.ok) { showNotification('Пользователь создан', 'success'); setShowRegister(false); setRegisterData({ username: '', password: '', fullName: '', role: 'student', groupId: '' }); loadUsers(); }
      else { showNotification(data.error, 'error'); }
    } catch (e) { showNotification('Ошибка регистрации', 'error'); }
  };

  // ---------- Справочники ----------
  const addDirectory = async (type, name, setShow, setValue) => {
    if (!name.trim()) return showNotification('Введите название', 'error');
    try {
      const res = await fetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: name.trim() }) });
      if (res.ok) { showNotification('Добавлено', 'success'); setShow(false); setValue(''); loadData(); }
      else { const error = await res.json(); showNotification(error.error, 'error'); }
    } catch (e) { showNotification('Ошибка', 'error'); }
  };

  const deleteDirectory = async (type, id) => {
    if (!confirm('Удалить?')) return;
    try { await fetch(`/api/${type}?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); showNotification('Удалено', 'success'); loadData(); } catch (e) {}
  };

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    if (!newClassroom.trim()) return showNotification('Введите номер', 'error');
    try {
      const res = await fetch('/api/classrooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newClassroom.trim() }) });
      if (res.ok) { showNotification('Аудитория добавлена', 'success'); setShowClassroomModal(false); setNewClassroom(''); loadData(); }
      else { const error = await res.json(); showNotification(error.error, 'error'); }
    } catch (e) { showNotification('Ошибка', 'error'); }
  };

  const handleDeleteClassroom = async (id) => {
    if (!confirm('Удалить аудиторию?')) return;
    try { await fetch(`/api/classrooms?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); showNotification('Удалено', 'success'); loadData(); } catch (e) {}
  };

  // ---------- Управление расписанием ----------
  const handleAddScheduleClick = useCallback((slotData) => {
    let dateValue = '';
    if (slotData.date) { const parsed = parseLocalDate(slotData.date); if (parsed) dateValue = formatForInput(parsed); }
    setEditingLesson({ id: null, group_id: selectedGroupFilter || '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: String(slotData.pair_number), day_of_week: String(slotData.day_of_week), date: dateValue, apply_all: false });
    setShowEditModal(true);
  }, [selectedGroupFilter]);

  const handleEditClick = (lesson) => {
    setEditingLesson({ ...lesson, date: lesson.date || '', apply_all: lesson.source === 'template', template_id: lesson.template_id || null, override_id: lesson.override_id || null });
    setShowEditModal(true);
  };

  const handleDeleteClick = (lesson) => {
    if (!canEditSchedule) { showNotification('Нет прав', 'error'); return; }
    const hasOverride = lesson.override_id && lesson.source !== 'template';
    let message = hasOverride ? 'Удалить изменение для этой недели?' : (lesson.template_id ? 'ОК — отменить на неделю, Отмена — удалить шаблон' : 'Удалить?');
    const choice = confirm(message);
    handleDeleteSlot(lesson, hasOverride ? false : !choice);
  };

  const handleDeleteSlot = async (lesson, applyAll) => {
    const monday = getMonday(parseLocalDate(lesson.date));
    const body = { group_id: lesson.group_id, pair_number: lesson.pair_number, day_of_week: lesson.day_of_week, week_start_date: formatForInput(monday), apply_all: applyAll, template_id: lesson.template_id || null, override_id: lesson.override_id || null };
    const res = await fetch('/api/schedule/lesson', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { scheduleCache.clear(); showNotification(applyAll ? 'Удалено из шаблона' : 'Отменено'); if (activeTab === 'manage-schedule') loadScheduleForWeekForManage(); else loadData(); if (activeTab === 'template') loadTemplates(); }
    else { const d = await res.json(); showNotification(d.error, 'error'); }
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (!canEditSchedule) return showNotification('Нет прав', 'error');
    if (!editingLesson.apply_all && !editingLesson.date) return showNotification('Выберите дату', 'error');
    let ws = null;
    if (!editingLesson.apply_all) { const d = parseLocalDate(editingLesson.date); if (!d) return; ws = formatForInput(getMonday(d)); }
    const body = { group_id: parseInt(editingLesson.group_id), teacher_id: parseInt(editingLesson.teacher_id), subject_id: parseInt(editingLesson.subject_id), classroom_id: editingLesson.classroom_id ? parseInt(editingLesson.classroom_id) : null, pair_number: parseInt(editingLesson.pair_number), day_of_week: parseInt(editingLesson.day_of_week), week_start_date: ws, apply_all: !!editingLesson.apply_all, template_id: editingLesson.template_id || null, override_id: editingLesson.override_id || null };
    const res = await fetch('/api/schedule/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { scheduleCache.clear(); showNotification(editingLesson.apply_all ? 'Шаблон обновлён' : 'Сохранено'); setShowEdit(false); setEditingLesson(null); if (activeTab === 'manage-schedule') loadScheduleForWeekForManage(); else loadData(); if (activeTab === 'template') loadTemplates(); }
    else if (res.status === 409) { showNotification(data.error, 'error'); alert(data.error); }
    else showNotification(data.error || 'Ошибка', 'error');
  };

  // ---------- Заметки ----------
  const handleNotesChange = (id, val) => { setLocalData(p => ({ ...p, [id]: { notes: val } })); setHasChanges(p => ({ ...p, [id]: true })); };
  const handleSaveNotesForLesson = async (lesson) => {
    const ws = formatForInput(getMonday(parseLocalDate(lesson.date)));
    const res = await fetch('/api/schedule/teacher-notes', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ week_start_date: ws, group_id: lesson.group_id, day_of_week: lesson.day_of_week, pair_number: lesson.pair_number, notes: localData[lesson.id]?.notes || '' }) });
    if (res.ok) { showNotification('Сохранено'); setHasChanges(p => { const n = { ...p }; delete n[lesson.id]; return n; }); loadData(); }
    else showNotification('Ошибка', 'error');
  };

  // ---------- Эффекты ----------
  useEffect(() => {
    const t = localStorage.getItem('token'), u = localStorage.getItem('user');
    if (t && u) { setToken(t); const ud = JSON.parse(u); setUser(ud); if (ud.role === 'teacher') setActiveTab('my-lessons'); }
    setAuthChecking(false);
  }, []);
  useEffect(() => { if (!authChecking) loadData(); }, [authChecking]);
  useEffect(() => { if (token && canManageUsers) loadUsers(); }, [token, canManageUsers]);
  useEffect(() => { if (activeTab === 'manage-schedule' && token) loadScheduleForWeekForManage(); }, [activeTab, token]);
  useEffect(() => { if (activeTab === 'template' && canEditSchedule) loadTemplates(); }, [activeTab, canEditSchedule]);
  useEffect(() => { if (isTeacher && teachers.length && user) loadTeacherSchedule(teacherCurrentDate); }, [isTeacher, teachers, user, teacherCurrentDate]);
  useEffect(() => {
    if (isTeacher && schedule.length && user) {
      const t = teachers.find(tt => tt.user_id === user.id);
      if (t) { const init = {}; schedule.filter(l => l.teacher_id === t.id).forEach(l => { init[l.id] = { notes: l.notes || '' }; }); setLocalData(init); }
    }
  }, [schedule, isTeacher, teachers, user]);

  // ---------- Рендер ----------
  const renderMainContent = () => {
    if (isTeacher) {
      const t = teachers.find(tt => tt.user_id === user?.id);
      const lessons = t ? schedule.filter(l => l.teacher_id === t.id) : [];
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-chalkboard-teacher"></i> Мои занятия</h2>
            <div className="header-actions">
              {Object.keys(hasChanges).length > 0 && <button className="action-button save-all" onClick={() => Object.keys(hasChanges).forEach(id => { const l = lessons.find(ls => ls.id === parseInt(id)); if (l) handleSaveNotesForLesson(l); })}><i className="fas fa-save"></i> Сохранить всё</button>}
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
              <button className="action-button report-hours" onClick={exportTeacherHoursReport}><i className="fas fa-chart-line"></i> Отчёт по часам</button>
            </div>
          </div>
          {loading ? <div className="loading-state"><div className="spinner"></div></div> :
            <TeacherPanel data={lessons} localData={localData} hasChanges={hasChanges} saving={saving} onNotesChange={handleNotesChange} onSave={handleSaveNotesForLesson}
              onCancel={id => { const l = lessons.find(ls => ls.id === id); if (l) { setLocalData(p => ({ ...p, [id]: { notes: l.notes || '' } })); setHasChanges(p => { const n = { ...p }; delete n[id]; return n; }); } }}
              currentDate={teacherCurrentDate} onPrevWeek={() => { const d = new Date(teacherCurrentDate); d.setDate(d.getDate() - 7); setTeacherCurrentDate(d); }}
              onNextWeek={() => { const d = new Date(teacherCurrentDate); d.setDate(d.getDate() + 7); setTeacherCurrentDate(d); }}
              onCurrentWeek={() => setTeacherCurrentDate(new Date())} />}
        </div>
      );
    }
    if (activeTab === 'schedule') {
      let ds = schedule;
      if (user?.role === 'student' && user.groupId) ds = schedule.filter(s => s.group_id === user.groupId);
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-calendar-alt"></i> Расписание</h2>
            <div className="header-actions">
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
              {user?.role === 'admin' && <button className="action-button report-hours" onClick={() => setShowTeacherReportModal(true)}><i className="fas fa-chart-line"></i> Отчёт по часам</button>}
            </div>
          </div>
          <ScheduleView schedule={ds} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms} loading={loading} userRole={user?.role} userGroupId={user?.groupId} loadScheduleForWeek={loadScheduleForWeek} />
        </div>
      );
    }
    if (activeTab === 'manage-schedule' && canEditSchedule) {
      const wd = getWeekDates(manageCurrentDate);
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-edit"></i> Управление</h2>
            <div className="header-actions">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { const d = new Date(manageCurrentDate); d.setDate(d.getDate() - 7); setManageCurrentDate(d); }}><i className="fas fa-chevron-left"></i></button>
                <span style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '2rem' }}>{formatDate(wd[0])} - {formatDate(wd[6])} ({getWeekNumber(wd[0])} нед.)</span>
                <button onClick={() => { const d = new Date(manageCurrentDate); d.setDate(d.getDate() + 7); setManageCurrentDate(d); }}><i className="fas fa-chevron-right"></i></button>
                <button onClick={() => setManageCurrentDate(new Date())}>Сегодня</button>
              </div>
              <select value={selectedGroupFilter} onChange={e => setSelectedGroupFilter(e.target.value)}><option value="">Все группы</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
            </div>
          </div>
          <ScheduleGrid data={schedule} canEdit={true} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onAddClick={handleAddScheduleClick} weekDates={wd} />
        </div>
      );
    }
    if (activeTab === 'template' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-layer-group"></i> Шаблон</h2>
            <button className="action-button primary" onClick={() => { setEditingLesson({ id: null, group_id: '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: '1', day_of_week: '1', date: '', apply_all: true, template_id: null, override_id: null }); setShowEditModal(true); }}><i className="fas fa-plus"></i> Добавить</button>
          </div>
          {loadingTemplates ? <div className="loading-state"><div className="spinner"></div></div> :
            <div className="directories-grid"><div className="directory-card"><div className="directory-header"><h3>Занятия</h3></div>
              {templates.map(t => <div key={t.id} className="directory-item"><span>{DAYS[t.day_of_week - 1]} {t.pair_number} пара – {t.subject_name} ({t.group_name})</span><button onClick={async () => { if (confirm('Удалить?')) { await fetch(`/api/schedule/template?id=${t.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); loadTemplates(); } }}><i className="fas fa-trash-alt"></i></button></div>)}
            </div></div>}
        </div>
      );
    }
    if (activeTab === 'directories' && canEditSchedule) {
      return (
        <div className="content-card"><div className="content-header"><h2><i className="fas fa-database"></i> Справочники</h2></div>
          <div className="directories-grid">
            {[{ icon: 'fa-users', title: 'Группы', data: groups, show: setShowGroupModal, newVal: newGroup, setNew: setNewGroup, type: 'groups' },
              { icon: 'fa-chalkboard-teacher', title: 'Преподаватели', data: teachers, show: setShowTeacherModal, newVal: newTeacher, setNew: setNewTeacher, type: 'teachers' },
              { icon: 'fa-book', title: 'Предметы', data: subjects, show: setShowSubjectModal, newVal: newSubject, setNew: setNewSubject, type: 'subjects' },
              { icon: 'fa-door-open', title: 'Аудитории', data: classrooms, show: setShowClassroomModal, newVal: newClassroom, setNew: setNewClassroom, type: 'classrooms' }
            ].map(card => (
              <div key={card.type} className="directory-card">
                <div className="directory-header"><i className={`fas ${card.icon}`}></i><h3>{card.title}</h3><button className="add-dir-btn" onClick={() => card.show(true)}><i className="fas fa-plus"></i></button></div>
                <div className="directory-list">{card.data.map(item => <div key={item.id} className="directory-item"><span>{item.name}</span><button onClick={() => deleteDirectory(card.type, item.id)}><i className="fas fa-trash-alt"></i></button></div>)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (activeTab === 'users' && canManageUsers) {
      return (
        <div className="content-card">
          <div className="content-header"><h2><i className="fas fa-users-cog"></i> Пользователи</h2><button className="action-button primary" onClick={() => setShowRegister(true)}><i className="fas fa-user-plus"></i> Создать</button></div>
          <div className="users-section"><h3>Список</h3>{users.map(u => <div key={u.id} className="user-card"><div className="user-avatar"><i className={`fas ${u.role === 'admin' ? 'fa-crown' : u.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div><div><strong>{u.full_name}</strong><br/>@{u.username} • {ROLES[u.role]}</div>{u.id !== user?.id && <button onClick={async () => { if (confirm('Удалить?')) { await fetch(`/api/users?id=${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); loadUsers(); } }} className="delete-user-btn"><i className="fas fa-trash-alt"></i></button>}</div>)}</div>
          <div className="teachers-link-section"><h3>Привязка</h3>{teachers.map(t => { const lu = users.find(u => u.id === t.user_id); return <div key={t.id} className="teacher-link-card"><span>{t.name}</span>{lu ? <span className="linked-badge">Привязан: {lu.full_name}</span> : <span className="unlinked-badge">Не привязан</span>}{lu ? <button onClick={async () => { await fetch(`/api/teachers/link?teacherId=${t.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); loadUsers(); loadData(); }} className="unlink-button">Отвязать</button> : <SearchableSelect options={users.filter(u => u.role === 'teacher' && !teachers.some(tt => tt.user_id === u.id)).map(u => ({ value: String(u.id), label: u.full_name }))} value="" onChange={async (v) => { await fetch('/api/teachers/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ teacherId: t.id, userId: parseInt(v) }) }); loadUsers(); loadData(); }} placeholder="Выбрать" />}</div>; })}</div>
        </div>
      );
    }
    return null;
  };

  if (authChecking) return <div className="loading-screen"><div className="spinner-large"></div><p>Загрузка системы...</p></div>;

  if (!user) {
    return (
      <>
        {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
        <div className="landing-page">
          <div className="landing-content">
            <div className="landing-hero"><h1>Расписание колледжа</h1><p>Система управления расписанием</p>
              <button className="btn-primary" onClick={() => setShowLogin(true)}>Войти</button>
              <button className="btn-secondary" onClick={toggleTheme}>{theme === 'light' ? '🌙' : '☀️'} Тема</button>
            </div>
            <PublicScheduleView schedule={schedule} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms} loading={loading} loadScheduleForWeek={loadScheduleForWeek} />
          </div>
        </div>
        {showLogin && createPortal(<div className="modal" onClick={() => setShowLogin(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Вход</h2><button onClick={() => setShowLogin(false)}><i className="fas fa-times"></i></button></div><form onSubmit={handleLogin} className="modal-form"><div className="form-group"><label>Логин</label><input value={loginData.username} onChange={e => setLoginData(p => ({ ...p, username: e.target.value }))} /></div><div className="form-group"><label>Пароль</label><input type="password" value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} /></div><button type="submit" className="submit-btn">Войти</button></form></div></div>, document.body)}
      </>
    );
  }

  return (
    <div className="app-container">
      {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><i className="fas fa-calendar-alt"></i> Расписание</div>
        <div className="sidebar-profile"><div className="profile-avatar"><i className={`fas ${user.role === 'admin' ? 'fa-crown' : user.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div><div><strong>{user.fullName}</strong><br/>{ROLES[user.role]}</div></div>
        <nav className="sidebar-nav">
          {!isTeacher && <button className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); }}><i className="fas fa-calendar-week"></i> Расписание</button>}
          {isTeacher && <button className={`nav-item ${activeTab === 'my-lessons' ? 'active' : ''}`} onClick={() => { setActiveTab('my-lessons'); setSidebarOpen(false); }}><i className="fas fa-chalkboard-teacher"></i> Мои занятия</button>}
          {canEditSchedule && <>
            <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}><i className="fas fa-edit"></i> Управление</button>
            <button className={`nav-item ${activeTab === 'template' ? 'active' : ''}`} onClick={() => { setActiveTab('template'); setSidebarOpen(false); }}><i className="fas fa-layer-group"></i> Шаблон</button>
            <button className={`nav-item ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => { setActiveTab('directories'); setSidebarOpen(false); }}><i className="fas fa-database"></i> Справочники</button>
          </>}
          {canManageUsers && <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}><i className="fas fa-users-cog"></i> Пользователи</button>}
        </nav>
        <div className="sidebar-footer">
          <button onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i> {theme === 'light' ? 'Тёмная' : 'Светлая'} тема</button>
          <button onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Выйти</button>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <main className="app-main">
        <header className="app-header">
          <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)}><i className="fas fa-bars"></i></button>
          <h1>{isTeacher ? 'Мои занятия' : activeTab === 'schedule' ? 'Расписание' : activeTab === 'manage-schedule' ? 'Управление' : activeTab === 'template' ? 'Шаблон' : activeTab === 'directories' ? 'Справочники' : 'Пользователи'}</h1>
          <div className="header-actions-right"><button onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button><span className="role-badge">{ROLES[user.role]}</span></div>
        </header>
        <div className="app-content">{renderMainContent()}</div>
      </main>

      {showEditModal && editingLesson && createPortal(<div className="modal" onClick={() => setShowEditModal(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>{editingLesson.id ? 'Редактировать' : 'Добавить'}</h2><button onClick={() => setShowEditModal(false)}><i className="fas fa-times"></i></button></div><form onSubmit={handleSaveLesson} className="modal-form">
        <div className="form-group"><label>Группа *</label><select value={editingLesson.group_id} onChange={e => setEditingLesson(p => ({ ...p, group_id: e.target.value }))} required><option value="">Выберите</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div className="form-group"><label>Предмет *</label><select value={editingLesson.subject_id} onChange={e => setEditingLesson(p => ({ ...p, subject_id: e.target.value }))} required><option value="">Выберите</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="form-group"><label>Преподаватель *</label><select value={editingLesson.teacher_id} onChange={e => setEditingLesson(p => ({ ...p, teacher_id: e.target.value }))} required><option value="">Выберите</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="form-group"><label>Аудитория</label><select value={editingLesson.classroom_id || ''} onChange={e => setEditingLesson(p => ({ ...p, classroom_id: e.target.value }))}><option value="">Не выбрана</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 1 }}><label>День *</label><select value={editingLesson.day_of_week} onChange={e => setEditingLesson(p => ({ ...p, day_of_week: e.target.value }))}>{DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}</select></div>
          <div className="form-group" style={{ flex: 1 }}><label>Пара *</label><select value={editingLesson.pair_number} onChange={e => setEditingLesson(p => ({ ...p, pair_number: e.target.value }))}>{PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}</select></div>
        </div>
        {!editingLesson.apply_all && <div className="form-group"><label>Дата *</label><input type="date" value={editingLesson.date || ''} onChange={e => setEditingLesson(p => ({ ...p, date: e.target.value }))} required /></div>}
        <div className="form-group"><label><input type="checkbox" checked={editingLesson.apply_all || false} onChange={e => setEditingLesson(p => ({ ...p, apply_all: e.target.checked }))} /> Применить для всех недель (шаблон)</label></div>
        <button type="submit" className="submit-btn">{editingLesson.id ? 'Сохранить' : 'Добавить'}</button>
      </form></div></div>, document.body)}

      {showRegister && createPortal(<div className="modal" onClick={() => setShowRegister(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Создать</h2><button onClick={() => setShowRegister(false)}><i className="fas fa-times"></i></button></div><form onSubmit={handleRegister} className="modal-form">
        <div className="form-group"><label>Логин</label><input value={registerData.username} onChange={e => setRegisterData(p => ({ ...p, username: e.target.value }))} /></div>
        <div className="form-group"><label>Пароль</label><input type="password" value={registerData.password} onChange={e => setRegisterData(p => ({ ...p, password: e.target.value }))} /></div>
        <div className="form-group"><label>ФИО</label><input value={registerData.fullName} onChange={e => setRegisterData(p => ({ ...p, fullName: e.target.value }))} /></div>
        <div className="form-group"><label>Роль</label><select value={registerData.role} onChange={e => setRegisterData(p => ({ ...p, role: e.target.value }))}><option value="student">Студент</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select></div>
        {registerData.role === 'student' && <div className="form-group"><label>Группа</label><select value={registerData.groupId} onChange={e => setRegisterData(p => ({ ...p, groupId: e.target.value }))}><option value="">—</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>}
        <button type="submit" className="submit-btn">Создать</button>
      </form></div></div>, document.body)}

      {showGroupModal && createPortal(<div className="modal" onClick={() => setShowGroupModal(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Группа</h2></div><form onSubmit={e => { e.preventDefault(); addDirectory('groups', newGroup, setShowGroupModal, setNewGroup); }} className="modal-form"><input value={newGroup} onChange={e => setNewGroup(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showTeacherModal && createPortal(<div className="modal" onClick={() => setShowTeacherModal(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Преподаватель</h2></div><form onSubmit={e => { e.preventDefault(); addDirectory('teachers', newTeacher, setShowTeacherModal, setNewTeacher); }} className="modal-form"><input value={newTeacher} onChange={e => setNewTeacher(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showSubjectModal && createPortal(<div className="modal" onClick={() => setShowSubjectModal(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Предмет</h2></div><form onSubmit={e => { e.preventDefault(); addDirectory('subjects', newSubject, setShowSubjectModal, setNewSubject); }} className="modal-form"><input value={newSubject} onChange={e => setNewSubject(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showClassroomModal && createPortal(<div className="modal" onClick={() => setShowClassroomModal(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Аудитория</h2></div><form onSubmit={e => { e.preventDefault(); addDirectory('classrooms', newClassroom, setShowClassroomModal, setNewClassroom); }} className="modal-form"><input value={newClassroom} onChange={e => setNewClassroom(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showTeacherReportModal && createPortal(<TeacherReportModal teachers={teachers} schedule={schedule} onClose={() => setShowTeacherReportModal(false)} onGenerate={generateTeacherReport} />, document.body)}
    </div>
  );
}

export default function HomeClient() {
  return <ThemeProvider><HomeContent /></ThemeProvider>;
}