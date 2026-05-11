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
    return null;
  } catch (e) { return null; }
};

const formatForInput = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    const parsed = parseLocalDate(date);
    if (parsed && !isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDateRu = (dateString) => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') date = parseLocalDate(date);
  if (!date || isNaN(date.getTime())) return '';
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
const ScheduleGrid = React.memo(({ data, canEdit, onEditClick, onDeleteClick, onAddClick, weekDates, isLoading }) => {
  const matrix = useMemo(() => {
    const m = Array(7).fill().map(() => Array(6).fill().map(() => []));
    (Array.isArray(data) ? data : []).forEach(l => {
      const di = l.day_of_week - 1, pi = l.pair_number - 1;
      if (di >= 0 && di < 7 && pi >= 0 && pi < 6) m[di][pi].push(l);
    });
    return m;
  }, [data]);

  return (
    <div className={`schedule-grid-wrapper ${isLoading ? 'loading' : ''}`}>
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header"><i className="fas fa-clock"></i> Время</th>
            {DAYS.map((day, idx) => {
              const d = weekDates?.[idx];
              const isToday = d?.toDateString() === new Date().toDateString();
              return (
                <th key={day} className={`day-header ${isToday ? 'today' : ''} ${idx > 4 ? 'weekend' : ''}`}>
                  <span>{day}</span><br/><small>{d ? formatDate(d) : ''}</small>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot"><strong>{pair.name}</strong><br/>{pair.time}</td>
              {DAYS.map((_, di) => {
                const lessons = matrix[di][pair.number - 1];
                const d = weekDates?.[di];
                const isToday = d?.toDateString() === new Date().toDateString();
                return (
                  <td key={`${di}-${pair.number}`} className={`lesson-cell ${lessons.length ? 'has-lessons' : 'empty'} ${isToday ? 'today-column' : ''}`}>
                    {lessons.length > 0 ? (
                      <div className="lessons-container">
                        {lessons.map((lesson, i) => (
                          <div key={i} className={`lesson-card-modern ${lesson.source === 'cancelled' ? 'cancelled' : ''}`}>
                            <div><strong>{lesson.subject_name}</strong> <small>{lesson.group_name}</small></div>
                            <div><i className="fas fa-chalkboard-teacher"></i> {lesson.teacher_name}</div>
                            {lesson.classroom_name && <div><i className="fas fa-door-open"></i> {lesson.classroom_name}</div>}
                            {lesson.date && <div><i className="fas fa-calendar-alt"></i> {formatDateRu(lesson.date)}</div>}
                            {lesson.notes && <div className="lesson-notes-badge">{lesson.notes.substring(0, 35)}</div>}
                            {lesson.source && lesson.source !== 'template' && (
                              <span className={`lesson-status-badge status-${lesson.source}`}>
                                {lesson.source === 'cancelled' ? '❌ Отменено' : lesson.source === 'modified' ? '✏️ Изменено' : lesson.source === 'added' ? '➕ Добавлено' : ''}
                              </span>
                            )}
                            {canEdit && (
                              <div className="lesson-actions-modern">
                                <button onClick={() => onEditClick(lesson)}><i className="fas fa-edit"></i></button>
                                <button onClick={() => onDeleteClick(lesson)}><i className="fas fa-trash-alt"></i></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : canEdit ? (
                      <button className="add-lesson-btn" onClick={() => onAddClick({ day_of_week: di + 1, pair_number: pair.number, date: d ? formatForInput(d) : '' })}>
                        <i className="fas fa-plus"></i>
                      </button>
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
});

// ---------- FilterSection ----------
const FilterSection = ({ filters, onFilterChange, groups, teachers, subjects, classrooms, onReset, onOpenCalendar, currentDate, onPrevWeek, onNextWeek, onCurrentWeek, showGroupFilter, selectedGroupId, onGroupChange, isLoading }) => {
  const wd = getWeekDates(currentDate);
  return (
    <div className="filter-section">
      <div className="filter-section-header">
        <div className="week-navigation">
          <button onClick={onOpenCalendar} disabled={isLoading}><i className="fas fa-calendar-alt"></i></button>
          <button onClick={onPrevWeek} disabled={isLoading}><i className="fas fa-chevron-left"></i></button>
          <span className="week-display">{formatDate(wd[0])} - {formatDate(wd[6])} ({getWeekNumber(wd[0])} нед.)</span>
          <button onClick={onNextWeek} disabled={isLoading}><i className="fas fa-chevron-right"></i></button>
          <button onClick={onCurrentWeek} disabled={isLoading}>Сегодня</button>
        </div>
        <button onClick={onReset}>Сбросить</button>
      </div>
      <div className="filter-grid">
        {showGroupFilter && <SearchableSelect options={groups?.map(g => ({ value: String(g.id), label: g.name })) || []} value={selectedGroupId || filters.groupId} onChange={v => { onGroupChange?.(v); onFilterChange('groupId', v); }} placeholder="Группа" label="Группа" icon="fas fa-users" />}
        <SearchableSelect options={teachers?.map(t => ({ value: String(t.id), label: t.name })) || []} value={filters.teacherId} onChange={v => onFilterChange('teacherId', v)} placeholder="Преподаватель" label="Преподаватель" icon="fas fa-chalkboard-teacher" />
        <SearchableSelect options={subjects?.map(s => ({ value: String(s.id), label: s.name })) || []} value={filters.subjectId} onChange={v => onFilterChange('subjectId', v)} placeholder="Предмет" label="Предмет" icon="fas fa-book" />
        <SearchableSelect options={DAYS.map((d, i) => ({ value: String(i + 1), label: d }))} value={filters.dayOfWeek} onChange={v => onFilterChange('dayOfWeek', v)} placeholder="День" label="День" icon="fas fa-calendar-day" />
        <SearchableSelect options={PAIRS.map(p => ({ value: String(p.number), label: `${p.name} (${p.time})` }))} value={filters.pairNumber} onChange={v => onFilterChange('pairNumber', v)} placeholder="Пара" label="Пара" icon="fas fa-clock" />
        <SearchableSelect options={classrooms?.map(c => ({ value: String(c.id), label: c.name })) || []} value={filters.classroomId} onChange={v => onFilterChange('classroomId', v)} placeholder="Аудитория" label="Аудитория" icon="fas fa-door-open" />
      </div>
    </div>
  );
};

// ---------- ScheduleView ----------
const ScheduleView = ({ schedule, groups, teachers, subjects, classrooms, loading, userRole, userGroupId, loadScheduleForWeek }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasFilter, setHasFilter] = useState(userRole === 'student');
  const [selectedGroupId, setSelectedGroupId] = useState(userRole === 'student' ? userGroupId : null);
  const [filters, setFilters] = useState({ groupId: userRole === 'student' ? String(userGroupId || '') : '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' });

  const wd = getWeekDates(currentDate);

  const loadRef = useRef(loadScheduleForWeek);
  useEffect(() => { loadRef.current = loadScheduleForWeek; }, [loadScheduleForWeek]);

  useEffect(() => {
    if (wd.length && hasFilter) loadRef.current(formatForInput(wd[0]), formatForInput(wd[6]), selectedGroupId || filters.groupId);
  }, [wd, selectedGroupId, filters.groupId, hasFilter]);

  const filtered = useMemo(() => {
    let f = [...schedule];
    if (filters.teacherId) f = f.filter(s => s.teacher_id === parseInt(filters.teacherId));
    if (filters.subjectId) f = f.filter(s => s.subject_id === parseInt(filters.subjectId));
    if (filters.dayOfWeek) f = f.filter(s => s.day_of_week === parseInt(filters.dayOfWeek));
    if (filters.pairNumber) f = f.filter(s => s.pair_number === parseInt(filters.pairNumber));
    if (filters.classroomId) f = f.filter(s => s.classroom_id === parseInt(filters.classroomId));
    return f;
  }, [schedule, filters]);

  if (loading) return <div className="loading-state"><div className="spinner"></div></div>;

  return (
    <div>
      <FilterSection filters={filters} onFilterChange={(k, v) => { if (k === 'groupId') setSelectedGroupId(v); setFilters(p => ({ ...p, [k]: v })); setHasFilter(true); }}
        groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms}
        onReset={() => { setFilters({ groupId: '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' }); setSelectedGroupId(null); setHasFilter(false); }}
        onOpenCalendar={() => setShowCalendar(true)} currentDate={currentDate}
        onPrevWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
        onNextWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
        onCurrentWeek={() => setCurrentDate(new Date())}
        showGroupFilter={userRole !== 'student'} selectedGroupId={selectedGroupId} onGroupChange={setSelectedGroupId} />
      {showCalendar && createPortal(<div className="datepicker-overlay" onClick={() => setShowCalendar(false)}><DatePicker onDateSelect={d => { setCurrentDate(d); setShowCalendar(false); }} onClose={() => setShowCalendar(false)} selectedDate={currentDate} /></div>, document.body)}
      {!hasFilter ? <div className="filter-placeholder"><i className="fas fa-filter"></i><h3>Выберите параметры</h3></div>
        : filtered.length === 0 ? <div className="empty-state"><i className="fas fa-search"></i><p>Нет занятий</p></div>
        : <ScheduleGrid data={filtered} weekDates={wd} />}
    </div>
  );
};

// ---------- PublicScheduleView ----------
const PublicScheduleView = ({ schedule, groups, teachers, subjects, classrooms, loading, loadScheduleForWeek }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasFilter, setHasFilter] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [filters, setFilters] = useState({ groupId: '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' });
  const wd = getWeekDates(currentDate);
  const loadRef = useRef(loadScheduleForWeek);
  useEffect(() => { loadRef.current = loadScheduleForWeek; }, [loadScheduleForWeek]);
  useEffect(() => { if (wd.length && hasFilter) loadRef.current(formatForInput(wd[0]), formatForInput(wd[6]), selectedGroupId || filters.groupId); }, [wd, selectedGroupId, filters.groupId, hasFilter]);

  const filtered = useMemo(() => {
    let f = [...schedule];
    if (filters.teacherId) f = f.filter(s => s.teacher_id === parseInt(filters.teacherId));
    if (filters.subjectId) f = f.filter(s => s.subject_id === parseInt(filters.subjectId));
    if (filters.dayOfWeek) f = f.filter(s => s.day_of_week === parseInt(filters.dayOfWeek));
    if (filters.pairNumber) f = f.filter(s => s.pair_number === parseInt(filters.pairNumber));
    if (filters.classroomId) f = f.filter(s => s.classroom_id === parseInt(filters.classroomId));
    return f;
  }, [schedule, filters]);

  if (loading) return <div className="loading-state"><div className="spinner"></div></div>;

  return (
    <div>
      <FilterSection filters={filters} onFilterChange={(k, v) => { if (k === 'groupId') setSelectedGroupId(v); setFilters(p => ({ ...p, [k]: v })); setHasFilter(true); }}
        groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms}
        onReset={() => { setFilters({ groupId: '', teacherId: '', subjectId: '', dayOfWeek: '', pairNumber: '', classroomId: '' }); setSelectedGroupId(null); setHasFilter(false); }}
        onOpenCalendar={() => setShowCalendar(true)} currentDate={currentDate}
        onPrevWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
        onNextWeek={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
        onCurrentWeek={() => setCurrentDate(new Date())}
        showGroupFilter={true} selectedGroupId={selectedGroupId} onGroupChange={setSelectedGroupId} />
      {showCalendar && createPortal(<div className="datepicker-overlay" onClick={() => setShowCalendar(false)}><DatePicker onDateSelect={d => { setCurrentDate(d); setShowCalendar(false); }} onClose={() => setShowCalendar(false)} selectedDate={currentDate} /></div>, document.body)}
      {!hasFilter ? <div className="filter-placeholder"><i className="fas fa-filter"></i><h3>Выберите параметры</h3></div>
        : filtered.length === 0 ? <div className="empty-state"><i className="fas fa-search"></i><p>Нет занятий</p></div>
        : <ScheduleGrid data={filtered} weekDates={wd} />}
    </div>
  );
};

// ---------- TeacherPanel ----------
const TeacherPanel = ({ data, localData, hasChanges, saving, onNotesChange, onSave, onCancel, currentDate, onPrevWeek, onNextWeek, onCurrentWeek }) => {
  const wd = getWeekDates(currentDate || new Date());
  const matrix = useMemo(() => {
    const m = Array(7).fill().map(() => Array(6).fill().map(() => []));
    (Array.isArray(data) ? data : []).forEach(l => {
      const di = l.day_of_week - 1, pi = l.pair_number - 1;
      if (di >= 0 && di < 7 && pi >= 0 && pi < 6) m[di][pi].push(l);
    });
    return m;
  }, [data]);

  return (
    <div className="schedule-grid-wrapper">
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1rem', flexWrap: 'wrap', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onPrevWeek} className="week-nav-btn"><i className="fas fa-chevron-left"></i> Пред.</button>
        <span className="week-display" style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '2rem' }}>
          <i className="fas fa-calendar-week"></i> {formatDate(wd[0])} - {formatDate(wd[6])} ({getWeekNumber(wd[0])} нед.)
        </span>
        <button onClick={onNextWeek} className="week-nav-btn">След. <i className="fas fa-chevron-right"></i></button>
        <button onClick={onCurrentWeek} className="week-today-btn"><i className="fas fa-calendar-day"></i> Сегодня</button>
      </div>
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header"><i className="fas fa-clock"></i> Время</th>
            {DAYS.map((day, idx) => {
              const d = wd[idx];
              const isToday = d?.toDateString() === new Date().toDateString();
              return <th key={day} className={`day-header ${isToday ? 'today' : ''} ${idx > 4 ? 'weekend' : ''}`}><span>{day}</span><br/><small>{d ? formatDate(d) : ''}</small></th>;
            })}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot"><strong>{pair.name}</strong><br/>{pair.time}</td>
              {DAYS.map((_, di) => {
                const lessons = matrix[di][pair.number - 1];
                const d = wd[di];
                const isToday = d?.toDateString() === new Date().toDateString();
                return (
                  <td key={`${di}-${pair.number}`} className={`lesson-cell ${lessons.length ? 'has-lessons' : 'empty'} ${isToday ? 'today-column' : ''}`}>
                    {lessons.length > 0 ? (
                      <div className="teacher-lessons-container">
                        {lessons.map((lesson, i) => {
                          const cur = localData[lesson.id] || { notes: lesson.notes || '' };
                          const changed = hasChanges[lesson.id];
                          const isSaving = saving[lesson.id];
                          return (
                            <div key={i} className="teacher-lesson-card">
                              <div><strong>{lesson.subject_name}</strong> <small>{lesson.group_name}</small> {changed && <span className="unsaved-badge">●</span>}</div>
                              <div><i className="fas fa-door-open"></i> {lesson.classroom_name || '—'}</div>
                              {lesson.date && <div><i className="fas fa-calendar-alt"></i> {formatDateRu(lesson.date)}</div>}
                              <textarea placeholder="Заметки..." value={cur.notes || ''} onChange={e => onNotesChange(lesson.id, e.target.value)} rows="2" disabled={isSaving} className="teacher-notes-textarea" />
                              {changed && (
                                <div className="teacher-actions-modern">
                                  <button onClick={() => onCancel(lesson.id)} className="teacher-action-btn cancel">Отмена</button>
                                  <button onClick={() => onSave(lesson)} className="teacher-action-btn save">{isSaving ? '...' : 'Сохранить'}</button>
                                </div>
                              )}
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
  const [tid, setTid] = useState('');
  const [gen, setGen] = useState(false);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Отчет по часам</h2><button onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-form">
          <SearchableSelect options={teachers?.map(t => ({ value: String(t.id), label: t.name })) || []} value={tid} onChange={setTid} placeholder="Преподаватель" label="Преподаватель" icon="fas fa-chalkboard-teacher" />
          <button className="submit-btn" onClick={async () => { setGen(true); await onGenerate(tid); setGen(false); onClose(); }} disabled={gen}>{gen ? 'Формирование...' : 'Сформировать'}</button>
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
  const [notif, setNotif] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [showReport, setShowReport] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  const [showSubject, setShowSubject] = useState(false);
  const [showClassroom, setShowClassroom] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', password: '', fullName: '', role: 'student', groupId: '' });
  const [editing, setEditing] = useState(null);
  const [newGroup, setNewGroup] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newClassroom, setNewClassroom] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [manageDate, setManageDate] = useState(new Date());
  const [teacherDate, setTeacherDate] = useState(new Date());
  const [localData, setLocalData] = useState({});
  const [hasChanges, setHasChanges] = useState({});
  const [saving, setSaving] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const showNotification = (msg, type = 'success') => { setNotif({ msg, type }); setTimeout(() => setNotif(null), 3000); };
  const canEditSchedule = user && ['admin', 'methodist'].includes(user.role);
  const canManageUsers = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  // ---------- Загрузка расписания ----------
  const loadScheduleForWeek = useCallback(async (start, end, groupId = null, force = false) => {
    if (!token) return;
    const s = typeof start === 'string' ? start : formatForInput(start);
    const e = typeof end === 'string' ? end : formatForInput(end);
    const gid = groupId ?? selectedGroupFilter;
    const key = `${s}|${e}|${gid || ''}`;
    if (force) scheduleCache.delete(key);
    const cached = scheduleCache.get(key);
    if (cached && Date.now() - cached.t < 5000 && !force) { setSchedule(cached.data); return cached.data; }
    let url = `/api/schedule?weekStart=${s}`;
    if (gid) url += `&groupId=${gid}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      scheduleCache.set(key, { data, t: Date.now() });
      setSchedule(data);
      return data;
    } catch (e) { return []; }
  }, [token, selectedGroupFilter]);

  const loadManageSchedule = useCallback(async () => {
    const wd = getWeekDates(manageDate);
    await loadScheduleForWeek(formatForInput(wd[0]), formatForInput(wd[6]), selectedGroupFilter, true);
  }, [manageDate, selectedGroupFilter, loadScheduleForWeek]);

  const loadTeacherSchedule = useCallback(async (date) => {
    if (!token || !isTeacher) return;
    const teacher = teachers.find(t => t.user_id === user?.id);
    if (!teacher) return;
    const wd = getWeekDates(date || teacherDate);
    const url = `/api/schedule?weekStart=${formatForInput(wd[0])}&teacherId=${teacher.id}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      setSchedule(await res.json());
    } catch (e) {}
  }, [token, isTeacher, teachers, user, teacherDate]);

  // ---------- Загрузка справочников ----------
  const loadData = useCallback(async () => {
    try {
      const [gr, tr, sr] = await Promise.all([fetch('/api/groups'), fetch('/api/teachers'), fetch('/api/subjects')]);
      setGroups(await gr.json()); setTeachers(await tr.json()); setSubjects(await sr.json());
      try { const cr = await fetch('/api/classrooms'); if (cr.ok) setClassrooms(await cr.json()); } catch (e) {}
      await loadScheduleForWeek(formatForInput(getMonday(new Date())), null, null, true);
    } catch (e) {} finally { setLoading(false); }
  }, [loadScheduleForWeek]);

  const loadUsers = useCallback(async () => {
    if (!token || !canManageUsers) return;
    try { const r = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) setUsers(await r.json()); } catch (e) {}
  }, [token, canManageUsers]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try { const r = await fetch('/api/schedule/template'); setTemplates(await r.json()); } catch (e) {} finally { setLoadingTemplates(false); }
  }, []);

  // ---------- Отчёты ----------
  const generateReport = useCallback(async (teacherId) => {
    const html2pdf = (await import('html2pdf.js')).default;
    const teacher = teachers.find(t => t.id === parseInt(teacherId));
    if (!teacher) return;
    const lessons = schedule.filter(l => l.teacher_id === teacher.id);
    const el = document.createElement('div');
    el.innerHTML = `<h1>Отчет: ${teacher.name}</h1><p>Занятий: ${lessons.length}</p><p>Часов: ${(lessons.length * 1.5).toFixed(1)}</p>`;
    await html2pdf().set({ filename: `Отчет_${teacher.name}.pdf` }).from(el).save();
  }, [teachers, schedule]);

  const exportExcel = useCallback(() => {
    const data = schedule.map(l => ({
      'Дата': l.date ? formatDateRu(l.date) : '-',
      'День': DAYS[l.day_of_week - 1],
      'Пара': `${l.pair_number} (${PAIRS[l.pair_number - 1].time})`,
      'Группа': l.group_name,
      'Предмет': l.subject_name,
      'Преподаватель': l.teacher_name,
      'Аудитория': l.classroom_name || '—',
      'Заметки': l.notes || '—'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Расписание');
    XLSX.writeFile(wb, `Расписание_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [schedule]);

  // ---------- Аутентификация ----------
  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginData) });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token); setUser(data.user);
      localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
      setShowLogin(false); showNotification(`Добро пожаловать, ${data.user.fullName}!`);
      await loadData(); if (data.user.role === 'admin') loadUsers();
      if (data.user.role === 'teacher') setActiveTab('my-lessons');
    } else showNotification(data.error, 'error');
  };

  const handleLogout = () => {
    setToken(null); setUser(null); localStorage.clear(); scheduleCache.clear();
    setSchedule([]); setActiveTab('schedule');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(registerData) });
    if (res.ok) { showNotification('Создан'); setShowRegister(false); loadUsers(); }
    else { const d = await res.json(); showNotification(d.error, 'error'); }
  };

  // ---------- Справочники ----------
  const addDir = async (type, name, setShow, setVal) => {
    const res = await fetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: name.trim() }) });
    if (res.ok) { showNotification('Добавлено'); setShow(false); setVal(''); loadData(); }
    else { const d = await res.json(); showNotification(d.error, 'error'); }
  };

  const delDir = async (type, id) => {
    if (!confirm('Удалить?')) return;
    await fetch(`/api/${type}?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    showNotification('Удалено'); loadData();
  };

  // ---------- Управление расписанием ----------
  const handleAddClick = useCallback((slot) => {
    setEditing({ id: null, group_id: selectedGroupFilter || '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: String(slot.pair_number), day_of_week: String(slot.day_of_week), date: slot.date || '', apply_all: false, template_id: null, override_id: null });
    setShowEdit(true);
  }, [selectedGroupFilter]);

  const handleEditClick = (lesson) => {
    setEditing({ ...lesson, date: lesson.date || '', apply_all: lesson.source === 'template', template_id: lesson.template_id || null, override_id: lesson.override_id || null });
    setShowEdit(true);
  };

  const handleDeleteClick = (lesson) => {
    if (!canEditSchedule) return;
    const hasOv = lesson.override_id && lesson.source !== 'template';
    let msg = hasOv ? 'Удалить изменение для этой недели?' : (lesson.template_id ? 'ОК — отменить на неделю, Отмена — удалить шаблон' : 'Удалить?');
    const choice = confirm(msg);
    handleDeleteSlot(lesson, hasOv ? false : !choice);
  };

  const handleDeleteSlot = async (lesson, applyAll) => {
    const monday = getMonday(parseLocalDate(lesson.date));
    const body = { group_id: lesson.group_id, pair_number: lesson.pair_number, day_of_week: lesson.day_of_week, week_start_date: formatForInput(monday), apply_all: applyAll, template_id: lesson.template_id || null, override_id: lesson.override_id || null };
    const res = await fetch('/api/schedule/lesson', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { scheduleCache.clear(); showNotification(applyAll ? 'Удалено из шаблона' : 'Отменено'); if (activeTab === 'manage-schedule') loadManageSchedule(); else loadData(); if (activeTab === 'template') loadTemplates(); }
    else { const d = await res.json(); showNotification(d.error, 'error'); }
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (!editing.apply_all && !editing.date) return showNotification('Выберите дату', 'error');
    let ws = null;
    if (!editing.apply_all) { const d = parseLocalDate(editing.date); if (!d) return; ws = formatForInput(getMonday(d)); }
    const body = { group_id: parseInt(editing.group_id), teacher_id: parseInt(editing.teacher_id), subject_id: parseInt(editing.subject_id), classroom_id: editing.classroom_id ? parseInt(editing.classroom_id) : null, pair_number: parseInt(editing.pair_number), day_of_week: parseInt(editing.day_of_week), week_start_date: ws, apply_all: !!editing.apply_all, template_id: editing.template_id || null, override_id: editing.override_id || null };
    const res = await fetch('/api/schedule/lesson', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { scheduleCache.clear(); showNotification(editing.apply_all ? 'Шаблон обновлён' : 'Сохранено'); setShowEdit(false); setEditing(null); if (activeTab === 'manage-schedule') loadManageSchedule(); else loadData(); if (activeTab === 'template') loadTemplates(); }
    else if (res.status === 409) { showNotification(data.error, 'error'); alert(data.error); }
    else showNotification(data.error || 'Ошибка', 'error');
  };

  // ---------- Заметки ----------
  const handleNotesChange = (id, val) => { setLocalData(p => ({ ...p, [id]: { notes: val } })); setHasChanges(p => ({ ...p, [id]: true })); };
  const handleSaveNotes = async (lesson) => {
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
  useEffect(() => { if (activeTab === 'manage-schedule' && token) loadManageSchedule(); }, [activeTab, token]);
  useEffect(() => { if (activeTab === 'template' && canEditSchedule) loadTemplates(); }, [activeTab, canEditSchedule]);
  useEffect(() => { if (isTeacher && teachers.length && user) loadTeacherSchedule(teacherDate); }, [isTeacher, teachers, user, teacherDate]);

  useEffect(() => {
    if (isTeacher && schedule.length && user) {
      const t = teachers.find(tt => tt.user_id === user.id);
      if (t) { const init = {}; schedule.filter(l => l.teacher_id === t.id).forEach(l => { init[l.id] = { notes: l.notes || '' }; }); setLocalData(init); }
    }
  }, [schedule, isTeacher, teachers, user]);

  // ---------- Рендер ----------
  const renderContent = () => {
    if (isTeacher) {
      const t = teachers.find(tt => tt.user_id === user?.id);
      const lessons = t ? schedule.filter(l => l.teacher_id === t.id) : [];
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-chalkboard-teacher"></i> Мои занятия</h2>
            <div className="header-actions">
              {Object.keys(hasChanges).length > 0 && <button className="action-button save-all" onClick={() => Object.keys(hasChanges).forEach(id => { const l = lessons.find(ls => ls.id === parseInt(id)); if (l) handleSaveNotes(l); })}><i className="fas fa-save"></i> Сохранить всё</button>}
              <button className="action-button export-excel" onClick={exportExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button report-hours" onClick={async () => { if (t) generateReport(t.id); }}><i className="fas fa-chart-line"></i> Отчёт</button>
            </div>
          </div>
          {loading ? <div className="loading-state"><div className="spinner"></div></div> :
            <TeacherPanel data={lessons} localData={localData} hasChanges={hasChanges} saving={saving} onNotesChange={handleNotesChange} onSave={handleSaveNotes}
              onCancel={id => { const l = lessons.find(ls => ls.id === id); if (l) { setLocalData(p => ({ ...p, [id]: { notes: l.notes || '' } })); setHasChanges(p => { const n = { ...p }; delete n[id]; return n; }); } }}
              currentDate={teacherDate} onPrevWeek={() => { const d = new Date(teacherDate); d.setDate(d.getDate() - 7); setTeacherDate(d); }}
              onNextWeek={() => { const d = new Date(teacherDate); d.setDate(d.getDate() + 7); setTeacherDate(d); }}
              onCurrentWeek={() => setTeacherDate(new Date())} />}
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
              <button className="action-button export-excel" onClick={exportExcel}><i className="fas fa-file-excel"></i> Excel</button>
              {user?.role === 'admin' && <button className="action-button report-hours" onClick={() => setShowReport(true)}><i className="fas fa-chart-line"></i> Отчёт</button>}
            </div>
          </div>
          <ScheduleView schedule={ds} groups={groups} teachers={teachers} subjects={subjects} classrooms={classrooms} loading={loading} userRole={user?.role} userGroupId={user?.groupId} loadScheduleForWeek={loadScheduleForWeek} />
        </div>
      );
    }

    if (activeTab === 'manage-schedule' && canEditSchedule) {
      const wd = getWeekDates(manageDate);
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-edit"></i> Управление</h2>
            <div className="header-actions">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { const d = new Date(manageDate); d.setDate(d.getDate() - 7); setManageDate(d); }}><i className="fas fa-chevron-left"></i></button>
                <span style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '2rem' }}>{formatDate(wd[0])} - {formatDate(wd[6])} ({getWeekNumber(wd[0])} нед.)</span>
                <button onClick={() => { const d = new Date(manageDate); d.setDate(d.getDate() + 7); setManageDate(d); }}><i className="fas fa-chevron-right"></i></button>
                <button onClick={() => setManageDate(new Date())}>Сегодня</button>
              </div>
              <select value={selectedGroupFilter} onChange={e => setSelectedGroupFilter(e.target.value)}><option value="">Все группы</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <button className="action-button export-excel" onClick={exportExcel}>Excel</button>
            </div>
          </div>
          <ScheduleGrid data={schedule} canEdit={true} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onAddClick={handleAddClick} weekDates={wd} />
        </div>
      );
    }

    if (activeTab === 'template' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-layer-group"></i> Шаблон</h2>
            <button className="action-button primary" onClick={() => { setEditing({ id: null, group_id: '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: '1', day_of_week: '1', date: '', apply_all: true, template_id: null, override_id: null }); setShowEdit(true); }}><i className="fas fa-plus"></i> Добавить</button>
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
            {[{ icon: 'fa-users', title: 'Группы', data: groups, show: setShowGroup, newVal: newGroup, setNew: setNewGroup, type: 'groups' },
              { icon: 'fa-chalkboard-teacher', title: 'Преподаватели', data: teachers, show: setShowTeacher, newVal: newTeacher, setNew: setNewTeacher, type: 'teachers' },
              { icon: 'fa-book', title: 'Предметы', data: subjects, show: setShowSubject, newVal: newSubject, setNew: setNewSubject, type: 'subjects' },
              { icon: 'fa-door-open', title: 'Аудитории', data: classrooms, show: setShowClassroom, newVal: newClassroom, setNew: setNewClassroom, type: 'classrooms' }
            ].map(card => (
              <div key={card.type} className="directory-card">
                <div className="directory-header"><i className={`fas ${card.icon}`}></i><h3>{card.title}</h3><button className="add-dir-btn" onClick={() => card.show(true)}><i className="fas fa-plus"></i></button></div>
                <div className="directory-list">{card.data.map(item => <div key={item.id} className="directory-item"><span>{item.name}</span><button onClick={() => delDir(card.type, item.id)}><i className="fas fa-trash-alt"></i></button></div>)}</div>
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

  // ---------- Страница загрузки ----------
  if (authChecking) return <div className="loading-screen"><div className="spinner-large"></div><p>Загрузка...</p></div>;

  // ---------- Лендинг ----------
  if (!user) {
    return (
      <>
        {notif && <div className={`toast toast-${notif.type}`}>{notif.msg}</div>}
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

  // ---------- Основной интерфейс ----------
  return (
    <div className="app-container">
      {notif && <div className={`toast toast-${notif.type}`}>{notif.msg}</div>}
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
        <div className="app-content">{renderContent()}</div>
      </main>

      {/* Модальные окна */}
      {showEdit && editing && createPortal(<div className="modal" onClick={() => setShowEdit(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>{editing.id ? 'Редактировать' : 'Добавить'}</h2><button onClick={() => setShowEdit(false)}><i className="fas fa-times"></i></button></div><form onSubmit={handleSaveLesson} className="modal-form">
        <div className="form-group"><label>Группа *</label><select value={editing.group_id} onChange={e => setEditing(p => ({ ...p, group_id: e.target.value }))} required><option value="">Выберите</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div className="form-group"><label>Предмет *</label><select value={editing.subject_id} onChange={e => setEditing(p => ({ ...p, subject_id: e.target.value }))} required><option value="">Выберите</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="form-group"><label>Преподаватель *</label><select value={editing.teacher_id} onChange={e => setEditing(p => ({ ...p, teacher_id: e.target.value }))} required><option value="">Выберите</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="form-group"><label>Аудитория</label><select value={editing.classroom_id || ''} onChange={e => setEditing(p => ({ ...p, classroom_id: e.target.value }))}><option value="">Не выбрана</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 1 }}><label>День *</label><select value={editing.day_of_week} onChange={e => setEditing(p => ({ ...p, day_of_week: e.target.value }))}>{DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}</select></div>
          <div className="form-group" style={{ flex: 1 }}><label>Пара *</label><select value={editing.pair_number} onChange={e => setEditing(p => ({ ...p, pair_number: e.target.value }))}>{PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}</select></div>
        </div>
        {!editing.apply_all && <div className="form-group"><label>Дата *</label><input type="date" value={editing.date || ''} onChange={e => setEditing(p => ({ ...p, date: e.target.value }))} required /></div>}
        <div className="form-group"><label><input type="checkbox" checked={editing.apply_all || false} onChange={e => setEditing(p => ({ ...p, apply_all: e.target.checked }))} /> Применить для всех недель (шаблон)</label></div>
        <button type="submit" className="submit-btn">{editing.id ? 'Сохранить' : 'Добавить'}</button>
      </form></div></div>, document.body)}

      {showRegister && createPortal(<div className="modal" onClick={() => setShowRegister(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Создать</h2><button onClick={() => setShowRegister(false)}><i className="fas fa-times"></i></button></div><form onSubmit={handleRegister} className="modal-form">
        <div className="form-group"><label>Логин</label><input value={registerData.username} onChange={e => setRegisterData(p => ({ ...p, username: e.target.value }))} /></div>
        <div className="form-group"><label>Пароль</label><input type="password" value={registerData.password} onChange={e => setRegisterData(p => ({ ...p, password: e.target.value }))} /></div>
        <div className="form-group"><label>ФИО</label><input value={registerData.fullName} onChange={e => setRegisterData(p => ({ ...p, fullName: e.target.value }))} /></div>
        <div className="form-group"><label>Роль</label><select value={registerData.role} onChange={e => setRegisterData(p => ({ ...p, role: e.target.value }))}><option value="student">Студент</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select></div>
        {registerData.role === 'student' && <div className="form-group"><label>Группа</label><select value={registerData.groupId} onChange={e => setRegisterData(p => ({ ...p, groupId: e.target.value }))}><option value="">—</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>}
        <button type="submit" className="submit-btn">Создать</button>
      </form></div></div>, document.body)}

      {showGroup && createPortal(<div className="modal" onClick={() => setShowGroup(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Группа</h2></div><form onSubmit={e => { e.preventDefault(); addDir('groups', newGroup, setShowGroup, setNewGroup); }} className="modal-form"><input value={newGroup} onChange={e => setNewGroup(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showTeacher && createPortal(<div className="modal" onClick={() => setShowTeacher(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Преподаватель</h2></div><form onSubmit={e => { e.preventDefault(); addDir('teachers', newTeacher, setShowTeacher, setNewTeacher); }} className="modal-form"><input value={newTeacher} onChange={e => setNewTeacher(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showSubject && createPortal(<div className="modal" onClick={() => setShowSubject(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Предмет</h2></div><form onSubmit={e => { e.preventDefault(); addDir('subjects', newSubject, setShowSubject, setNewSubject); }} className="modal-form"><input value={newSubject} onChange={e => setNewSubject(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showClassroom && createPortal(<div className="modal" onClick={() => setShowClassroom(false)}><div className="modal-container" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Аудитория</h2></div><form onSubmit={e => { e.preventDefault(); addDir('classrooms', newClassroom, setShowClassroom, setNewClassroom); }} className="modal-form"><input value={newClassroom} onChange={e => setNewClassroom(e.target.value)} /><button className="submit-btn">Добавить</button></form></div></div>, document.body)}
      {showReport && createPortal(<TeacherReportModal teachers={teachers} schedule={schedule} onClose={() => setShowReport(false)} onGenerate={generateReport} />, document.body)}
    </div>
  );
}

export default function HomeClient() {
  return <ThemeProvider><HomeContent /></ThemeProvider>;
}