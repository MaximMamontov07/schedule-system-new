'use client';

import { useState, useEffect, useMemo, createContext, useContext } from 'react';
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

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const PAIRS = [
  { number: 1, time: '8:30-10:00', name: '1 пара' },
  { number: 2, time: '10:10-11:40', name: '2 пара' },
  { number: 3, time: '12:10-13:40', name: '3 пара' },
  { number: 4, time: '13:50-15:20', name: '4 пара' },
  { number: 5, time: '15:30-17:00', name: '5 пара' },
  { number: 6, time: '17:10-18:40', name: '6 пара' }
];
const ROLES = { admin: 'Администратор', methodist: 'Методист', teacher: 'Преподаватель', student: 'Студент' };

const ScheduleGrid = ({ data, canEdit = false, onEditClick, onDeleteClick, onAddClick }) => {
  const scheduleMatrix = useMemo(() => {
    const matrix = Array(6).fill().map(() => Array(6).fill(null));
    if (Array.isArray(data)) {
      data.forEach(lesson => {
        const dayIndex = lesson.day_of_week - 1;
        const pairIndex = lesson.pair_number - 1;
        if (dayIndex >= 0 && dayIndex < 6 && pairIndex >= 0 && pairIndex < 6) {
          matrix[dayIndex][pairIndex] = lesson;
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
            <th className="time-header">Время</th>
            {DAYS.map(day => (
              <th key={day} className="day-header">{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot">
                <div className="time-slot-content">
                  <span className="pair-num">{pair.name}</span>
                  <span className="pair-time">{pair.time}</span>
                </div>
              </td>
              {DAYS.map((_, dayIndex) => {
                const lesson = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLesson = lesson !== null;
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-slot ${hasLesson ? 'occupied' : 'empty'}`}>
                    {hasLesson ? (
                      <div className="lesson-card">
                        <div className="lesson-card-header">
                          <span className="lesson-subject">{lesson.subject_name}</span>
                          <span className="lesson-group-badge">{lesson.group_name}</span>
                        </div>
                        <div className="lesson-details">
                          <div className="lesson-detail">
                            <i className="fas fa-chalkboard-teacher"></i>
                            <span>{lesson.teacher_name}</span>
                          </div>
                          {lesson.classroom_name && (
                            <div className="lesson-detail">
                              <i className="fas fa-door-open"></i>
                              <span>{lesson.classroom_name}</span>
                            </div>
                          )}
                          {lesson.notes && (
                            <div className="lesson-notes-preview" title={lesson.notes}>
                              <i className="fas fa-sticky-note"></i>
                              <span>{lesson.notes.length > 40 ? lesson.notes.substring(0, 40) + '...' : lesson.notes}</span>
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="lesson-actions">
                            <button className="action-btn edit-btn" onClick={() => onEditClick(lesson)} title="Редактировать">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="action-btn delete-btn" onClick={() => onDeleteClick(lesson.id)} title="Удалить">
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      canEdit && onAddClick && (
                        <button 
                          className="add-lesson-trigger" 
                          onClick={() => onAddClick({ day_of_week: dayIndex + 1, pair_number: pair.number })}
                        >
                          <i className="fas fa-plus-circle"></i>
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
};

const TeacherPanel = ({ data, localData, hasChanges, saving, onNotesChange, onSave, onCancel }) => {
  const scheduleMatrix = useMemo(() => {
    const matrix = Array(6).fill().map(() => Array(6).fill(null));
    if (Array.isArray(data)) {
      data.forEach(lesson => {
        const dayIndex = lesson.day_of_week - 1;
        const pairIndex = lesson.pair_number - 1;
        if (dayIndex >= 0 && dayIndex < 6 && pairIndex >= 0 && pairIndex < 6) {
          matrix[dayIndex][pairIndex] = lesson;
        }
      });
    }
    return matrix;
  }, [data]);

  return (
    <div className="teacher-panel-wrapper">
      <table className="teacher-schedule-grid">
        <thead>
          <tr>
            <th className="time-header">Время</th>
            {DAYS.map(day => (
              <th key={day} className="day-header">{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAIRS.map(pair => (
            <tr key={pair.number}>
              <td className="time-slot">
                <div className="time-slot-content">
                  <span className="pair-num">{pair.name}</span>
                  <span className="pair-time">{pair.time}</span>
                </div>
              </td>
              {DAYS.map((_, dayIndex) => {
                const lesson = scheduleMatrix[dayIndex][pair.number - 1];
                const hasLesson = lesson !== null;
                const currentData = hasLesson ? (localData[lesson.id] || { notes: lesson.notes || '' }) : null;
                const isChanged = hasLesson ? hasChanges[lesson.id] : false;
                const isSaving = hasLesson ? saving[lesson.id] : false;
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-slot ${hasLesson ? 'occupied' : 'empty'}`}>
                    {hasLesson ? (
                      <div className="teacher-lesson-card">
                        <div className="lesson-card-header">
                          <span className="lesson-subject">{lesson.subject_name}</span>
                          <span className="lesson-group-badge">{lesson.group_name}</span>
                          {isChanged && <span className="unsaved-indicator"><i className="fas fa-circle"></i></span>}
                        </div>
                        <div className="lesson-detail">
                          <i className="fas fa-door-open"></i>
                          <span>{lesson.classroom_name || '—'}</span>
                        </div>
                        <div className="teacher-controls">
                          <textarea 
                            placeholder="Заметки (домашнее задание, материалы...)"
                            value={currentData?.notes || ''}
                            onChange={(e) => onNotesChange(lesson.id, e.target.value)}
                            rows="2"
                            disabled={isSaving}
                            className="teacher-notes-input"
                          />
                          {isChanged && (
                            <div className="teacher-actions">
                              <button onClick={() => onCancel(lesson.id)} disabled={isSaving} className="cancel-btn">
                                <i className="fas fa-undo-alt"></i> Отмена
                              </button>
                              <button onClick={() => onSave(lesson.id)} disabled={isSaving} className="save-btn">
                                {isSaving ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-check"></i>} Сохранить
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="empty-slot"></div>
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
  
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', password: '', fullName: '', role: 'student', groupId: '' });
  const [newLesson, setNewLesson] = useState({ group_id: '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: '1', day_of_week: '1' });
  const [editingLesson, setEditingLesson] = useState(null);
  const [newGroup, setNewGroup] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newClassroom, setNewClassroom] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');

  const [localData, setLocalData] = useState({});
  const [hasChanges, setHasChanges] = useState({});
  const [saving, setSaving] = useState({});

  const showNotification = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const canEditSchedule = user && ['methodist', 'admin'].includes(user.role);
  const canManageUsers = user && user.role === 'admin';
  const isTeacher = user && user.role === 'teacher';

  const exportToExcel = () => {
    const exportData = filteredSchedule.map(lesson => ({
      'День недели': DAYS[lesson.day_of_week - 1],
      'Пара': `${lesson.pair_number} (${PAIRS[lesson.pair_number - 1].time})`,
      'Группа': lesson.group_name,
      'Предмет': lesson.subject_name,
      'Преподаватель': lesson.teacher_name,
      'Аудитория': lesson.classroom_name || '—',
      'Заметки': lesson.notes || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Расписание");
    XLSX.writeFile(wb, `Расписание_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Excel файл сохранен', 'success');
  };

  const exportToPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.createElement('div');
      element.innerHTML = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body>
            <h1>Расписание занятий</h1>
            <table border="1" cellpadding="8">
              <thead><tr><th>День</th><th>Время</th><th>Группа</th><th>Предмет</th><th>Преподаватель</th><th>Аудитория</th></tr></thead>
              <tbody>
                ${filteredSchedule.map(lesson => `
                  <tr>
                    <td>${DAYS[lesson.day_of_week - 1]}</td>
                    <td>${PAIRS[lesson.pair_number - 1].time}</td>
                    <td>${lesson.group_name}</td>
                    <td>${lesson.subject_name}</td>
                    <td>${lesson.teacher_name}</td>
                    <td>${lesson.classroom_name || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      await html2pdf().from(element).save();
      showNotification('PDF файл сохранен', 'success');
    } catch (error) {
      showNotification('Ошибка экспорта PDF', 'error');
    }
  };

  const loadData = async () => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    try {
      const [scheduleRes, groupsRes, teachersRes, subjectsRes, classroomsRes] = await Promise.all([
        fetch('/api/schedule', { headers }),
        fetch('/api/groups'),
        fetch('/api/teachers'),
        fetch('/api/subjects'),
        fetch('/api/classrooms')
      ]);
      
      setSchedule(await scheduleRes.json());
      setGroups(await groupsRes.json());
      setTeachers(await teachersRes.json());
      setSubjects(await subjectsRes.json());
      setClassrooms(await classroomsRes.json());
    } catch (e) {
      console.error(e);
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!token || !canManageUsers) return;
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  };

  const getFilteredSchedule = () => {
    let filtered = [...schedule];
    if (user) {
      if (user.role === 'student' && user.groupId) {
        filtered = filtered.filter(s => s.group_id === user.groupId);
      } else if (selectedGroupFilter && ['methodist', 'admin'].includes(user.role)) {
        filtered = filtered.filter(s => s.group_id === parseInt(selectedGroupFilter));
      }
    }
    return filtered;
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
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
        showNotification(`Добро пожаловать, ${data.user.fullName}!`, 'success');
        await loadData();
        if (data.user.role === 'admin') await loadUsers();
        setActiveTab('schedule');
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
    showNotification('Вы вышли из системы', 'info');
    setSchedule([]);
    setSelectedGroupFilter('');
    setActiveTab('schedule');
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
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
      } else {
        showNotification(data.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка регистрации', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Удалить пользователя?')) return;
    try {
      await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Пользователь удалён', 'success');
      loadUsers();
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const linkTeacherToUser = async (teacherId, userId) => {
    try {
      const res = await fetch('/api/teachers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teacherId, userId })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('Преподаватель привязан к пользователю', 'success');
        loadData();
        loadUsers();
      } else {
        showNotification(data.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка привязки', 'error');
    }
  };

  const unlinkTeacher = async (teacherId) => {
    if (!confirm('Отвязать преподавателя?')) return;
    try {
      await fetch(`/api/teachers/link?teacherId=${teacherId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Привязка удалена', 'success');
      loadData();
      loadUsers();
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!canEditSchedule) return showNotification('Нет прав', 'error');
    
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...newLesson, classroom_id: newLesson.classroom_id || null })
      });
      if (res.ok) {
        showNotification('Занятие добавлено', 'success');
        setNewLesson({ group_id: '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: '1', day_of_week: '1' });
        loadData();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleUpdateLesson = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`/api/schedule/${editingLesson.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...editingLesson, classroom_id: editingLesson.classroom_id || null })
      });
      if (res.ok) {
        showNotification('Занятие обновлено', 'success');
        setShowEditModal(false);
        loadData();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleDeleteLesson = async (id) => {
    if (!canEditSchedule) return showNotification('Нет прав', 'error');
    if (!confirm('Удалить занятие?')) return;
    
    try {
      await fetch(`/api/schedule/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Занятие удалено', 'success');
      loadData();
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleAddScheduleClick = (slotData) => {
    setEditingLesson({
      id: null,
      group_id: '',
      teacher_id: '',
      subject_id: '',
      classroom_id: '',
      pair_number: slotData.pair_number,
      day_of_week: slotData.day_of_week
    });
    setShowEditModal(true);
  };

  const addDirectory = async (type, name, setShow, setValue) => {
    if (!name.trim()) return showNotification('Введите название', 'error');
    try {
      const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() })
      });
      if (res.ok) {
        showNotification('Добавлено', 'success');
        setShow(false);
        setValue('');
        loadData();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const deleteDirectory = async (type, id) => {
    if (!confirm('Удалить?')) return;
    try {
      await fetch(`/api/${type}?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Удалено', 'success');
      loadData();
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    if (!newClassroom.trim()) {
      showNotification('Введите номер аудитории', 'error');
      return;
    }
    
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newClassroom.trim() })
      });
      
      if (res.ok) {
        showNotification('Аудитория добавлена', 'success');
        setShowClassroomModal(false);
        setNewClassroom('');
        loadData();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleDeleteClassroom = async (id) => {
    if (!confirm('Удалить аудиторию?')) return;
    
    try {
      await fetch(`/api/classrooms?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Аудитория удалена', 'success');
      loadData();
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleNotesChange = (lessonId, value) => {
    setLocalData(prev => ({ ...prev, [lessonId]: { ...prev[lessonId], notes: value } }));
    setHasChanges(prev => ({ ...prev, [lessonId]: true }));
  };

  const handleSaveLesson = async (lessonId) => {
    const data = localData[lessonId];
    if (!data) return;
    
    setSaving(prev => ({ ...prev, [lessonId]: true }));
    
    try {
      const res = await fetch('/api/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: lessonId, notes: data.notes })
      });
      
      if (res.ok) {
        showNotification('Изменения сохранены', 'success');
        setHasChanges(prev => {
          const newState = { ...prev };
          delete newState[lessonId];
          return newState;
        });
        loadData();
      } else {
        const error = await res.json();
        showNotification(error.error || 'Ошибка сохранения', 'error');
      }
    } catch (e) {
      showNotification('Ошибка соединения', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [lessonId]: false }));
    }
  };

  useEffect(() => {
    const init = async () => {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('user');
      if (t && u) { setToken(t); setUser(JSON.parse(u)); }
      setAuthChecking(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!authChecking) loadData();
  }, [authChecking, token]);

  useEffect(() => {
    if (token && canManageUsers) loadUsers();
  }, [token, canManageUsers]);

  useEffect(() => {
    if (isTeacher && schedule.length > 0) {
      const initialData = {};
      schedule.forEach(lesson => { initialData[lesson.id] = { notes: lesson.notes || '' }; });
      setLocalData(initialData);
    }
  }, [schedule, isTeacher]);

  const filteredSchedule = getFilteredSchedule();
  const availableUsers = users.filter(u => {
    if (u.role !== 'teacher') return false;
    const isAlreadyLinked = teachers.some(t => t.user_id === u.id);
    return !isAlreadyLinked;
  });

  const renderMainContent = () => {
    if (activeTab === 'schedule') {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-calendar-alt"></i> Расписание занятий</h2>
              {(user?.role === 'methodist' || user?.role === 'admin') && (
                <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} className="group-filter">
                  <option value="">Все группы</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </div>
            <div className="header-actions">
              <button className="action-button export-excel" onClick={exportToExcel}>
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button className="action-button export-pdf" onClick={exportToPDF}>
                <i className="fas fa-file-pdf"></i> PDF
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Загрузка расписания...</p></div>
          ) : filteredSchedule.length === 0 ? (
            <div className="empty-state"><i className="fas fa-calendar-times"></i><p>Нет занятий для отображения</p></div>
          ) : (
            <ScheduleGrid data={filteredSchedule} canEdit={false} />
          )}
        </div>
      );
    }
    
    if (activeTab === 'my-lessons' && isTeacher) {
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
                  changedIds.forEach(id => handleSaveLesson(parseInt(id)));
                }}>
                  <i className="fas fa-save"></i> Сохранить все ({Object.keys(hasChanges).filter(id => hasChanges[id]).length})
                </button>
              )}
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
            </div>
          </div>
          
          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Загрузка...</p></div>
          ) : filteredSchedule.length === 0 ? (
            <div className="empty-state"><i className="fas fa-info-circle"></i><p>Нет назначенных занятий</p></div>
          ) : (
            <TeacherPanel 
              data={filteredSchedule}
              localData={localData}
              hasChanges={hasChanges}
              saving={saving}
              onNotesChange={handleNotesChange}
              onSave={handleSaveLesson}
              onCancel={(lessonId) => {
                const lesson = filteredSchedule.find(l => l.id === lessonId);
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
    
    if (activeTab === 'manage-schedule' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-plus-circle"></i> Управление расписанием</h2>
            </div>
            <div className="header-actions">
              <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} className="group-filter">
                <option value="">Все группы</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="action-button export-excel" onClick={exportToExcel}><i className="fas fa-file-excel"></i> Excel</button>
              <button className="action-button export-pdf" onClick={exportToPDF}><i className="fas fa-file-pdf"></i> PDF</button>
            </div>
          </div>
          
          <div className="add-lesson-section">
            <h3><i className="fas fa-plus"></i> Добавить новое занятие</h3>
            <form onSubmit={handleAddLesson} className="add-lesson-form">
              <div className="form-grid">
                <div className="form-field">
                  <label><i className="fas fa-users"></i> Группа</label>
                  <select value={newLesson.group_id} onChange={e => setNewLesson({...newLesson, group_id: e.target.value})} required>
                    <option value="">Выберите группу</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label><i className="fas fa-book"></i> Предмет</label>
                  <select value={newLesson.subject_id} onChange={e => setNewLesson({...newLesson, subject_id: e.target.value})} required>
                    <option value="">Выберите предмет</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label><i className="fas fa-chalkboard-teacher"></i> Преподаватель</label>
                  <select value={newLesson.teacher_id} onChange={e => setNewLesson({...newLesson, teacher_id: e.target.value})} required>
                    <option value="">Выберите преподавателя</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label><i className="fas fa-door-open"></i> Аудитория</label>
                  <select value={newLesson.classroom_id} onChange={e => setNewLesson({...newLesson, classroom_id: e.target.value})}>
                    <option value="">Не указана</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label><i className="fas fa-calendar-day"></i> День недели</label>
                  <select value={newLesson.day_of_week} onChange={e => setNewLesson({...newLesson, day_of_week: e.target.value})}>
                    {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label><i className="fas fa-clock"></i> Пара</label>
                  <select value={newLesson.pair_number} onChange={e => setNewLesson({...newLesson, pair_number: e.target.value})}>
                    {PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="submit-button"><i className="fas fa-plus"></i> Добавить занятие</button>
            </form>
          </div>
          
          <div className="schedule-editor">
            <h3><i className="fas fa-edit"></i> Редактирование расписания</h3>
            {loading ? (
              <div className="loading-state"><div className="spinner"></div></div>
            ) : filteredSchedule.length === 0 ? (
              <div className="empty-state"><i className="fas fa-calendar-times"></i><p>Нет занятий</p></div>
            ) : (
              <ScheduleGrid 
                data={filteredSchedule} 
                canEdit={true}
                onEditClick={(lesson) => {
                  setEditingLesson(lesson);
                  setShowEditModal(true);
                }}
                onDeleteClick={handleDeleteLesson}
                onAddClick={handleAddScheduleClick}
              />
            )}
          </div>
        </div>
      );
    }
    
    if (activeTab === 'directories' && canEditSchedule) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-database"></i> Справочники</h2>
            </div>
          </div>
          
          <div className="directories-grid">
            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-users"></i>
                <h3>Группы</h3>
                <button className="add-dir-btn" onClick={() => setShowGroupModal(true)}><i className="fas fa-plus"></i></button>
              </div>
              <div className="directory-list">
                {groups.map(g => (
                  <div key={g.id} className="directory-item">
                    <span>{g.name}</span>
                    <button onClick={() => deleteDirectory('groups', g.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-chalkboard-teacher"></i>
                <h3>Преподаватели</h3>
                <button className="add-dir-btn" onClick={() => setShowTeacherModal(true)}><i className="fas fa-plus"></i></button>
              </div>
              <div className="directory-list">
                {teachers.map(t => (
                  <div key={t.id} className="directory-item">
                    <span>{t.name}</span>
                    <button onClick={() => deleteDirectory('teachers', t.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-book"></i>
                <h3>Предметы</h3>
                <button className="add-dir-btn" onClick={() => setShowSubjectModal(true)}><i className="fas fa-plus"></i></button>
              </div>
              <div className="directory-list">
                {subjects.map(s => (
                  <div key={s.id} className="directory-item">
                    <span>{s.name}</span>
                    <button onClick={() => deleteDirectory('subjects', s.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-door-open"></i>
                <h3>Аудитории</h3>
                <button className="add-dir-btn" onClick={() => setShowClassroomModal(true)}><i className="fas fa-plus"></i></button>
              </div>
              <div className="directory-list">
                {classrooms.map(c => (
                  <div key={c.id} className="directory-item">
                    <span>{c.name}</span>
                    <button onClick={() => handleDeleteClassroom(c.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (activeTab === 'users' && canManageUsers) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-users-cog"></i> Управление пользователями</h2>
            </div>
            <button className="action-button primary" onClick={() => setShowRegister(true)}>
              <i className="fas fa-user-plus"></i> Создать пользователя
            </button>
          </div>
          
          <div className="users-section">
            <h3><i className="fas fa-list"></i> Список пользователей</h3>
            <div className="users-list">
              {users.map(u => (
                <div key={u.id} className="user-card">
                  <div className="user-avatar"><i className={`fas ${u.role === 'admin' ? 'fa-crown' : u.role === 'methodist' ? 'fa-clipboard-list' : u.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div>
                  <div className="user-details">
                    <div className="user-name">{u.full_name}</div>
                    <div className="user-meta">@{u.username} • {ROLES[u.role]}{u.group_name && ` • Группа: ${u.group_name}`}</div>
                  </div>
                  {u.id !== user?.id && <button onClick={() => handleDeleteUser(u.id)} className="delete-user-btn"><i className="fas fa-trash-alt"></i></button>}
                </div>
              ))}
            </div>
          </div>
          
          <div className="teachers-link-section">
            <h3><i className="fas fa-link"></i> Привязка преподавателей к учетным записям</h3>
            <div className="teachers-link-list">
              {teachers.map(teacher => {
                const linkedUser = users.find(u => u.id === teacher.user_id);
                const isLinked = teacher.user_id !== null;
                
                return (
                  <div key={teacher.id} className="teacher-link-card">
                    <div className="teacher-info">
                      <span className="teacher-name"><i className="fas fa-chalkboard-teacher"></i> {teacher.name}</span>
                      {isLinked ? (
                        <span className="linked-badge"><i className="fas fa-check-circle"></i> Привязан: {linkedUser?.full_name}</span>
                      ) : (
                        <span className="unlinked-badge"><i className="fas fa-exclamation-triangle"></i> Не привязан</span>
                      )}
                    </div>
                    
                    {!isLinked ? (
                      <div className="link-controls">
                        <select className="user-select" id={`teacher-select-${teacher.id}`} defaultValue="">
                          <option value="" disabled>Выберите пользователя...</option>
                          {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} (@{u.username})</option>)}
                        </select>
                        <button onClick={() => {
                          const select = document.getElementById(`teacher-select-${teacher.id}`);
                          const userId = select.value;
                          if (userId) linkTeacherToUser(teacher.id, parseInt(userId));
                          else showNotification('Выберите пользователя', 'error');
                        }} className="link-button"><i className="fas fa-link"></i> Привязать</button>
                      </div>
                    ) : (
                      <button onClick={() => unlinkTeacher(teacher.id)} className="unlink-button"><i className="fas fa-unlink"></i> Отвязать</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  if (authChecking) {
    return <div className="loading-screen"><div className="spinner-large"></div><p>Загрузка системы...</p></div>;
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
              <p className="hero-description">Современная платформа для просмотра расписания в колледже.</p>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => setShowLogin(true)}><i className="fas fa-sign-in-alt"></i> Войти в систему</button>
              </div>
            </div>
          </div>
        </div>
        
        {showLogin && createPortal(
          <div className="modal" onClick={() => setShowLogin(false)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2><i className="fas fa-sign-in-alt"></i> Вход в систему</h2>
                <button className="modal-close" onClick={() => setShowLogin(false)}><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={handleLogin} className="modal-form">
                <div className="form-group"><label><i className="fas fa-user"></i> Логин</label><input type="text" placeholder="Введите логин" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required autoFocus /></div>
                <div className="form-group"><label><i className="fas fa-lock"></i> Пароль</label><input type="password" placeholder="Введите пароль" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required /></div>
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
      
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
        <i className="fas fa-bars"></i>
      </button>
      
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <i className="fas fa-calendar-alt"></i>
          <span className="brand-name">Расписание</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}><i className="fas fa-times"></i></button>
        </div>
        
        <div className="sidebar-profile">
          <div className="profile-avatar"><i className={`fas ${user.role === 'admin' ? 'fa-clipboard-list' : user.role === 'methodist' ? 'fa-clipboard-list' : user.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div>
          <div className="profile-info">
            <div className="profile-name">{user.fullName}</div>
            <div className="profile-role">{ROLES[user.role]}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); }}>
            <i className="fas fa-calendar-week"></i><span>Расписание</span>
          </button>
          
          {isTeacher && (
            <button className={`nav-item ${activeTab === 'my-lessons' ? 'active' : ''}`} onClick={() => { setActiveTab('my-lessons'); setSidebarOpen(false); }}>
              <i className="fas fa-chalkboard-teacher"></i><span>Мои занятия</span>
            </button>
          )}
          
          {(user?.role === 'methodist' || user?.role === 'admin') && (
            <>
              <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}>
                <i className="fas fa-plus-circle"></i><span>Управление</span>
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
              {activeTab === 'schedule' && 'Расписание занятий'}
              {activeTab === 'my-lessons' && 'Мои занятия'}
              {activeTab === 'manage-schedule' && 'Управление расписанием'}
              {activeTab === 'directories' && 'Справочники'}
              {activeTab === 'users' && 'Управление пользователями'}
            </h1>
          </div>
          <div className="header-actions-right">
            <button className="theme-toggle-header" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button>
            <div className="header-role"><span className="role-badge">{ROLES[user.role]}</span></div>
          </div>
        </header>
        
        <div className="app-content">{renderMainContent()}</div>
      </main>

      {/* Модальные окна */}
      {showRegister && createPortal(
        <div className="modal" onClick={() => setShowRegister(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><i className="fas fa-user-plus"></i> Создать пользователя</h2><button className="modal-close" onClick={() => setShowRegister(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={handleRegister} className="modal-form">
              <div className="form-group"><label>Логин</label><input placeholder="Логин" value={registerData.username} onChange={e => setRegisterData({...registerData, username: e.target.value})} required /></div>
              <div className="form-group"><label>Пароль</label><input type="password" placeholder="Пароль" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} required /></div>
              <div className="form-group"><label>ФИО</label><input placeholder="ФИО" value={registerData.fullName} onChange={e => setRegisterData({...registerData, fullName: e.target.value})} required /></div>
              <div className="form-group"><label>Роль</label>
                <select value={registerData.role} onChange={e => setRegisterData({...registerData, role: e.target.value})}>
                  <option value="student">Студент</option><option value="teacher">Преподаватель</option><option value="methodist">Методист</option>
                </select>
              </div>
              {registerData.role === 'student' && (
                <div className="form-group"><label>Группа</label>
                  <select value={registerData.groupId} onChange={e => setRegisterData({...registerData, groupId: e.target.value})}>
                    <option value="">Выберите группу</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="submit-btn"><i className="fas fa-check"></i> Создать</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showGroupModal && createPortal(
        <div className="modal" onClick={() => setShowGroupModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><i className="fas fa-users"></i> Добавить группу</h2><button className="modal-close" onClick={() => setShowGroupModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={(e) => { e.preventDefault(); addDirectory('groups', newGroup, setShowGroupModal, setNewGroup); }} className="modal-form">
              <div className="form-group"><label>Название группы</label><input placeholder="Например: ИС-21" value={newGroup} onChange={e => setNewGroup(e.target.value)} required autoFocus /></div>
              <button type="submit" className="submit-btn"><i className="fas fa-plus"></i> Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showTeacherModal && createPortal(
        <div className="modal" onClick={() => setShowTeacherModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><i className="fas fa-chalkboard-teacher"></i> Добавить преподавателя</h2><button className="modal-close" onClick={() => setShowTeacherModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={(e) => { e.preventDefault(); addDirectory('teachers', newTeacher, setShowTeacherModal, setNewTeacher); }} className="modal-form">
              <div className="form-group"><label>ФИО преподавателя</label><input placeholder="Иванов Иван Иванович" value={newTeacher} onChange={e => setNewTeacher(e.target.value)} required autoFocus /></div>
              <button type="submit" className="submit-btn"><i className="fas fa-plus"></i> Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showSubjectModal && createPortal(
        <div className="modal" onClick={() => setShowSubjectModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><i className="fas fa-book"></i> Добавить предмет</h2><button className="modal-close" onClick={() => setShowSubjectModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={(e) => { e.preventDefault(); addDirectory('subjects', newSubject, setShowSubjectModal, setNewSubject); }} className="modal-form">
              <div className="form-group"><label>Название предмета</label><input placeholder="Например: Математика" value={newSubject} onChange={e => setNewSubject(e.target.value)} required autoFocus /></div>
              <button type="submit" className="submit-btn"><i className="fas fa-plus"></i> Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showClassroomModal && createPortal(
        <div className="modal" onClick={() => setShowClassroomModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><i className="fas fa-door-open"></i> Добавить аудиторию</h2><button className="modal-close" onClick={() => setShowClassroomModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={handleAddClassroom} className="modal-form">
              <div className="form-group"><label>Номер аудитории</label><input placeholder="Например: 305" value={newClassroom} onChange={e => setNewClassroom(e.target.value)} required autoFocus /></div>
              <button type="submit" className="submit-btn"><i className="fas fa-plus"></i> Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showEditModal && editingLesson && createPortal(
        <div className="modal" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-calendar-plus"></i> {editingLesson.id ? 'Редактировать занятие' : 'Добавить занятие'}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editingLesson.group_id || !editingLesson.teacher_id || !editingLesson.subject_id) {
                showNotification('Заполните все поля!', 'error');
                return;
              }
              try {
                const url = editingLesson.id ? `/api/schedule/${editingLesson.id}` : '/api/schedule';
                const method = editingLesson.id ? 'PUT' : 'POST';
                const response = await fetch(url, {
                  method: method,
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    group_id: parseInt(editingLesson.group_id),
                    teacher_id: parseInt(editingLesson.teacher_id),
                    subject_id: parseInt(editingLesson.subject_id),
                    classroom_id: editingLesson.classroom_id ? parseInt(editingLesson.classroom_id) : null,
                    pair_number: parseInt(editingLesson.pair_number),
                    day_of_week: parseInt(editingLesson.day_of_week)
                  })
                });
                const data = await response.json();
                if (response.ok) {
                  showNotification(editingLesson.id ? 'Занятие обновлено!' : 'Занятие добавлено!', 'success');
                  setShowEditModal(false);
                  setEditingLesson(null);
                  loadData();
                } else {
                  showNotification(data.error || 'Ошибка', 'error');
                }
              } catch (error) {
                showNotification('Ошибка: ' + error.message, 'error');
              }
            }} className="modal-form">
              <div className="form-group"><label>Группа</label>
                <select value={editingLesson.group_id || ''} onChange={e => setEditingLesson({...editingLesson, group_id: e.target.value})} required>
                  <option value="">Выберите группу</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Предмет</label>
                <select value={editingLesson.subject_id || ''} onChange={e => setEditingLesson({...editingLesson, subject_id: e.target.value})} required>
                  <option value="">Выберите предмет</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Преподаватель</label>
                <select value={editingLesson.teacher_id || ''} onChange={e => setEditingLesson({...editingLesson, teacher_id: e.target.value})} required>
                  <option value="">Выберите преподавателя</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Аудитория</label>
                <select value={editingLesson.classroom_id || ''} onChange={e => setEditingLesson({...editingLesson, classroom_id: e.target.value})}>
                  <option value="">Не выбрана</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="submit-btn"><i className="fas fa-save"></i> {editingLesson.id ? 'Сохранить' : 'Добавить'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <HomeContent />
    </ThemeProvider>
  );
}