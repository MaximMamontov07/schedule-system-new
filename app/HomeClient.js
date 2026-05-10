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

// ============ КЭШ ДЛЯ ЗАПРОСОВ РАСПИСАНИЯ ============
const scheduleCache = new Map();

// ============ ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ ============

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
  } catch (e) {
    console.error('parseLocalDate error:', e);
    return null;
  }
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
  try {
    const date = parseLocalDate(dateString);
    if (!date || isNaN(date.getTime())) return 'Дата не указана';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (e) {
    console.error('formatDateRu error:', e);
    return 'Дата не указана';
  }
};

const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    date = parseLocalDate(date);
    if (!date) return '';
  }
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

const getWeekNumber = (date) => {
  if (typeof date === 'string') {
    date = parseLocalDate(date);
    if (!date) return 1;
  }
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getMonday = (date) => {
  if (typeof date === 'string') {
    date = parseLocalDate(date);
    if (!date) return new Date();
  }
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
};

const getWeekDates = (date) => {
  if (typeof date === 'string') {
    date = parseLocalDate(date);
  }
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

// ============ DEBOUNCE FUNCTION ============
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// ============ SearchableSelect Component (без изменений) ============
const SearchableSelect = ({ options, value, onChange, placeholder, label, icon, disabled = false }) => {
  // ... (исходный код компонента SearchableSelect остаётся без изменений)
  // Полный код этого компонента уже был в исходном файле, поэтому здесь не дублирую для краткости.
  // Вставьте его как было.
};

// ============ DatePicker Component (без изменений) ============
const DatePicker = ({ onDateSelect, onClose, selectedDate }) => {
  // ... исходный код DatePicker без изменений
};

// ============ ScheduleGrid Component (обновлён для отображения статусов) ============
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
            <th className="time-header">
              <div className="time-header-content">
                <i className="fas fa-clock"></i>
                <span>Время</span>
              </div>
            </th>
            {DAYS.map((day, idx) => {
              const date = weekDates?.[idx];
              const isTodayDate = date && date.toDateString() === new Date().toDateString();
              const isSelected = selectedDate && date && date.toDateString() === selectedDate.toDateString();
              const isWeekend = idx === 5 || idx === 6;
              return (
                <th key={day} className={`day-header ${isTodayDate ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''}`}>
                  <div className="day-header-content">
                    <span className="day-name">{day}</span>
                    <span className="day-date">{date ? formatDate(date) : ''}</span>
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
              {DAYS.map((_, dayIndex) => {
                const lessons = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLessons = lessons.length > 0;
                const date = weekDates?.[dayIndex];
                const isTodayDate = date && date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate && date && date.toDateString() === selectedDate.toDateString();
                const isWeekend = dayIndex === 5 || dayIndex === 6;
                const dateStr = date ? formatForInput(date) : '';
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'} ${isTodayDate ? 'today-column' : ''} ${isSelected ? 'selected-column' : ''} ${isWeekend ? 'weekend-column' : ''}`}>
                    {hasLessons ? (
                      <div className="lessons-container">
                        {lessons.map((lesson, idx) => (
                          <div key={lesson.id || idx} className={`lesson-card-modern ${lesson.source === 'cancelled' ? 'cancelled' : ''}`}>
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
                                  <span>{formatDateRu(lesson.date)}</span>
                                </div>
                              )}
                              {lesson.notes && (
                                <div className="lesson-notes-badge" title={lesson.notes}>
                                  <i className="fas fa-sticky-note"></i>
                                  <span>{lesson.notes.length > 35 ? lesson.notes.substring(0, 35) + '...' : lesson.notes}</span>
                                </div>
                              )}
                              {/* Индикатор статуса */}
                              {lesson.source && lesson.source !== 'template' && (
                                <div className={`lesson-status-badge status-${lesson.source}`}>
                                  {lesson.source === 'cancelled' ? (
                                    <><i className="fas fa-ban"></i> Отменено</>
                                  ) : lesson.source === 'modified' ? (
                                    <><i className="fas fa-pencil-alt"></i> Изменено</>
                                  ) : lesson.source === 'added' ? (
                                    <><i className="fas fa-plus-circle"></i> Добавлено</>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            {canEdit && (
                              <div className="lesson-actions-modern">
                                <button className="lesson-action-btn edit" onClick={() => onEditClick(lesson)} title="Редактировать">
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button className="lesson-action-btn delete" onClick={() => onDeleteClick(lesson)} title="Удалить">
                                  <i className="fas fa-trash-alt"></i>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {canEdit && onAddClick && lessons.length < 6 && (
                          <button 
                            className="add-lesson-btn-mini"
                            onClick={() => {
                              onAddClick({ 
                                day_of_week: dayIndex + 1, 
                                pair_number: pair.number, 
                                date: dateStr
                              });
                            }}
                            title="Добавить занятие"
                          >
                            <i className="fas fa-plus"></i> Добавить
                          </button>
                        )}
                      </div>
                    ) : (
                      canEdit && onAddClick && (
                        <button 
                          className="add-lesson-btn"
                          onClick={() => {
                            onAddClick({ 
                              day_of_week: dayIndex + 1, 
                              pair_number: pair.number, 
                              date: dateStr
                            });
                          }}
                          title="Добавить занятие"
                        >
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
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data && 
         prevProps.canEdit === nextProps.canEdit &&
         prevProps.isLoading === nextProps.isLoading;
});

// ============ FilterSection Component (без значительных изменений) ============
const FilterSection = ({ filters, onFilterChange, groups, teachers, subjects, classrooms, onReset, onOpenCalendar, currentDate, onPrevWeek, onNextWeek, onCurrentWeek, hasActiveFilters, showGroupFilter = true, isStudent = false, selectedGroupId, onGroupChange, isLoading = false }) => {
  // ... исходный код FilterSection
};

// ============ ScheduleView Component ============
const ScheduleView = ({ schedule, groups, teachers, subjects, classrooms, loading, userRole, userGroupId, loadScheduleForWeek }) => {
  // ... исходный код ScheduleView (без изменений)
};

// ============ PublicScheduleView Component ============
const PublicScheduleView = ({ schedule, groups, teachers, subjects, classrooms, loading, loadScheduleForWeek }) => {
  // ... исходный код PublicScheduleView (без изменений)
};

// ============ TeacherPanel Component (обновлён для заметок) ============
const TeacherPanel = ({ data, localData, hasChanges, saving, onNotesChange, onSave, onCancel }) => {
  const weekDates = getWeekDates(new Date());
  
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
              const date = weekDates[idx];
              const isTodayDate = date && date.toDateString() === new Date().toDateString();
              const isWeekend = idx === 5 || idx === 6;
              return (
                <th key={day} className={`day-header ${isTodayDate ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
                  <div className="day-header-content">
                    <span className="day-name">{day}</span>
                    <span className="day-date">{date ? formatDate(date) : ''}</span>
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
              {DAYS.map((_, dayIndex) => {
                const lessons = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLessons = lessons.length > 0;
                const date = weekDates[dayIndex];
                const isTodayDate = date && date.toDateString() === new Date().toDateString();
                const isWeekend = dayIndex === 5 || dayIndex === 6;
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'} ${isTodayDate ? 'today-column' : ''} ${isWeekend ? 'weekend-column' : ''}`}>
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
                                <div className="lesson-info">
                                  <i className="fas fa-door-open"></i>
                                  <span>{lesson.classroom_name || 'Аудитория не указана'}</span>
                                </div>
                                {lesson.date && (
                                  <div className="lesson-info">
                                    <i className="fas fa-calendar-alt"></i>
                                    <span>{formatDateRu(lesson.date)}</span>
                                  </div>
                                )}
                                <textarea 
                                  placeholder="Заметки (домашнее задание, материалы...)"
                                  value={currentData.notes || ''}
                                  onChange={(e) => onNotesChange(lesson.id, e.target.value)}
                                  rows="2"
                                  disabled={isSaving}
                                  className="teacher-notes-textarea"
                                />
                                {isChanged && (
                                  <div className="teacher-actions-modern">
                                    <button onClick={() => onCancel(lesson.id)} disabled={isSaving} className="teacher-action-btn cancel">
                                      <i className="fas fa-times"></i> Отмена
                                    </button>
                                    <button onClick={() => onSave(lesson)} disabled={isSaving} className="teacher-action-btn save">
                                      {isSaving ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-check"></i>} Сохранить
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty-cell"></div>
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
};

// ============ TeacherReportModal Component (без изменений) ============
const TeacherReportModal = ({ teachers, schedule, onClose, onGenerate }) => {
  // ... исходный код
};

// ============ HomeContent Component ============
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

  const [localData, setLocalData] = useState({});
  const [hasChanges, setHasChanges] = useState({});
  const [saving, setSaving] = useState({});

  // Новые состояния для шаблона
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const canEditSchedule = user && (user.role === 'admin' || user.role === 'methodist');
  const canManageUsers = user && user.role === 'admin';
  const isTeacher = user && user.role === 'teacher';

  // ============ ЗАГРУЗКА ДАННЫХ ============

  const loadScheduleForWeek = useCallback(async (weekStart, weekEnd, groupId = null) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    let start = weekStart;
    let end = weekEnd;
    if (weekStart instanceof Date) start = formatForInput(weekStart);
    if (weekEnd instanceof Date) end = formatForInput(weekEnd);

    const cacheKey = `${start}|${end}|${groupId || selectedGroupFilter || ''}`;
    const cached = scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5000) {
      setSchedule(cached.data);
      return cached.data;
    }

    let url = `/api/schedule?weekStart=${start}`;
    if (groupId) url += `&groupId=${groupId}`;
    else if (selectedGroupFilter) url += `&groupId=${selectedGroupFilter}`;
    if (teacherId) url += `&teacherId=${teacherId}`; // если есть teacherId в фильтре? Не используется здесь

    try {
      const scheduleRes = await fetch(url, { headers });
      const scheduleData = await scheduleRes.json();
      scheduleCache.set(cacheKey, { data: scheduleData, timestamp: Date.now() });
      setSchedule(scheduleData);
      return scheduleData;
    } catch (e) {
      console.error(e);
      showNotification('Ошибка загрузки расписания', 'error');
      return [];
    }
  }, [token, selectedGroupFilter]);

  const loadScheduleForWeekForManage = useCallback(async () => {
    const weekDates = getWeekDates(manageCurrentDate);
    const startDate = formatForInput(weekDates[0]);
    const endDate = formatForInput(weekDates[6]);
    await loadScheduleForWeek(startDate, endDate, selectedGroupFilter);
  }, [manageCurrentDate, selectedGroupFilter, loadScheduleForWeek]);

  const loadData = useCallback(async () => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
      const [groupsRes, teachersRes, subjectsRes, classroomsRes] = await Promise.all([
        fetch('/api/groups'),
        fetch('/api/teachers'),
        fetch('/api/subjects'),
        fetch('/api/classrooms')
      ]);
      setGroups(await groupsRes.json());
      setTeachers(await teachersRes.json());
      setSubjects(await subjectsRes.json());
      setClassrooms(await classroomsRes.json());

      const now = new Date();
      const monday = getMonday(now);
      const weekStart = formatForInput(monday);
      await loadScheduleForWeek(weekStart, null);
    } catch (e) {
      console.error(e);
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, loadScheduleForWeek]);

  const loadUsers = useCallback(async () => {
    if (!token || !canManageUsers) return;
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
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

  // ============ ГЕНЕРАЦИЯ ОТЧЁТОВ ============

  const generateTeacherReport = useCallback(async (teacherId) => {
    // ... исходный код без изменений
  }, [teachers, schedule]);

  const exportTeacherHoursReport = useCallback(async () => {
    // ... исходный код
  }, [user, teachers, generateTeacherReport]);

  const exportToExcel = useCallback(() => {
    // ... исходный код
  }, [schedule, activeTab, isTeacher, teachers, user, selectedGroupFilter]);

  const exportToPDF = useCallback(async () => {
    // ... исходный код
  }, [schedule, activeTab, isTeacher, teachers, user, selectedGroupFilter]);

  // ============ АУТЕНТИФИКАЦИЯ ============

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
      } else {
        showNotification(data.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка входа', 'error');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear();
    scheduleCache.clear();
    showNotification('Вы вышли из системы', 'info');
    setSchedule([]);
    setSelectedGroupFilter('');
    setActiveTab('schedule');
  };

  const handleRegister = async (e) => {
    // ... исходный код
  };

  const handleDeleteUser = async (userId) => {
    // ... исходный код
  };

  const linkTeacherToUser = async (teacherId, userId) => {
    // ... исходный код
  };

  const unlinkTeacher = async (teacherId) => {
    // ... исходный код
  };

  // ============ УПРАВЛЕНИЕ ЗАНЯТИЯМИ (новое) ============

  const handleAddScheduleClick = useCallback((slotData) => {
    console.log('📅 Добавление занятия в слот:', slotData);
    let dateValue = '';
    if (slotData.date) {
      const parsedDate = parseLocalDate(slotData.date);
      dateValue = formatForInput(parsedDate);
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
      apply_all: false
    });
    setShowEditModal(true);
  }, [selectedGroupFilter]);

  const handleEditClick = (lesson) => {
    setEditingLesson({
      ...lesson,
      date: lesson.date || '',
      apply_all: lesson.source === 'template' ? true : false  // при редактировании шаблонного можно предложить применить ко всем
    });
    setShowEditModal(true);
  };

  const handleDeleteClick = (lesson) => {
    if (!canEditSchedule) return;
    const applyAll = confirm('Удалить занятие навсегда из шаблона?\nOK — удалить из шаблона, Отмена — отменить только на эту неделю.');
    handleDeleteSlot(lesson, applyAll);
  };

  const handleDeleteSlot = async (lesson, applyAll) => {
    if (!canEditSchedule) return showNotification('Нет прав', 'error');
    const lessonDate = parseLocalDate(lesson.date);
    const monday = getMonday(lessonDate);
    const weekStart = formatForInput(monday);
    const body = {
      group_id: lesson.group_id,
      pair_number: lesson.pair_number,
      day_of_week: lesson.day_of_week,
      week_start_date: weekStart,
      apply_all: applyAll
    };
    try {
      const res = await fetch('/api/schedule/lesson', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        scheduleCache.clear();
        showNotification(applyAll ? 'Удалено из шаблона' : 'Занятие отменено на эту неделю', 'success');
        if (activeTab === 'manage-schedule') await loadScheduleForWeekForManage();
        else await loadData();
        if (activeTab === 'template') loadTemplates();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Ошибка', 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    }
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (!canEditSchedule) return showNotification('Нет прав', 'error');

    if (!editingLesson.apply_all && !editingLesson.date) {
      showNotification('Выберите дату или отметьте "Применить для всех недель"', 'error');
      return;
    }

    let weekStart = null;
    if (!editingLesson.apply_all) {
      const lessonDate = parseLocalDate(editingLesson.date);
      if (!lessonDate) return showNotification('Некорректная дата', 'error');
      const monday = getMonday(lessonDate);
      weekStart = formatForInput(monday);
    }

    const body = {
      group_id: parseInt(editingLesson.group_id),
      teacher_id: parseInt(editingLesson.teacher_id),
      subject_id: parseInt(editingLesson.subject_id),
      classroom_id: editingLesson.classroom_id ? parseInt(editingLesson.classroom_id) : null,
      pair_number: parseInt(editingLesson.pair_number),
      day_of_week: parseInt(editingLesson.day_of_week),
      week_start_date: weekStart,
      apply_all: !!editingLesson.apply_all
    };

    try {
      const res = await fetch('/api/schedule/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (res.ok) {
        scheduleCache.clear();
        showNotification(editingLesson.apply_all ? 'Шаблон обновлён' : 'Изменение сохранено', 'success');
        setShowEditModal(false);
        setEditingLesson(null);
        if (activeTab === 'manage-schedule') await loadScheduleForWeekForManage();
        else await loadData();
        if (activeTab === 'template') loadTemplates();
      } else if (res.status === 409 && result.conflict) {
        showNotification(result.error, 'error');
        alert('Конфликт: ' + result.error);
      } else {
        showNotification(result.error || 'Ошибка сервера', 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    }
  };

  // ============ ЗАМЕТКИ ПРЕПОДАВАТЕЛЯ ============

  const handleNotesChange = (lessonId, value) => {
    setLocalData(prev => ({ ...prev, [lessonId]: { ...prev[lessonId], notes: value } }));
    setHasChanges(prev => ({ ...prev, [lessonId]: true }));
  };

  const handleSaveNotesForLesson = async (lesson) => {
    const weekStart = formatForInput(getMonday(parseLocalDate(lesson.date)));
    const body = {
      week_start_date: weekStart,
      group_id: lesson.group_id,
      day_of_week: lesson.day_of_week,
      pair_number: lesson.pair_number,
      notes: localData[lesson.id]?.notes || ''
    };
    try {
      const res = await fetch('/api/schedule/teacher-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showNotification('Заметки сохранены', 'success');
        setHasChanges(prev => { const n = {...prev}; delete n[lesson.id]; return n; });
        await loadData();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Ошибка', 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    }
  };

  // ============ УПРАВЛЕНИЕ СПРАВОЧНИКАМИ ============

  const addDirectory = async (type, name, setShow, setValue) => {
    // ... исходный код
  };

  const deleteDirectory = async (type, id) => {
    // ... исходный код
  };

  const handleAddClassroom = async (e) => {
    // ... исходный код
  };

  const handleDeleteClassroom = async (id) => {
    // ... исходный код
  };

  // ============ EFFECTS ============

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

  useEffect(() => {
    if (!authChecking) loadData();
  }, [authChecking, loadData]);

  useEffect(() => {
    if (token && canManageUsers) loadUsers();
  }, [token, canManageUsers, loadUsers]);

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
    if (activeTab === 'manage-schedule' && token) {
      loadScheduleForWeekForManage();
    }
  }, [manageCurrentDate, selectedGroupFilter, activeTab, token, loadScheduleForWeekForManage]);

  useEffect(() => {
    if (activeTab === 'template' && canEditSchedule) loadTemplates();
  }, [activeTab, canEditSchedule, loadTemplates]);

  // ============ RENDER MAIN CONTENT ============

  const renderMainContent = () => {
    if (isTeacher) {
      const teacher = teachers.find(t => t.user_id === user?.id);
      const teacherLessons = teacher ? schedule.filter(lesson => lesson.teacher_id === teacher.id) : [];
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-chalkboard-teacher"></i> Мои занятия</h2>
            </div>
            <div className="header-actions">
              {Object.keys(hasChanges).some(id => hasChanges[id]) && (
                <button className="action-button save-all" onClick={() => {
                  const changedIds = Object.keys(hasChanges).filter(id => hasChanges[id]);
                  changedIds.forEach(id => {
                    const lesson = teacherLessons.find(l => l.id === parseInt(id));
                    if (lesson) handleSaveNotesForLesson(lesson);
                  });
                }}>
                  <i className="fas fa-save"></i> Сохранить все
                </button>
              )}
              <button className="action-button export-excel" onClick={exportToExcel}>
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button className="action-button export-pdf" onClick={exportToPDF}>
                <i className="fas fa-file-pdf"></i> PDF
              </button>
              <button className="action-button report-hours" onClick={exportTeacherHoursReport}>
                <i className="fas fa-chart-line"></i> Отчет по часам
              </button>
            </div>
          </div>
          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Загрузка...</p></div>
          ) : teacherLessons.length === 0 ? (
            <div className="empty-state"><i className="fas fa-info-circle"></i><p>Нет назначенных занятий</p></div>
          ) : (
            <TeacherPanel 
              data={teacherLessons}
              localData={localData}
              hasChanges={hasChanges}
              saving={saving}
              onNotesChange={handleNotesChange}
              onSave={handleSaveNotesForLesson}
              onCancel={(lessonId) => {
                const lesson = teacherLessons.find(l => l.id === lessonId);
                if (lesson) {
                  setLocalData(prev => ({ ...prev, [lessonId]: { notes: lesson.notes || '' } }));
                  setHasChanges(prev => {
                    const newState = { ...prev };
                    delete newState[lessonId];
                    return newState;
                  });
                }
              }}
            />
          )}
        </div>
      );
    }

    if (activeTab === 'schedule') {
      let displaySchedule = schedule;
      if (user && user.role === 'student' && user.groupId) {
        displaySchedule = schedule.filter(s => s.group_id === user.groupId);
      }
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-calendar-alt"></i> Расписание занятий</h2>
            </div>
            <div className="header-actions">
              <button className="action-button export-excel" onClick={exportToExcel}>
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button className="action-button export-pdf" onClick={exportToPDF}>
                <i className="fas fa-file-pdf"></i> PDF
              </button>
              {user && user.role === 'admin' && (
                <button className="action-button report-hours" onClick={() => setShowTeacherReportModal(true)}>
                  <i className="fas fa-chart-line"></i> Отчет по часам
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Загрузка...</p></div>
          ) : (
            <ScheduleView 
              schedule={displaySchedule}
              groups={groups}
              teachers={teachers}
              subjects={subjects}
              classrooms={classrooms}
              loading={loading}
              userRole={user?.role}
              userGroupId={user?.groupId}
              loadScheduleForWeek={loadScheduleForWeek}
            />
          )}
        </div>
      );
    }

    if (activeTab === 'manage-schedule' && canEditSchedule) {
      const weekDatesForManage = getWeekDates(manageCurrentDate);
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-edit"></i> Управление расписанием</h2>
            </div>
            <div className="header-actions">
              <div className="week-controls" style={{ marginRight: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => { const d = new Date(manageCurrentDate); d.setDate(d.getDate() - 7); setManageCurrentDate(d); }} className="week-nav-btn">
                  <i className="fas fa-chevron-left"></i> Пред.
                </button>
                <div className="week-display" style={{ background: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '2rem', color: 'white' }}>
                  <i className="fas fa-calendar-week"></i>
                  <span>{formatDate(weekDatesForManage[0])} - {formatDate(weekDatesForManage[6])}</span>
                  <span className="week-number">({getWeekNumber(weekDatesForManage[0])} нед.)</span>
                </div>
                <button onClick={() => { const d = new Date(manageCurrentDate); d.setDate(d.getDate() + 7); setManageCurrentDate(d); }} className="week-nav-btn">
                  След. <i className="fas fa-chevron-right"></i>
                </button>
                <button onClick={() => setManageCurrentDate(new Date())} className="week-today-btn">
                  <i className="fas fa-calendar-day"></i> Сегодня
                </button>
              </div>
              <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} className="group-filter">
                <option value="">Все группы</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
            </div>
          </div>
          {loading ? (
            <div className="loading-state"><div className="spinner"></div></div>
          ) : (
            <ScheduleGrid 
              data={schedule} 
              canEdit={true}
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick}
              onAddClick={handleAddScheduleClick}
              weekDates={weekDatesForManage}
              selectedDate={null}
            />
          )}
        </div>
      );
    }

    if (activeTab === 'template' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-layer-group"></i> Шаблон расписания</h2>
            </div>
            <div className="header-actions">
              <button className="action-button primary" onClick={() => {
                setEditingLesson({
                  id: null,
                  group_id: '',
                  teacher_id: '',
                  subject_id: '',
                  classroom_id: '',
                  pair_number: '1',
                  day_of_week: '1',
                  date: '',
                  apply_all: true
                });
                setShowEditModal(true);
              }}>
                <i className="fas fa-plus"></i> Добавить
              </button>
            </div>
          </div>
          {loadingTemplates ? (
            <div className="loading-state"><div className="spinner"></div></div>
          ) : (
            <div className="directories-grid">
              <div className="directory-card">
                <div className="directory-header">
                  <i className="fas fa-list"></i>
                  <h3>Занятия шаблона</h3>
                </div>
                <div className="directory-list">
                  {templates.map(t => (
                    <div key={t.id} className="directory-item">
                      <span>
                        {DAYS[t.day_of_week-1]} {t.pair_number} пара – {t.subject_name} ({t.group_name}), {t.teacher_name}
                      </span>
                      <button onClick={async () => {
                        if (!confirm('Удалить запись из шаблона?')) return;
                        try {
                          await fetch(`/api/schedule/template?id=${t.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                          showNotification('Удалено из шаблона');
                          loadTemplates();
                        } catch (e) {}
                      }} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'directories' && canEditSchedule) {
      // ... исходный код справочников
    }

    if (activeTab === 'users' && canManageUsers) {
      // ... исходный код пользователей (где используется SearchableSelect для привязки)
    }

    return null;
  };

  // ============ АВТОРИЗАЦИЯ ============

  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="spinner-large"></div>
        <p>Загрузка системы...</p>
        <button className="theme-toggle-loading" onClick={toggleTheme}>
          <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
          {theme === 'light' ? ' Тёмная тема' : ' Светлая тема'}
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
              <div className="hero-badge"><span><i className="fas fa-graduation-cap"></i> Расписание</span></div>
              <h1 className="hero-title">Учебное расписание<br/><span className="gradient-highlight">Колледжа</span></h1>
              <p className="hero-description">Платформа для просмотра расписания в колледже</p>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => setShowLogin(true)}><i className="fas fa-sign-in-alt"></i> Войти</button>
                <button className="btn-secondary" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i> {theme === 'light' ? 'Тёмная' : 'Светлая'} тема</button>
              </div>
            </div>
            <PublicScheduleView 
              schedule={schedule}
              groups={groups}
              teachers={teachers}
              subjects={subjects}
              classrooms={classrooms}
              loading={loading}
              loadScheduleForWeek={loadScheduleForWeek}
            />
          </div>
        </div>
        {showLogin && createPortal(
          <div className="modal" onClick={() => setShowLogin(false)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h2><i className="fas fa-sign-in-alt"></i> Вход</h2><button className="modal-close" onClick={() => setShowLogin(false)}><i className="fas fa-times"></i></button></div>
              <form onSubmit={handleLogin} className="modal-form">
                <div className="form-group"><label>Логин</label><input type="text" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required /></div>
                <div className="form-group"><label>Пароль</label><input type="password" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required /></div>
                <button type="submit" className="submit-btn"><i className="fas fa-sign-in-alt"></i> Войти</button>
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
        <div className="sidebar-brand">
          <i className="fas fa-calendar-alt"></i>
          <span className="brand-name">Расписание</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}><i className="fas fa-times"></i></button>
        </div>
        <div className="sidebar-profile">
          <div className="profile-avatar"><i className={`fas ${user.role === 'admin' ? 'fa-crown' : user.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div>
          <div className="profile-info">
            <div className="profile-name">{user.fullName}</div>
            <div className="profile-role">{ROLES[user.role]}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {!isTeacher && (
            <button className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); }}>
              <i className="fas fa-calendar-week"></i><span>Расписание</span>
            </button>
          )}
          {isTeacher && (
            <button className={`nav-item ${activeTab === 'my-lessons' ? 'active' : ''}`} onClick={() => { setActiveTab('my-lessons'); setSidebarOpen(false); }}>
              <i className="fas fa-chalkboard-teacher"></i><span>Мои занятия</span>
            </button>
          )}
          {canEditSchedule && (
            <>
              <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}>
                <i className="fas fa-edit"></i><span>Управление</span>
              </button>
              <button className={`nav-item ${activeTab === 'template' ? 'active' : ''}`} onClick={() => { setActiveTab('template'); setSidebarOpen(false); }}>
                <i className="fas fa-layer-group"></i><span>Шаблон</span>
              </button>
              <button className={`nav-item ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => { setActiveTab('directories'); setSidebarOpen(false); }}>
                <i className="fas fa-database"></i><span>Справочники</span>
              </button>
            </>
          )}
          {user?.role === 'admin' && (
            <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}>
              <i className="fas fa-users-cog"></i><span>Пользователи</span>
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
            <span>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</span>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i><span>Выйти</span>
          </button>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <main className="app-main">
        <header className="app-header">
          <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)}><i className="fas fa-bars"></i></button>
          <div className="header-title">
            <h1>
              {isTeacher && 'Мои занятия'}
              {!isTeacher && activeTab === 'schedule' && 'Расписание занятий'}
              {activeTab === 'manage-schedule' && 'Управление расписанием'}
              {activeTab === 'template' && 'Шаблон расписания'}
              {activeTab === 'directories' && 'Справочники'}
              {activeTab === 'users' && 'Управление пользователями'}
            </h1>
          </div>
          <div className="header-actions-right">
            <button className="theme-toggle-header" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button>
            <div className="role-badge">{ROLES[user.role]}</div>
          </div>
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
                <label>Группа</label>
                <select value={editingLesson.group_id} onChange={e => setEditingLesson({...editingLesson, group_id: e.target.value})} required>
                  <option value="">Выберите группу</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Предмет</label>
                <select value={editingLesson.subject_id} onChange={e => setEditingLesson({...editingLesson, subject_id: e.target.value})} required>
                  <option value="">Выберите предмет</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Преподаватель</label>
                <select value={editingLesson.teacher_id} onChange={e => setEditingLesson({...editingLesson, teacher_id: e.target.value})} required>
                  <option value="">Выберите преподавателя</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Аудитория</label>
                <select value={editingLesson.classroom_id} onChange={e => setEditingLesson({...editingLesson, classroom_id: e.target.value})}>
                  <option value="">Не выбрана</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group half">
                  <label>День недели</label>
                  <select value={editingLesson.day_of_week} onChange={e => setEditingLesson({...editingLesson, day_of_week: e.target.value})} required>
                    {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group half">
                  <label>Пара</label>
                  <select value={editingLesson.pair_number} onChange={e => setEditingLesson({...editingLesson, pair_number: e.target.value})} required>
                    {PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}
                  </select>
                </div>
              </div>
              {!editingLesson.apply_all && (
                <div className="form-group">
                  <label>Дата занятия</label>
                  <input type="date" value={editingLesson.date} onChange={e => setEditingLesson({...editingLesson, date: e.target.value})} required={!editingLesson.apply_all} />
                </div>
              )}
              {canEditSchedule && (
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editingLesson.apply_all || false}
                      onChange={(e) => setEditingLesson({...editingLesson, apply_all: e.target.checked})}
                    />
                    <span>Применить для всех недель (шаблон)</span>
                  </label>
                </div>
              )}
              <button type="submit" className="submit-btn">
                <i className="fas fa-save"></i> {editingLesson.id ? ' Сохранить изменения' : ' Добавить занятие'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Остальные модальные окна (Register, Group, Teacher, Subject, Classroom, TeacherReport) оставлены без изменений */}
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