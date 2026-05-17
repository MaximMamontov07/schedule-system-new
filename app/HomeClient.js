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
    if (isOpen && selectedOption) {
      setSearchTerm(selectedOption.label);
    } else if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen, selectedOption]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const handleKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        else setHighlightedIndex(prev => prev < filteredOptions.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (isOpen && filteredOptions.length === 1) {
          handleSelect(filteredOptions[0]);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        if (inputRef.current) inputRef.current.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        if (!isOpen && e.key.length === 1) setIsOpen(true);
    }
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
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

  const getDisplayValue = () => {
    if (isOpen) return searchTerm;
    return selectedOption?.label || '';
  };

  if (disabled) {
    return (
      <div className="searchable-select disabled">
        <label><i className={icon}></i> {label}</label>
        <div className="searchable-select-input disabled">
          <span className="selected-value">{selectedOption?.label || placeholder}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="searchable-select" ref={dropdownRef}>
      <label><i className={icon}></i> {label}</label>
      <div className={`searchable-select-input ${isOpen ? 'focused' : ''} ${value ? 'has-value' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          className="searchable-select-input-field"
          placeholder={placeholder}
          value={getDisplayValue()}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        />
        <div className="searchable-select-icons">
          {value && (
            <button className="searchable-select-clear-btn" onClick={(e) => { e.stopPropagation(); onChange(''); setSearchTerm(''); }} title="Очистить">
              <i className="fas fa-times-circle"></i>
            </button>
          )}
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
                <div
                  key={option.value}
                  className={`searchable-select-option ${value === option.value ? 'selected' : ''} ${highlightedIndex === idx ? 'highlighted' : ''}`}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="searchable-select-option-content">
                    <span className="searchable-select-option-label">{option.label}</span>
                    {value === option.value && <span className="searchable-select-option-check"><i className="fas fa-check"></i></span>}
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
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false, day: prevMonthLastDay - i });
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true, day: i });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, day: i });
    return days;
  };

  const changeMonth = (delta) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  const isTodayDate = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    return selectedDate && date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
  };

  const handleDateClick = (date) => { onDateSelect(date); onClose(); };

  const years = [];
  for (let i = currentMonth.getFullYear() - 5; i <= currentMonth.getFullYear() + 5; i++) years.push(i);

  return (
    <div className="datepicker-modal" onClick={(e) => e.stopPropagation()}>
      <div className="datepicker-header">
        <div className="datepicker-nav">
          <button onClick={() => changeMonth(-1)} className="datepicker-nav-btn"><i className="fas fa-chevron-left"></i></button>
          <button className="datepicker-month-year" onClick={() => setViewMode(viewMode === 'month' ? 'year' : 'month')}>
            {viewMode === 'month' ? <span>{months[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span> : <span>{currentMonth.getFullYear()}</span>}
            <i className="fas fa-chevron-down"></i>
          </button>
          <button onClick={() => changeMonth(1)} className="datepicker-nav-btn"><i className="fas fa-chevron-right"></i></button>
        </div>
        <button className="datepicker-close" onClick={onClose}><i className="fas fa-times"></i></button>
      </div>
      {viewMode === 'month' ? (
        <>
          <div className="datepicker-weekdays">{weekdays.map(day => <div key={day} className="datepicker-weekday">{day}</div>)}</div>
          <div className="datepicker-days">
            {getDaysInMonth(currentMonth).map((day, idx) => (
              <button
                key={idx}
                className={`datepicker-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isTodayDate(day.date) ? 'today' : ''} ${isSelected(day.date) ? 'selected' : ''}`}
                onClick={() => handleDateClick(day.date)}
              >
                {day.day}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="datepicker-years">
          {years.map(year => (
            <button key={year} className={`datepicker-year ${year === currentMonth.getFullYear() ? 'active' : ''}`}
              onClick={() => { setCurrentMonth(new Date(year, currentMonth.getMonth(), 1)); setViewMode('month'); }}>
              {year}
            </button>
          ))}
        </div>
      )}
      <div className="datepicker-footer">
        <button className="datepicker-today-btn" onClick={() => { const today = new Date(); handleDateClick(today); }}>
          <i className="fas fa-calendar-day"></i> Сегодня
        </button>
      </div>
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
                              {lesson.notes && (
                                <div className="lesson-notes-badge">
                                  <i className="fas fa-sticky-note"></i>
                                  <span>{lesson.notes}</span>
                                </div>
                              )}
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
const TeacherPanel = ({ data, localData, hasChanges, saving, onNotesChange, onSave, onCancel, currentDate, onPrevWeek, onNextWeek, onCurrentWeek, onRequestChange }) => {
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
                                <button onClick={() => onRequestChange(lesson)} className="teacher-action-btn" style={{ background: 'var(--accent)', color: 'white', marginTop: '0.3rem', width: '100%' }}>
                                  <i className="fas fa-paper-plane"></i> Заявка на изменение
                                </button>
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

// ---------- ChangeRequestList ----------
const ChangeRequestList = ({ requests, onApprove, onReject, loading }) => {
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <span className="status-badge pending"><i className="fas fa-clock"></i> Ожидает</span>;
      case 'approved': return <span className="status-badge approved"><i className="fas fa-check-circle"></i> Одобрена</span>;
      case 'rejected': return <span className="status-badge rejected"><i className="fas fa-times-circle"></i> Отклонена</span>;
      default: return null;
    }
  };

  const getRequestTypeText = (type) => {
    switch(type) {
      case 'cancel': return 'Отмена занятия';
      case 'change': return 'Изменение';
      case 'replace': return 'Замена преподавателя';
      default: return type;
    }
  };

  if (loading) {
    return <div className="loading-state"><div className="spinner"></div><p>Загрузка заявок...</p></div>;
  }

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-clipboard-list"></i>
        <p>Нет заявок на изменение</p>
      </div>
    );
  }

  return (
    <div className="change-requests-list">
      {requests.map(req => (
        <div key={req.id} className="change-request-card">
          <div className="request-header">
            <div className="request-info">
              <span className="request-type">{getRequestTypeText(req.request_type)}</span>
              {getStatusBadge(req.status)}
            </div>
            <div className="request-date">{formatDateRu(req.created_at)}</div>
          </div>
          <div className="request-details">
            <p><strong>Группа:</strong> {req.group_name}</p>
            <p><strong>Занятие:</strong> {DAYS[req.day_of_week - 1]}, {req.pair_number} пара</p>
            {req.week_start_date && <p><strong>Неделя:</strong> с {formatDateRu(req.week_start_date)}</p>}
            {req.new_teacher_name && <p><strong>Новый преподаватель:</strong> {req.new_teacher_name}</p>}
            {req.new_subject_name && <p><strong>Новый предмет:</strong> {req.new_subject_name}</p>}
            {req.new_classroom_name && <p><strong>Новая аудитория:</strong> {req.new_classroom_name}</p>}
            {req.new_pair_number && <p><strong>Новая пара:</strong> {req.new_pair_number}</p>}
            {req.new_day_of_week && <p><strong>Новый день:</strong> {DAYS[req.new_day_of_week - 1]}</p>}
            {req.reason && (
              <div className="request-reason">
                <strong>Причина:</strong>
                <p>{req.reason}</p>
              </div>
            )}
            <p className="request-author"><strong>Автор:</strong> {req.author_name}</p>
          </div>
          {req.status === 'pending' && (
            <div className="request-actions">
              <button onClick={() => onApprove(req.id)} className="approve-btn"><i className="fas fa-check"></i> Одобрить</button>
              <button onClick={() => onReject(req.id)} className="reject-btn"><i className="fas fa-times"></i> Отклонить</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------- TeacherReportModal ----------
const TeacherReportModal = ({ teachers, schedule, onClose, onGenerate, isTeacher, currentTeacherId }) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState(isTeacher ? String(currentTeacherId) : '');
  const [generating, setGenerating] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const teacherOptions = teachers?.map(t => ({ value: String(t.id), label: t.name })) || [];

  const handleGenerate = async () => {
    if (!selectedTeacherId) { alert('Выберите преподавателя'); return; }
    if (!dateFrom || !dateTo) { alert('Выберите период (с и по)'); return; }
    if (dateFrom > dateTo) { alert('Дата "с" не может быть позже даты "по"'); return; }
    
    setGenerating(true);
    await onGenerate(selectedTeacherId, dateFrom, dateTo);
    setGenerating(false);
    onClose();
  };

  const setQuickPeriod = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setDateFrom(formatForInput(from));
    setDateTo(formatForInput(to));
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2><i className="fas fa-chart-line"></i> Отчет по часам</h2>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-form">
          {!isTeacher && (
            <div className="form-group">
              <label><i className="fas fa-chalkboard-teacher"></i> Преподаватель</label>
              <SearchableSelect options={teacherOptions} value={selectedTeacherId} onChange={setSelectedTeacherId} placeholder="Выберите преподавателя" label="" icon="fas fa-chalkboard-teacher" />
            </div>
          )}
          
          {isTeacher && (
            <div style={{ background: 'var(--surface-muted)', padding: '12px 15px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              <i className="fas fa-chalkboard-teacher" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>
              <strong>{teachers?.find(t => t.id === currentTeacherId)?.name || 'Преподаватель'}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label><i className="fas fa-calendar-alt"></i> Дата С</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label><i className="fas fa-calendar-alt"></i> Дата ПО</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button type="button" onClick={() => setQuickPeriod(7)} className="quick-period-btn">Неделя</button>
            <button type="button" onClick={() => setQuickPeriod(14)} className="quick-period-btn">2 недели</button>
            <button type="button" onClick={() => setQuickPeriod(30)} className="quick-period-btn">Месяц</button>
            <button type="button" onClick={() => setQuickPeriod(90)} className="quick-period-btn">3 месяца</button>
          </div>

          <button className="submit-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-download"></i>}
            {generating ? ' Формирование...' : ' Сформировать отчет'}
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
  
  // Новые состояния для заявок
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [changeRequestLesson, setChangeRequestLesson] = useState(null);
  const [changeRequests, setChangeRequests] = useState([]);
  const [showRequestsList, setShowRequestsList] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const showNotification = (msg, type = 'success') => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };
  const canEditSchedule = user && (user.role === 'admin' || user.role === 'methodist');
  const canManageUsers = user && user.role === 'admin';
  const isTeacher = user && user.role === 'teacher';

  // ---------- Загрузка заявок ----------
  const loadChangeRequests = useCallback(async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/schedule/change-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChangeRequests(data);
      }
    } catch (e) {
      console.error('Ошибка загрузки заявок:', e);
    } finally {
      setLoadingRequests(false);
    }
  }, [token]);

  // ---------- Одобрение/отклонение заявки ----------
  const handleApproveRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/schedule/change-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showNotification('Заявка одобрена и применена');
        loadChangeRequests();
        // Перезагружаем расписание
        const monday = getMonday(new Date());
        await loadScheduleForWeek(formatForInput(monday), null, selectedGroupFilter, true);
        if (activeTab === 'manage-schedule') {
          await loadScheduleForWeekForManage();
        }
      } else {
        const data = await res.json();
        showNotification(data.error || 'Ошибка при одобрении заявки', 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/schedule/change-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showNotification('Заявка отклонена');
        loadChangeRequests();
      } else {
        const data = await res.json();
        showNotification(data.error || 'Ошибка при отклонении заявки', 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    }
  };

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
    if (cached && Date.now() - cached.timestamp < 5000 && !forceReload) {
      setSchedule(cached.data);
      return cached.data;
    }

    let url = `/api/schedule?weekStart=${start}`;
    if (effectiveGroupId) url += `&groupId=${effectiveGroupId}`;

    try {
      const scheduleRes = await fetch(url, { headers });
      const scheduleData = await scheduleRes.json();
      scheduleCache.set(cacheKey, { data: scheduleData, timestamp: Date.now() });
      setSchedule(scheduleData);
      return scheduleData;
    } catch (e) {
      showNotification('Ошибка загрузки расписания', 'error');
      return [];
    }
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
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch (e) {
      console.error('Ошибка загрузки расписания преподавателя:', e);
    }
  }, [token, isTeacher, teachers, user]);

  const loadData = useCallback(async () => {
    try {
      const [groupsRes, teachersRes, subjectsRes] = await Promise.all([
        fetch('/api/groups'), fetch('/api/teachers'), fetch('/api/subjects')
      ]);
      setGroups(await groupsRes.json()); setTeachers(await teachersRes.json()); setSubjects(await subjectsRes.json());

      try {
        const classroomsRes = await fetch('/api/classrooms');
        if (classroomsRes.ok) setClassrooms(await classroomsRes.json());
        else setClassrooms([]);
      } catch (e) { setClassrooms([]); }

      const monday = getMonday(new Date());
      await loadScheduleForWeek(formatForInput(monday), null, selectedGroupFilter, true);
    } catch (e) {
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadScheduleForWeek, selectedGroupFilter]);

  const loadUsers = useCallback(async () => {
    if (!token || !canManageUsers) return;
    try {
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  }, [token, canManageUsers]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/schedule/template');
      setTemplates(await res.json());
    } catch (e) {
      showNotification('Ошибка загрузки шаблонов', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // ---------- Отчёты ----------
  const generateTeacherReport = useCallback(async (teacherId, dateFrom, dateTo) => {
  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const teacher = teachers.find(t => t.id === parseInt(teacherId));
    if (!teacher) return showNotification('Преподаватель не найден', 'error');

    const allLessons = [];
    const fromDate = parseLocalDate(dateFrom);
    const toDate = parseLocalDate(dateTo);
    const currentMonday = getMonday(fromDate);
    
    while (currentMonday <= toDate) {
      const weekStart = formatForInput(currentMonday);
      const url = `/api/schedule?weekStart=${weekStart}&teacherId=${teacherId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const weekData = await res.json();
      
      const filteredWeek = weekData.filter(l => {
        if (!l.date) return false;
        return l.date >= dateFrom && l.date <= dateTo;
      });
      
      allLessons.push(...filteredWeek);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    if (allLessons.length === 0) return showNotification('Нет занятий за выбранный период', 'error');

    const subjectsHours = {};
    allLessons.forEach(lesson => {
      const sn = lesson.subject_name;
      if (!subjectsHours[sn]) {
        subjectsHours[sn] = { name: sn, hours: 0, lessons: [], groups: new Set() };
      }
      subjectsHours[sn].hours += 1.5;
      subjectsHours[sn].lessons.push(lesson);
      subjectsHours[sn].groups.add(lesson.group_name);
    });

    const weeksMap = {};
    allLessons.forEach(lesson => {
      if (lesson.date) {
        const ws = formatForInput(getMonday(parseLocalDate(lesson.date)));
        if (!weeksMap[ws]) weeksMap[ws] = [];
        weeksMap[ws].push(lesson);
      }
    });

    const sortedWeeks = Object.keys(weeksMap).sort();
    const totalHours = (allLessons.length * 1.5).toFixed(1);
    const uniqueSubjects = Object.keys(subjectsHours).length;
    const uniqueGroups = new Set(allLessons.map(l => l.group_name)).size;
    const now = new Date();

    const element = document.createElement('div');
    element.innerHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 12px 15px;
      color: #1e293b;
      background: #fff;
      font-size: 9px;
    }
    
    .report-header {
      background: #2c3e66;
      color: #fff;
      padding: 12px 18px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .report-header h1 { font-size: 16px; margin-bottom: 2px; font-weight: 700; }
    .report-header .teacher { font-size: 12px; opacity: 0.95; margin-bottom: 4px; }
    .report-header .meta { font-size: 8px; opacity: 0.8; }
    
    .summary { margin-bottom: 12px; }
    .summary table { width: auto; border-collapse: collapse; }
    .summary td {
      padding: 4px 10px;
      border: 1px solid #e2e8f0;
      text-align: center;
      font-size: 8px;
      background: #f8fafc;
    }
    .summary .val { font-size: 14px; font-weight: 700; color: #2c3e66; }
    .summary .lbl { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .section-title {
      font-size: 12px; font-weight: 700; color: #2c3e66;
      padding-bottom: 4px; border-bottom: 2px solid #2c3e66;
      margin: 12px 0 6px;
    }
    
    table.data { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 8px; }
    table.data thead { background: #2c3e66; color: #fff; }
    table.data th {
      padding: 5px 3px; text-align: left; font-weight: 600;
      font-size: 7px; text-transform: uppercase;
    }
    table.data td { padding: 3px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    table.data .total td {
      font-weight: 700; background: #e2e8f0 !important;
      border-top: 2px solid #2c3e66;
    }
    
    .week-block { margin-bottom: 8px; page-break-inside: avoid; }
    .week-title {
      font-size: 9px; font-weight: 700; color: #2c3e66;
      padding: 4px 8px; background: #f1f5f9; border-radius: 4px;
      margin-bottom: 4px;
    }
    .week-title .info { float: right; font-weight: 400; font-size: 8px; color: #64748b; }
    
    .footer {
      margin-top: 10px; padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      text-align: center; font-size: 7px; color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Отчет о нагрузке преподавателя</h1>
    <div class="teacher">${teacher.name}</div>
    <div class="meta">
      Период: ${formatDateRu(dateFrom)} — ${formatDateRu(dateTo)} &nbsp;|&nbsp; Сформирован: ${now.toLocaleString('ru-RU')}
    </div>
  </div>
  
  <div class="summary">
    <table>
      <tr>
        <td><div class="val">${totalHours}</div><div class="lbl">Всего часов</div></td>
        <td><div class="val">${allLessons.length}</div><div class="lbl">Занятий</div></td>
        <td><div class="val">${uniqueSubjects}</div><div class="lbl">Предметов</div></td>
        <td><div class="val">${uniqueGroups}</div><div class="lbl">Групп</div></td>
        <td><div class="val">${sortedWeeks.length}</div><div class="lbl">Недель</div></td>
      </tr>
    </table>
  </div>
  
  <div class="section-title">Сводка по предметам</div>
  <table class="data">
    <thead>
      <tr>
        <th>N</th>
        <th>Предмет</th>
        <th>Занятий</th>
        <th>Часов</th>
        <th>Группы</th>
      </tr>
    </thead>
    <tbody>
      ${Object.values(subjectsHours).sort((a, b) => b.hours - a.hours).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${item.name}</strong></td>
        <td>${item.lessons.length} пар(ы)</td>
        <td><strong>${item.hours.toFixed(1)} ч.</strong></td>
        <td>${[...item.groups].join(', ')}</td>
      </tr>
      `).join('')}
      <tr class="total">
        <td colspan="2"><strong>ИТОГО</strong></td>
        <td><strong>${allLessons.length} пар</strong></td>
        <td colspan="2"><strong>${totalHours} часов</strong></td>
      </tr>
    </tbody>
  </table>
  
  <div class="section-title">Детализация по неделям</div>
  ${sortedWeeks.map(ws => {
    const wd = weeksMap[ws];
    const we = new Date(parseLocalDate(ws));
    we.setDate(we.getDate() + 6);
    const wn = getWeekNumber(parseLocalDate(ws));
    return `
    <div class="week-block">
      <div class="week-title">
        Неделя ${wn} &nbsp;|&nbsp; ${formatDateRu(ws)} — ${formatDateRu(formatForInput(we))}
        <span class="info">${wd.length} пар &nbsp;|&nbsp; ${(wd.length * 1.5).toFixed(1)} ч.</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>Дата</th>
            <th>День</th>
            <th>Пара</th>
            <th>Время</th>
            <th>Предмет</th>
            <th>Группа</th>
            <th>Ауд.</th>
          </tr>
        </thead>
        <tbody>
          ${wd.sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return a.pair_number - b.pair_number;
          }).map(l => `
          <tr>
            <td>${l.date ? formatDateRu(l.date) : '—'}</td>
            <td>${DAYS[l.day_of_week - 1]}</td>
            <td>${l.pair_number}</td>
            <td>${PAIRS[l.pair_number - 1]?.time || ''}</td>
            <td>${l.subject_name}</td>
            <td>${l.group_name}</td>
            <td>${l.classroom_name || '—'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }).join('')}
  
  <div class="footer">
    <p>Документ сгенерирован автоматически &nbsp;|&nbsp; Система управления расписанием</p>
    <p>${formatDateRu(dateFrom)} — ${formatDateRu(dateTo)} &nbsp;|&nbsp; ${now.toLocaleString('ru-RU')}</p>
  </div>
</body>
</html>`;

    await html2pdf().set({
      margin: [0.2, 0.2, 0.2, 0.2],
      filename: `Отчет_по_часам_${teacher.name.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['table', '.week-block', '.summary'] }
    }).from(element).save();

    showNotification('Отчет сформирован', 'success');
  } catch (e) {
    console.error('Ошибка:', e);
    showNotification('Ошибка формирования отчета', 'error');
  }
}, [teachers, token]);

  const exportTeacherHoursReport = useCallback(async () => {
    if (!user || user.role !== 'teacher') return;
    const teacher = teachers.find(t => t.user_id === user.id);
    if (!teacher) return showNotification('Преподаватель не найден', 'error');
    
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    
    await generateTeacherReport(teacher.id, formatForInput(monthAgo), formatForInput(today));
  }, [user, teachers, generateTeacherReport]);

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
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 }, fill: { fgColor: { rgb: "2c3e66" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "1e2a4a" } }, bottom: { style: "thin", color: { rgb: "1e2a4a" } }, left: { style: "thin", color: { rgb: "1e2a4a" } }, right: { style: "thin", color: { rgb: "1e2a4a" } } } };
    }
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) ws[cellRef].s = { font: { sz: 10 }, alignment: { horizontal: "left", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: "e2e8f0" } }, bottom: { style: "thin", color: { rgb: "e2e8f0" } }, left: { style: "thin", color: { rgb: "e2e8f0" } }, right: { style: "thin", color: { rgb: "e2e8f0" } } } };
      }
    }
    const colWidths = {};
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) { const v = String(ws[cellRef].v || ''); colWidths[col] = Math.max(colWidths[col] || 10, v.length + 4); }
      }
    }
    ws['!cols'] = Object.keys(colWidths).map(c => ({ wch: Math.min(colWidths[c], 40) }));
    XLSX.utils.book_append_sheet(wb, ws, "Расписание");
    XLSX.writeFile(wb, `Расписание_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Excel файл сохранен', 'success');
  }, [schedule, activeTab, isTeacher, teachers, user]);

 const exportToPDF = useCallback(async () => {
  try {
    const html2pdf = (await import('html2pdf.js')).default;
    let exportData = [];
    let title = 'Расписание занятий';
    let subtitle = '';

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
    } else {
      exportData = schedule;
      subtitle = `Дата: ${new Date().toLocaleString('ru-RU')}`;
    }

    const grouped = {};
    exportData.forEach(lesson => {
      const key = lesson.date || 'Без даты';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(lesson);
    });

    const sortedDates = Object.keys(grouped).sort();
    const totalLessons = exportData.length;
    const totalHours = (totalLessons * 1.5).toFixed(1);

    const showGroup = activeTab !== 'my-lessons' && user?.role !== 'student';
    const colSpan = showGroup ? 7 : 6;

    const element = document.createElement('div');
    element.innerHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 15px;
      color: #1e293b;
      background: #fff;
      font-size: 11px;
    }
    .header {
      background: #2c3e66;
      color: #fff;
      padding: 18px 22px;
      border-radius: 8px;
      margin-bottom: 18px;
    }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header p { font-size: 10px; opacity: 0.9; }
    
    .stats { margin-bottom: 18px; }
    .stats table { width: auto; border-collapse: collapse; }
    .stats td {
      padding: 6px 16px;
      border: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
    }
    .stats .val { font-size: 18px; font-weight: 700; color: #2c3e66; }
    .stats .lbl { font-size: 8px; color: #64748b; text-transform: uppercase; }
    
    .day-section { margin-bottom: 18px; page-break-inside: avoid; }
    .day-title {
      font-size: 13px; font-weight: 700; color: #2c3e66;
      padding: 7px 10px; background: #f1f5f9; border-left: 4px solid #2c3e66;
      margin-bottom: 6px;
    }
    .day-title .count { float: right; font-weight: 400; font-size: 10px; color: #64748b; }
    
    table.data { width: 100%; border-collapse: collapse; font-size: 9px; }
    table.data thead { background: #2c3e66; color: #fff; }
    table.data th {
      padding: 7px 5px; text-align: left; font-weight: 600;
      font-size: 8px; text-transform: uppercase;
    }
    table.data td {
      padding: 5px; border-bottom: 1px solid #e2e8f0;
      vertical-align: top; word-break: break-word;
    }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    table.data .total td {
      font-weight: 700; background: #e2e8f0 !important;
      border-top: 2px solid #2c3e66;
    }
    
    .footer {
      margin-top: 20px; padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      text-align: center; font-size: 8px; color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>${subtitle}</p>
  </div>
  
  <div class="stats">
    <table>
      <tr>
        <td><div class="val">${totalLessons}</div><div class="lbl">Занятий</div></td>
        <td><div class="val">${totalHours}</div><div class="lbl">Часов</div></td>
        <td><div class="val">${sortedDates.length}</div><div class="lbl">Дней</div></td>
      </tr>
    </table>
  </div>
  
  ${sortedDates.map(dateKey => {
    const lessons = grouped[dateKey];
    const date = parseLocalDate(dateKey);
    const dayName = date ? DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1] : '';
    return `
    <div class="day-section">
      <div class="day-title">
        ${dateKey !== 'Без даты' ? formatDateRu(dateKey) : dateKey} — ${dayName}
        <span class="count">${lessons.length} пар(ы) &bull; ${(lessons.length * 1.5).toFixed(1)} ч.</span>
      </div>
      <table class="data">
        <thead>
          <tr>
            <th>Пара</th>
            <th>Время</th>
            ${showGroup ? '<th>Группа</th>' : ''}
            <th>Предмет</th>
            <th>Преподаватель</th>
            <th>Ауд.</th>
            <th>Заметки</th>
          </tr>
        </thead>
        <tbody>
          ${lessons.sort((a, b) => a.pair_number - b.pair_number).map(lesson => `
          <tr>
            <td>${lesson.pair_number}</td>
            <td>${PAIRS[lesson.pair_number - 1]?.time || ''}</td>
            ${showGroup ? `<td>${lesson.group_name}</td>` : ''}
            <td><strong>${lesson.subject_name}</strong></td>
            <td>${lesson.teacher_name}</td>
            <td>${lesson.classroom_name || '—'}</td>
            <td>${lesson.notes || '—'}</td>
          </tr>
          `).join('')}
          <tr class="total">
            <td colspan="${colSpan}">
              Итого за день: ${lessons.length} пар &bull; ${(lessons.length * 1.5).toFixed(1)} ак. часов
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    `;
  }).join('')}
  
  <div class="footer">
    <p>Документ сгенерирован автоматически &bull; ${new Date().toLocaleString('ru-RU')}</p>
  </div>
</body>
</html>`;

    await html2pdf().set({
      margin: [0.2, 0.2, 0.2, 0.2],
      filename: `Расписание_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(element).save();

    showNotification('PDF файл сохранен', 'success');
  } catch (error) {
    console.error('Ошибка:', error);
    showNotification('Ошибка экспорта PDF', 'error');
  }
}, [schedule, activeTab, isTeacher, teachers, user, groups]);

  // ---------- Аутентификация ----------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowLogin(false);
        showNotification(`Добро пожаловать, ${data.user.fullName}!`);
        await loadData();
        if (data.user.role === 'admin') await loadUsers();
        if (data.user.role === 'teacher') setActiveTab('my-lessons');
        else setActiveTab('schedule');
      } else { showNotification(data.error, 'error'); }
    } catch (e) { showNotification('Ошибка входа', 'error'); }
  };

  const handleLogout = () => {
    setToken(null); setUser(null);
    localStorage.clear();
    scheduleCache.clear();
    showNotification('Вы вышли из системы', 'info');
    setSchedule([]); setSelectedGroupFilter(''); setActiveTab('schedule');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(registerData)
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('Пользователь создан', 'success');
        setShowRegister(false);
        setRegisterData({ username: '', password: '', fullName: '', role: 'student', groupId: '' });
        loadUsers();
      } else { showNotification(data.error, 'error'); }
    } catch (e) { showNotification('Ошибка регистрации', 'error'); }
  };

  // ---------- Справочники ----------
  const addDirectory = async (type, name, setShow, setValue) => {
    if (!name.trim()) return showNotification('Введите название', 'error');
    try {
      const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() })
      });
      if (res.ok) { showNotification('Добавлено', 'success'); setShow(false); setValue(''); loadData(); }
      else { const error = await res.json(); showNotification(error.error, 'error'); }
    } catch (e) { showNotification('Ошибка', 'error'); }
  };

  const deleteDirectory = async (type, id) => {
    if (!confirm('Удалить?')) return;
    try {
      await fetch(`/api/${type}?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      showNotification('Удалено', 'success'); loadData();
    } catch (e) { showNotification('Ошибка', 'error'); }
  };

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    if (!newClassroom.trim()) return showNotification('Введите номер', 'error');
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newClassroom.trim() })
      });
      if (res.ok) { showNotification('Аудитория добавлена', 'success'); setShowClassroomModal(false); setNewClassroom(''); loadData(); }
      else { const error = await res.json(); showNotification(error.error, 'error'); }
    } catch (e) { showNotification('Ошибка', 'error'); }
  };

  const handleDeleteClassroom = async (id) => {
    if (!confirm('Удалить аудиторию?')) return;
    try {
      await fetch(`/api/classrooms?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      showNotification('Удалено', 'success'); loadData();
    } catch (e) { showNotification('Ошибка', 'error'); }
  };
  
  const handleEditClick = (lesson) => {
    console.log('✏️ Редактирование занятия:', lesson);
    setEditingLesson({
        ...lesson,
        date: lesson.date || '',
        apply_all: lesson.source === 'template',
        template_id: lesson.template_id || null,
        override_id: lesson.override_id || null
    });
    setShowEditModal(true);
  };
  
  // ---------- Управление расписанием ----------
  const handleAddScheduleClick = useCallback((slotData) => {
    let dateValue = '';
    if (slotData.date) {
        const parsed = parseLocalDate(slotData.date);
        if (parsed) dateValue = formatForInput(parsed);
    }
    setEditingLesson({
        id: null,
        group_id: selectedGroupFilter || '',
        teacher_id: '',
        subject_id: '',
        classroom_id: '',
        pair_number: String(slotData.pair_number),
        day_of_week: String(slotData.day_of_week),
        date: dateValue,
        apply_all: false,
        template_id: null,      
        override_id: null       
    });
    setShowEditModal(true);
  }, [selectedGroupFilter]);

  const handleDeleteClick = (lesson) => {
    if (!canEditSchedule) {
      showNotification('Нет прав', 'error');
      return;
    }
    
    console.log('🗑 Нажато удаление, lesson:', lesson);
    
    const hasOverride = lesson.override_id && lesson.source !== 'template';
    
    let message = '';
    if (hasOverride) {
      message = 'Удалить изменение для этой недели?\n\nOK — удалить переопределение\nОтмена — отменить занятие и в шаблоне';
    } else if (lesson.template_id) {
      message = 'Что удалить?\n\nOK — отменить только на эту неделю\nОтмена — удалить из шаблона навсегда';
    } else {
      message = 'Удалить это занятие?';
    }
    
    const userChoice = confirm(message);
    
    if (hasOverride) {
      handleDeleteSlot(lesson, false);
    } else if (lesson.template_id) {
      handleDeleteSlot(lesson, !userChoice);
    } else {
      handleDeleteSlot(lesson, false);
    }
  };

  const handleDeleteSlot = async (lesson, applyAll) => {
    if (!canEditSchedule) {
      showNotification('Нет прав', 'error');
      return;
    }
    
    console.log('🗑 handleDeleteSlot вызван');
    console.log('  lesson:', lesson);
    console.log('  applyAll:', applyAll);
    
    const lessonDate = parseLocalDate(lesson.date);
    if (!lessonDate || isNaN(lessonDate.getTime())) {
      showNotification('Некорректная дата занятия', 'error');
      return;
    }
    
    const monday = getMonday(lessonDate);
    const weekStart = formatForInput(monday);
    
    const body = {
      group_id: lesson.group_id,
      pair_number: lesson.pair_number,
      day_of_week: lesson.day_of_week,
      week_start_date: weekStart,
      apply_all: applyAll,
      template_id: lesson.template_id || null,
      override_id: lesson.override_id || null
    };
    
    console.log('📤 DELETE body:', JSON.stringify(body, null, 2));
    
    try {
      const res = await fetch('/api/schedule/lesson', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      
      const result = await res.json();
      console.log('📥 DELETE ответ:', result);
      
      if (res.ok) {
        scheduleCache.clear();
        showNotification(
          applyAll ? 'Удалено из шаблона' : 'Занятие отменено на эту неделю',
          'success'
        );
        
        if (activeTab === 'manage-schedule') {
          await loadScheduleForWeekForManage();
        } else if (activeTab === 'template') {
          loadTemplates();
        } else {
          await loadData();
        }
      } else {
        showNotification(result.error || 'Ошибка удаления', 'error');
      }
    } catch (e) {
      console.error('Ошибка удаления:', e);
      showNotification('Ошибка соединения', 'error');
    }
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (!canEditSchedule) return showNotification('Нет прав', 'error');

    console.log('🚀 handleSaveLesson вызвана');
    console.log('📝 editingLesson:', JSON.stringify(editingLesson, null, 2));

    if (!editingLesson.apply_all && !editingLesson.date) {
        return showNotification('Выберите дату или отметьте "Применить для всех"', 'error');
    }
    if (!editingLesson.group_id || !editingLesson.teacher_id || !editingLesson.subject_id) {
        return showNotification('Заполните обязательные поля (группа, предмет, преподаватель)', 'error');
    }

    let weekStart = null;
    if (!editingLesson.apply_all) {
        const lessonDate = parseLocalDate(editingLesson.date);
        if (!lessonDate || isNaN(lessonDate.getTime())) {
            return showNotification('Некорректная дата', 'error');
        }
        weekStart = formatForInput(getMonday(lessonDate));
        console.log('📅 Неделя переопределения:', weekStart);
    }

    const body = {
        group_id: parseInt(editingLesson.group_id),
        teacher_id: parseInt(editingLesson.teacher_id),
        subject_id: parseInt(editingLesson.subject_id),
        classroom_id: editingLesson.classroom_id ? parseInt(editingLesson.classroom_id) : null,
        pair_number: parseInt(editingLesson.pair_number),
        day_of_week: parseInt(editingLesson.day_of_week),
        week_start_date: weekStart,
        apply_all: !!editingLesson.apply_all,
        template_id: editingLesson.template_id || null,
        override_id: editingLesson.override_id || null
    };

    console.log('Отправка на /api/schedule/lesson:', JSON.stringify(body, null, 2));

    try {
        const res = await fetch('/api/schedule/lesson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });

        const result = await res.json();
        console.log('Ответ:', result);

        if (res.ok) {
            scheduleCache.clear();
            console.log('🗑 Кэш очищен');

            showNotification(
                editingLesson.apply_all ? '✅ Шаблон обновлён' : '✅ Изменение сохранено для недели',
                'success'
            );

            setShowEditModal(false);
            setEditingLesson(null);

            console.log('Перезагрузка данных...');
            
            if (activeTab === 'manage-schedule') {
                const weekDates = getWeekDates(manageCurrentDate);
                console.log('Перезагрузка управления, неделя:', formatForInput(weekDates[0]));
                await loadScheduleForWeek(
                    formatForInput(weekDates[0]),
                    formatForInput(weekDates[6]),
                    selectedGroupFilter,
                    true
                );
            } else if (activeTab === 'template') {
                console.log('Перезагрузка шаблона');
                loadTemplates();
            } else {
                const monday = getMonday(new Date());
                console.log('Перезагрузка расписания, неделя:', formatForInput(monday));
                await loadScheduleForWeek(
                    formatForInput(monday),
                    null,
                    selectedGroupFilter,
                    true
                );
            }

            console.log('Данные перезагружены');
        } else if (res.status === 409) {
            showNotification(result.error, 'error');
            alert('Конфликт: ' + result.error);
        } else {
            showNotification(result.error || 'Ошибка сервера', 'error');
        }
    } catch (e) {
        console.error('Ошибка:', e);
        showNotification('Ошибка соединения', 'error');
    }
  };

  // ---------- Заметки преподавателя ----------
  const handleNotesChange = (lessonId, value) => {
    setLocalData(prev => ({ ...prev, [lessonId]: { ...prev[lessonId], notes: value } }));
    setHasChanges(prev => ({ ...prev, [lessonId]: true }));
  };

  const handleSaveNotesForLesson = async (lesson) => {
    const weekStart = formatForInput(getMonday(parseLocalDate(lesson.date)));
    const body = { week_start_date: weekStart, group_id: lesson.group_id, day_of_week: lesson.day_of_week, pair_number: lesson.pair_number, notes: localData[lesson.id]?.notes || '' };
    try {
      const res = await fetch('/api/schedule/teacher-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showNotification('Заметки сохранены', 'success');
        setHasChanges(prev => { const n = { ...prev }; delete n[lesson.id]; return n; });
        await loadData();
      } else { const err = await res.json(); showNotification(err.error, 'error'); }
    } catch (e) { showNotification('Ошибка соединения', 'error'); }
  };

  // ---------- Обработчик заявки ----------
  const handleRequestChange = (lesson) => {
    setChangeRequestLesson(lesson);
    setShowChangeRequestModal(true);
  };

  // ---------- Отправка заявки ----------
  const handleSubmitChangeRequest = async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      group_id: changeRequestLesson.group_id,
      day_of_week: changeRequestLesson.day_of_week,
      pair_number: changeRequestLesson.pair_number,
      week_start_date: changeRequestLesson.date ? formatForInput(getMonday(parseLocalDate(changeRequestLesson.date))) : null,
      request_type: form.request_type.value,
      new_teacher_id: form.new_teacher_id?.value || null,
      new_subject_id: form.new_subject_id?.value || null,
      new_classroom_id: form.new_classroom_id?.value || null,
      new_pair_number: form.new_pair_number?.value || null,
      new_day_of_week: form.new_day_of_week?.value || null,
      reason: form.reason.value || null
    };
    
    try {
      const res = await fetch('/api/schedule/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showNotification('Заявка отправлена');
        setShowChangeRequestModal(false);
        setChangeRequestLesson(null);
      } else {
        const data = await res.json();
        showNotification(data.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    }
  };

  // ---------- Эффекты ----------
  useEffect(() => {
    const init = async () => {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('user');
      if (t && u) {
        setToken(t);
        const userData = JSON.parse(u);
        setUser(userData);
        if (userData.role === 'teacher') setActiveTab('my-lessons');
      }
      setAuthChecking(false);
    };
    init();
  }, []);

  useEffect(() => { if (!authChecking) loadData(); }, [authChecking, loadData]);
  useEffect(() => { if (token && canManageUsers) loadUsers(); }, [token, canManageUsers, loadUsers]);
  
  // Загружаем заявки для админа
  useEffect(() => {
    if (token && user?.role === 'admin') {
      loadChangeRequests();
    }
  }, [token, user, loadChangeRequests]);

  useEffect(() => {
    if (isTeacher && teachers.length > 0 && user) {
      loadTeacherSchedule(teacherCurrentDate);
    }
  }, [isTeacher, teachers, user, teacherCurrentDate, loadTeacherSchedule]);

  useEffect(() => {
    if (isTeacher && schedule.length > 0 && user) {
      const teacher = teachers.find(t => t.user_id === user.id);
      if (teacher) {
        const teacherLessons = schedule.filter(l => l.teacher_id === teacher.id);
        const initialData = {};
        teacherLessons.forEach(lesson => { initialData[lesson.id] = { notes: lesson.notes || '' }; });
        setLocalData(initialData);
      }
    }
  }, [schedule, isTeacher, teachers, user]);

  useEffect(() => {
    if (activeTab === 'manage-schedule' && token) loadScheduleForWeekForManage();
  }, [activeTab, token, loadScheduleForWeekForManage]);

  useEffect(() => {
    if (activeTab === 'template' && canEditSchedule) loadTemplates();
  }, [activeTab, canEditSchedule, loadTemplates]);

  // ---------- Рендер контента ----------
  const renderMainContent = () => {
    if (isTeacher) {
      const teacher = teachers.find(t => t.user_id === user?.id);
      const teacherLessons = teacher ? schedule.filter(l => l.teacher_id === teacher.id) : [];
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left"><h2><i className="fas fa-chalkboard-teacher"></i> Мои занятия</h2></div>
            <div className="header-actions">
              {Object.keys(hasChanges).length > 0 && (
                <button className="action-button save-all" onClick={() => {
                  Object.keys(hasChanges).forEach(id => {
                    const l = teacherLessons.find(les => les.id === parseInt(id));
                    if (l) handleSaveNotesForLesson(l);
                  });
                }}><i className="fas fa-save"></i> Сохранить всё</button>
              )}
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
              <button className="action-button report-hours" onClick={() => {
                if (teacher) {
                  setShowTeacherReportModal(true);
                } else {
                  showNotification('Преподаватель не найден', 'error');
                }
              }}><i className="fas fa-chart-line"></i> Отчёт по часам</button>
            </div>
          </div>
          {loading ? <div className="loading-state"><div className="spinner"></div></div> :
            teacherLessons.length === 0 ? <div className="empty-state"><i className="fas fa-info-circle"></i><p>Нет назначенных занятий</p></div> :
            <TeacherPanel data={teacherLessons} localData={localData} hasChanges={hasChanges} saving={saving} onNotesChange={handleNotesChange}
              onSave={handleSaveNotesForLesson} onCancel={(id) => {
                const l = teacherLessons.find(les => les.id === id);
                if (l) {
                  setLocalData(prev => ({ ...prev, [id]: { notes: l.notes || '' } }));
                  setHasChanges(prev => { const n = { ...prev }; delete n[id]; return n; });
                }
              }}
              currentDate={teacherCurrentDate}
              onPrevWeek={() => { const d = new Date(teacherCurrentDate); d.setDate(d.getDate() - 7); setTeacherCurrentDate(d); }}
              onNextWeek={() => { const d = new Date(teacherCurrentDate); d.setDate(d.getDate() + 7); setTeacherCurrentDate(d); }}
              onCurrentWeek={() => setTeacherCurrentDate(new Date())}
              onRequestChange={handleRequestChange}
            />
          }
        </div>
      );
    }

    if (activeTab === 'schedule') {
      let displaySchedule = schedule;
      if (user && user.role === 'student' && user.groupId) displaySchedule = schedule.filter(s => s.group_id === user.groupId);
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left"><h2><i className="fas fa-calendar-alt"></i> Расписание занятий</h2></div>
            <div className="header-actions">
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
              {user?.role === 'admin' && <button className="action-button report-hours" onClick={() => setShowTeacherReportModal(true)}><i className="fas fa-chart-line"></i> Отчёт по часам</button>}
            </div>
          </div>
          <ScheduleView schedule={displaySchedule} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms}
            loading={loading} userRole={user?.role} userGroupId={user?.groupId} loadScheduleForWeek={loadScheduleForWeek} />
        </div>
      );
    }

    if (activeTab === 'manage-schedule' && canEditSchedule) {
      const weekDatesForManage = getWeekDates(manageCurrentDate);
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left"><h2><i className="fas fa-edit"></i> Управление расписанием</h2></div>
            <div className="header-actions">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => { const d = new Date(manageCurrentDate); d.setDate(d.getDate() - 7); setManageCurrentDate(d); }} className="week-nav-btn"><i className="fas fa-chevron-left"></i> Пред.</button>
                <div style={{ background: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '2rem', color: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <i className="fas fa-calendar-week"></i><span>{formatDate(weekDatesForManage[0])} - {formatDate(weekDatesForManage[6])}</span><span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({getWeekNumber(weekDatesForManage[0])} нед.)</span>
                </div>
                <button onClick={() => { const d = new Date(manageCurrentDate); d.setDate(d.getDate() + 7); setManageCurrentDate(d); }} className="week-nav-btn">След. <i className="fas fa-chevron-right"></i></button>
                <button onClick={() => setManageCurrentDate(new Date())} className="week-today-btn"><i className="fas fa-calendar-day"></i> Сегодня</button>
              </div>
              <select value={selectedGroupFilter} onChange={e => setSelectedGroupFilter(e.target.value)} className="group-filter">
                <option value="">Все группы</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
              <button className="action-button report-hours" onClick={() => setShowTeacherReportModal(true)}><i className="fas fa-chart-line"></i> Отчёт по часам</button>
            </div>
          </div>
          {loading ? <div className="loading-state"><div className="spinner"></div></div> :
            <ScheduleGrid data={schedule} canEdit={true} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onAddClick={handleAddScheduleClick} weekDates={weekDatesForManage} selectedDate={null} />}
        </div>
      );
    }

    if (activeTab === 'template' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left"><h2><i className="fas fa-layer-group"></i> Шаблон расписания</h2></div>
            <div className="header-actions">
              <button className="action-button primary" onClick={() => {
                setEditingLesson({ id: null, group_id: '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: '1', day_of_week: '1', date: '', apply_all: true });
                setShowEditModal(true);
              }}><i className="fas fa-plus"></i> Добавить</button>
            </div>
          </div>
          {loadingTemplates ? <div className="loading-state"><div className="spinner"></div></div> :
            <div className="directories-grid">
              <div className="directory-card">
                <div className="directory-header"><i className="fas fa-list"></i><h3>Занятия шаблона</h3></div>
                <div className="directory-list">
                  {templates.map(t => (
                    <div key={t.id} className="directory-item">
                      <span>{DAYS[t.day_of_week - 1]} {t.pair_number} пара – {t.subject_name} ({t.group_name}), {t.teacher_name}</span>
                      <button onClick={async () => {
                        if (!confirm('Удалить?')) return;
                        await fetch(`/api/schedule/template?id=${t.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                        loadTemplates();
                      }} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        </div>
      );
    }

    if (activeTab === 'directories' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header"><div className="header-left"><h2><i className="fas fa-database"></i> Справочники</h2></div></div>
          <div className="directories-grid">
            <div className="directory-card">
              <div className="directory-header"><i className="fas fa-users"></i><h3>Группы</h3><button className="add-dir-btn" onClick={() => setShowGroupModal(true)}><i className="fas fa-plus"></i></button></div>
              <div className="directory-list">{groups.map(g => <div key={g.id} className="directory-item"><span>{g.name}</span><button onClick={() => deleteDirectory('groups', g.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button></div>)}</div>
            </div>
            <div className="directory-card">
              <div className="directory-header"><i className="fas fa-chalkboard-teacher"></i><h3>Преподаватели</h3><button className="add-dir-btn" onClick={() => setShowTeacherModal(true)}><i className="fas fa-plus"></i></button></div>
              <div className="directory-list">{teachers.map(t => <div key={t.id} className="directory-item"><span>{t.name}</span><button onClick={() => deleteDirectory('teachers', t.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button></div>)}</div>
            </div>
            <div className="directory-card">
              <div className="directory-header"><i className="fas fa-book"></i><h3>Предметы</h3><button className="add-dir-btn" onClick={() => setShowSubjectModal(true)}><i className="fas fa-plus"></i></button></div>
              <div className="directory-list">{subjects.map(s => <div key={s.id} className="directory-item"><span>{s.name}</span><button onClick={() => deleteDirectory('subjects', s.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button></div>)}</div>
            </div>
            <div className="directory-card">
              <div className="directory-header"><i className="fas fa-door-open"></i><h3>Аудитории</h3><button className="add-dir-btn" onClick={() => setShowClassroomModal(true)}><i className="fas fa-plus"></i></button></div>
              <div className="directory-list">{classrooms.map(c => <div key={c.id} className="directory-item"><span>{c.name}</span><button onClick={() => handleDeleteClassroom(c.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button></div>)}</div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'users' && canManageUsers) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left"><h2><i className="fas fa-users-cog"></i> Управление пользователями</h2></div>
            <button className="action-button primary" onClick={() => setShowRegister(true)}><i className="fas fa-user-plus"></i> Создать</button>
          </div>
          <div className="users-section">
            <h3>Список пользователей</h3>
            <div className="users-list">
              {users.map(u => (
                <div key={u.id} className="user-card">
                  <div className="user-avatar"><i className={`fas ${u.role === 'admin' ? 'fa-crown' : u.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div>
                  <div className="user-details"><div className="user-name">{u.full_name}</div><div className="user-meta">@{u.username} • {ROLES[u.role]}{u.group_name && ` • Группа: ${u.group_name}`}</div></div>
                  {u.id !== user?.id && <button onClick={() => { if (confirm('Удалить?')) { fetch(`/api/users?id=${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => loadUsers()); } }} className="delete-user-btn"><i className="fas fa-trash-alt"></i></button>}
                </div>
              ))}
            </div>
          </div>
          <div className="teachers-link-section">
            <h3>Привязка преподавателей</h3>
            <div className="teachers-link-list">
              {teachers.map(teacher => {
                const linkedUser = users.find(u => u.id === teacher.user_id);
                const isLinked = !!teacher.user_id;
                return (
                  <div key={teacher.id} className="teacher-link-card">
                    <div className="teacher-info">
                      <span className="teacher-name"><i className="fas fa-chalkboard-teacher"></i> {teacher.name}</span>
                      {isLinked ? <span className="linked-badge"><i className="fas fa-check-circle"></i> Привязан: {linkedUser?.full_name}</span>
                        : <span className="unlinked-badge"><i className="fas fa-exclamation-triangle"></i> Не привязан</span>}
                    </div>
                    {!isLinked ? (
                      <div className="link-controls">
                        <SearchableSelect
                          options={users.filter(u => u.role === 'teacher' && !teachers.some(t => t.user_id === u.id)).map(u => ({ value: String(u.id), label: `${u.full_name} (@${u.username})` }))}
                          value="" onChange={(val) => {
                            if (val) {
                              fetch('/api/teachers/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ teacherId: teacher.id, userId: parseInt(val) }) })
                                .then(r => r.json()).then(d => { if (res.ok) { showNotification('Привязан', 'success'); loadUsers(); loadData(); } else showNotification(d.error, 'error'); });
                            }
                          }}
                          placeholder="Выберите пользователя" label="" icon="fas fa-user" />
                      </div>
                    ) : (
                      <button onClick={() => {
                        fetch(`/api/teachers/link?teacherId=${teacher.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                          .then(() => { showNotification('Привязка удалена'); loadUsers(); loadData(); });
                      }} className="unlink-button"><i className="fas fa-unlink"></i> Отвязать</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'requests' && user?.role === 'admin') {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left"><h2><i className="fas fa-clipboard-list"></i> Заявки на изменение</h2></div>
            <button className="action-button" onClick={loadChangeRequests}><i className="fas fa-sync-alt"></i> Обновить</button>
          </div>
          <ChangeRequestList 
            requests={changeRequests} 
            onApprove={handleApproveRequest} 
            onReject={handleRejectRequest} 
            loading={loadingRequests}
          />
        </div>
      );
    }

    return null;
  };

  // ---------- Страница загрузки / лендинг ----------
  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="spinner-large"></div>
        <p>Загрузка системы...</p>
        <button className="theme-toggle-loading" onClick={toggleTheme}>
          <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i> {theme === 'light' ? 'Тёмная' : 'Светлая'} тема
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
        <div className="landing-page">
          <div className="landing-content">
            <div className="landing-hero">
              <div className="hero-badge"><span><i className="fas fa-calendar-alt"></i> Расписание</span></div>
              <h1 className="hero-title">Управление<br/><span className="gradient-highlight">Расписанием</span></h1>
              <p className="hero-description">Система для создания, просмотра и управления расписанием занятий</p>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => setShowLogin(true)}><i className="fas fa-sign-in-alt"></i> Войти</button>
                <button className="btn-secondary" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i> {theme === 'light' ? 'Тёмная' : 'Светлая'} тема</button>
              </div>
            </div>
            <PublicScheduleView schedule={schedule} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms} loading={loading} loadScheduleForWeek={loadScheduleForWeek} />
          </div>
        </div>
        {showLogin && createPortal(
          <div className="modal" onClick={() => setShowLogin(false)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h2>Вход</h2><button className="modal-close" onClick={() => setShowLogin(false)}><i className="fas fa-times"></i></button></div>
              <form onSubmit={handleLogin} className="modal-form">
                <div className="form-group"><label>Логин</label><input type="text" value={loginData.username} onChange={e => setLoginData({ ...loginData, username: e.target.value })} required /></div>
                <div className="form-group"><label>Пароль</label><input type="password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} required /></div>
                <button type="submit" className="submit-btn">Войти</button>
              </form>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><i className="fas fa-calendar-alt"></i><span className="brand-name">Расписание</span><button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}><i className="fas fa-times"></i></button></div>
        <div className="sidebar-profile"><div className="profile-avatar"><i className={`fas ${user.role === 'admin' ? 'fa-crown' : user.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div><div className="profile-info"><div className="profile-name">{user.fullName}</div><div className="profile-role">{ROLES[user.role]}</div></div></div>
        <nav className="sidebar-nav">
          {!isTeacher && <button className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); }}><i className="fas fa-calendar-week"></i><span>Расписание</span></button>}
          {isTeacher && <button className={`nav-item ${activeTab === 'my-lessons' ? 'active' : ''}`} onClick={() => { setActiveTab('my-lessons'); setSidebarOpen(false); }}><i className="fas fa-chalkboard-teacher"></i><span>Мои занятия</span></button>}
          {canEditSchedule && <>
            <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}><i className="fas fa-edit"></i><span>Управление</span></button>
            <button className={`nav-item ${activeTab === 'template' ? 'active' : ''}`} onClick={() => { setActiveTab('template'); setSidebarOpen(false); }}><i className="fas fa-layer-group"></i><span>Шаблон</span></button>
            <button className={`nav-item ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => { setActiveTab('directories'); setSidebarOpen(false); }}><i className="fas fa-database"></i><span>Справочники</span></button>
          </>}
          {user?.role === 'admin' && <>
            <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}><i className="fas fa-users-cog"></i><span>Пользователи</span></button>
            <button className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => { setActiveTab('requests'); setSidebarOpen(false); loadChangeRequests(); }}><i className="fas fa-clipboard-list"></i><span>Заявки</span></button>
          </>}
        </nav>
        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i><span>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</span></button>
          <button className="logout-btn" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i><span>Выйти</span></button>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <main className="app-main">
        <header className="app-header">
          <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)}><i className="fas fa-bars"></i></button>
          <div className="header-title"><h1>{isTeacher ? 'Мои занятия' : activeTab === 'schedule' ? 'Расписание занятий' : activeTab === 'manage-schedule' ? 'Управление' : activeTab === 'template' ? 'Шаблон' : activeTab === 'directories' ? 'Справочники' : activeTab === 'users' ? 'Пользователи' : activeTab === 'requests' ? 'Заявки' : 'Расписание'}</h1></div>
          <div className="header-actions-right"><button className="theme-toggle-header" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button><div className="role-badge">{ROLES[user.role]}</div></div>
        </header>
        <div className="app-content">{renderMainContent()}</div>
      </main>

      {/* Модальное окно редактирования занятия */}
      {showEditModal && editingLesson && createPortal(
        <div className="modal" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-calendar-plus"></i> {editingLesson.id ? 'Редактировать занятие' : 'Добавить занятие'}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSaveLesson} className="modal-form">
              <div className="form-group">
                <label>Группа *</label>
                <select value={editingLesson.group_id || ''} onChange={e => setEditingLesson({...editingLesson, group_id: e.target.value})} required>
                  <option value="">Выберите группу</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Предмет *</label>
                <select value={editingLesson.subject_id || ''} onChange={e => setEditingLesson({...editingLesson, subject_id: e.target.value})} required>
                  <option value="">Выберите предмет</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Преподаватель *</label>
                <select value={editingLesson.teacher_id || ''} onChange={e => setEditingLesson({...editingLesson, teacher_id: e.target.value})} required>
                  <option value="">Выберите преподавателя</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Аудитория</label>
                <select value={editingLesson.classroom_id || ''} onChange={e => setEditingLesson({...editingLesson, classroom_id: e.target.value})}>
                  <option value="">Не выбрана</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>День недели *</label>
                  <select value={editingLesson.day_of_week || '1'} onChange={e => setEditingLesson({...editingLesson, day_of_week: e.target.value})} required>
                    {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Пара *</label>
                  <select value={editingLesson.pair_number || '1'} onChange={e => setEditingLesson({...editingLesson, pair_number: e.target.value})} required>
                    {PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}
                  </select>
                </div>
              </div>
              {!editingLesson.apply_all && (
                <div className="form-group">
                  <label>Дата занятия *</label>
                  <input type="date" value={editingLesson.date || ''} onChange={e => setEditingLesson({...editingLesson, date: e.target.value})} required={!editingLesson.apply_all} />
                </div>
              )}
              {canEditSchedule && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingLesson.apply_all || false} onChange={e => setEditingLesson({...editingLesson, apply_all: e.target.checked})} />
                    <span>Применить для всех недель (шаблон)</span>
                  </label>
                </div>
              )}
              <button type="submit" className="submit-btn">
                <i className="fas fa-save"></i> {editingLesson.id ? 'Сохранить изменения' : 'Добавить занятие'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Модальное окно заявки на изменение */}
      {showChangeRequestModal && changeRequestLesson && createPortal(
        <div className="modal" onClick={() => setShowChangeRequestModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2><i className="fas fa-paper-plane"></i> Заявка на изменение</h2>
              <button className="modal-close" onClick={() => setShowChangeRequestModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSubmitChangeRequest} className="modal-form">
              <div className="form-group">
                <label>Тип заявки</label>
                <select name="request_type" required>
                  <option value="cancel">Отмена занятия</option>
                  <option value="change">Изменение</option>
                  <option value="replace">Замена преподавателя</option>
                </select>
              </div>
              <div style={{ background: 'var(--surface-muted)', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.85rem' }}>
                <p><strong>Занятие:</strong> {changeRequestLesson.subject_name}</p>
                <p><strong>День:</strong> {DAYS[changeRequestLesson.day_of_week - 1]}</p>
                <p><strong>Пара:</strong> {changeRequestLesson.pair_number}</p>
                {changeRequestLesson.date && <p><strong>Дата:</strong> {formatDateRu(changeRequestLesson.date)}</p>}
              </div>
              <div className="form-group">
                <label>Новый преподаватель</label>
                <select name="new_teacher_id">
                  <option value="">Не менять</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Новый предмет</label>
                <select name="new_subject_id">
                  <option value="">Не менять</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Новая аудитория</label>
                <select name="new_classroom_id">
                  <option value="">Не менять</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Новая пара</label>
                <select name="new_pair_number">
                  <option value="">Не менять</option>
                  {PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Новый день недели</label>
                <select name="new_day_of_week">
                  <option value="">Не менять</option>
                  {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Причина</label>
                <textarea name="reason" rows="3" placeholder="Опишите причину изменений" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}></textarea>
              </div>
              <button type="submit" className="submit-btn">
                <i className="fas fa-paper-plane"></i> Отправить заявку
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Модальное окно отчёта для админа */}
      {showTeacherReportModal && user?.role === 'admin' && createPortal(
        <TeacherReportModal 
          teachers={teachers} 
          schedule={schedule} 
          onClose={() => setShowTeacherReportModal(false)} 
          onGenerate={(teacherId, dateFrom, dateTo) => generateTeacherReport(teacherId, dateFrom, dateTo)}
          isTeacher={false}
          currentTeacherId={null}
        />,
        document.body
      )}

      {/* Модальное окно отчёта для преподавателя */}
      {showTeacherReportModal && isTeacher && createPortal(
        <TeacherReportModal 
          teachers={teachers} 
          schedule={schedule} 
          onClose={() => setShowTeacherReportModal(false)} 
          onGenerate={(teacherId, dateFrom, dateTo) => generateTeacherReport(teacherId, dateFrom, dateTo)}
          isTeacher={true}
          currentTeacherId={teachers.find(t => t.user_id === user?.id)?.id}
        />,
        document.body
      )}

      {/* Остальные модальные окна */}
      {showRegister && createPortal(
        <div className="modal" onClick={() => setShowRegister(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Создать пользователя</h2><button className="modal-close" onClick={() => setShowRegister(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={handleRegister} className="modal-form">
              <div className="form-group"><label>Логин</label><input value={registerData.username} onChange={e => setRegisterData({...registerData, username: e.target.value})} required /></div>
              <div className="form-group"><label>Пароль</label><input type="password" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} required /></div>
              <div className="form-group"><label>ФИО</label><input value={registerData.fullName} onChange={e => setRegisterData({...registerData, fullName: e.target.value})} required /></div>
              <div className="form-group"><label>Роль</label><select value={registerData.role} onChange={e => setRegisterData({...registerData, role: e.target.value})}><option value="student">Студент</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select></div>
              {registerData.role === 'student' && <div className="form-group"><label>Группа</label><select value={registerData.groupId} onChange={e => setRegisterData({...registerData, groupId: e.target.value})}><option value="">Выберите</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>}
              <button type="submit" className="submit-btn">Создать</button>
            </form>
          </div>
        </div>,
        document.body
      )}
      {showGroupModal && createPortal(
        <div className="modal" onClick={() => setShowGroupModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Добавить группу</h2><button className="modal-close" onClick={() => setShowGroupModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={e => { e.preventDefault(); addDirectory('groups', newGroup, setShowGroupModal, setNewGroup); }} className="modal-form"><div className="form-group"><label>Название</label><input value={newGroup} onChange={e => setNewGroup(e.target.value)} required /></div><button type="submit" className="submit-btn">Добавить</button></form>
          </div>
        </div>,
        document.body
      )}
      {showTeacherModal && createPortal(
        <div className="modal" onClick={() => setShowTeacherModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Добавить преподавателя</h2><button className="modal-close" onClick={() => setShowTeacherModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={e => { e.preventDefault(); addDirectory('teachers', newTeacher, setShowTeacherModal, setNewTeacher); }} className="modal-form"><div className="form-group"><label>ФИО</label><input value={newTeacher} onChange={e => setNewTeacher(e.target.value)} required /></div><button type="submit" className="submit-btn">Добавить</button></form>
          </div>
        </div>,
        document.body
      )}
      {showSubjectModal && createPortal(
        <div className="modal" onClick={() => setShowSubjectModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Добавить предмет</h2><button className="modal-close" onClick={() => setShowSubjectModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={e => { e.preventDefault(); addDirectory('subjects', newSubject, setShowSubjectModal, setNewSubject); }} className="modal-form"><div className="form-group"><label>Название</label><input value={newSubject} onChange={e => setNewSubject(e.target.value)} required /></div><button type="submit" className="submit-btn">Добавить</button></form>
          </div>
        </div>,
        document.body
      )}
      {showClassroomModal && createPortal(
        <div className="modal" onClick={() => setShowClassroomModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Добавить аудиторию</h2><button className="modal-close" onClick={() => setShowClassroomModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={handleAddClassroom} className="modal-form"><div className="form-group"><label>Номер</label><input value={newClassroom} onChange={e => setNewClassroom(e.target.value)} required /></div><button type="submit" className="submit-btn">Добавить</button></form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function HomeClient() {
  return (
    <ThemeProvider>
      <HomeContent />
    </ThemeProvider>
  );
}