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
const ROLES = { admin: 'Администратор', teacher: 'Преподаватель', student: 'Студент' };

// Компонент таблицы расписания
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
                        </div>
                        {canEdit && (
                          <div className="lesson-actions">
                            <button className="action-btn edit-btn" onClick={() => onEditClick(lesson)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="action-btn delete-btn" onClick={() => onDeleteClick(lesson.id)}>
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      canEdit && onAddClick && (
                        <button className="add-lesson-trigger" onClick={() => onAddClick({ day_of_week: dayIndex + 1, pair_number: pair.number })}>
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

// Компонент панели преподавателя
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
                          <span>Аудитория: <strong>{lesson.classroom_name || '—'}</strong></span>
                        </div>
                        <div className="teacher-controls">
                          <textarea 
                            placeholder="Заметки (домашнее задание, материалы...)"
                            value={currentData?.notes || ''}
                            onChange={(e) => onNotesChange(lesson.id, e.target.value)}
                            rows="3"
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
  const [filteredSchedule, setFilteredSchedule] = useState([]);
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

  // Отчет по часам
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [localData, setLocalData] = useState({});
  const [hasChanges, setHasChanges] = useState({});
  const [saving, setSaving] = useState({});

  const showNotification = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const isAdmin = user && user.role === 'admin';
  const isTeacher = user && user.role === 'teacher';
  const canEditSchedule = isAdmin;

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
      
      const scheduleData = await scheduleRes.json();
      const groupsData = await groupsRes.json();
      const teachersData = await teachersRes.json();
      const subjectsData = await subjectsRes.json();
      const classroomsData = await classroomsRes.json();
      
      setSchedule(Array.isArray(scheduleData) ? scheduleData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setClassrooms(Array.isArray(classroomsData) ? classroomsData : []);
    } catch (e) {
      console.error(e);
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  };

  const getFilteredSchedule = () => {
    let filtered = [...schedule];
    if (selectedGroupFilter && isAdmin) {
      filtered = filtered.filter(s => s.group_id === parseInt(selectedGroupFilter));
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

  const linkTeacherToUser = async (teacherId, userId) => {
    try {
      const res = await fetch('/api/teachers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teacherId, userId })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('Преподаватель привязан', 'success');
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

  const generateReport = async () => {
    if (!selectedTeacher) {
      showNotification('Выберите преподавателя', 'error');
      return;
    }

    setReportLoading(true);
    try {
      const res = await fetch(`/api/report/hours?teacherId=${selectedTeacher}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        setReportData(data);
        showNotification('Отчет сформирован', 'success');
      } else {
        showNotification(data.error || 'Ошибка загрузки отчета', 'error');
      }
    } catch (error) {
      showNotification('Ошибка загрузки отчета', 'error');
    } finally {
      setReportLoading(false);
    }
  };

  const exportReportToExcel = () => {
    if (!reportData) return;
    
    const exportData = reportData.lessons.map(lesson => ({
      'Группа': lesson.group_name,
      'Предмет': lesson.subject_name,
      'День недели': DAYS[lesson.day_of_week - 1],
      'Пара': lesson.pair_number
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Отчет_${reportData.teacher.name}`);
    XLSX.writeFile(wb, `Отчет_${reportData.teacher.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Отчет экспортирован', 'success');
  };

  const exportToExcel = () => {
    const dataToExport = filteredSchedule.length > 0 ? filteredSchedule : schedule;
    const exportData = dataToExport.map(lesson => ({
      'День недели': DAYS[lesson.day_of_week - 1],
      'Пара': `${lesson.pair_number} (${PAIRS[lesson.pair_number - 1].time})`,
      'Группа': lesson.group_name,
      'Предмет': lesson.subject_name,
      'Преподаватель': lesson.teacher_name,
      'Аудитория': lesson.classroom_name || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Расписание");
    XLSX.writeFile(wb, `Расписание_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Excel файл сохранен', 'success');
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
    if (token && isAdmin) loadUsers();
  }, [token, isAdmin]);

  useEffect(() => {
    if (isTeacher && schedule.length > 0) {
      const initialData = {};
      schedule.forEach(lesson => { initialData[lesson.id] = { notes: lesson.notes || '' }; });
      setLocalData(initialData);
    }
  }, [schedule, isTeacher]);

  const filteredScheduleResult = getFilteredSchedule();
  const availableUsers = users.filter(u => {
    if (u.role !== 'teacher') return false;
    const isAlreadyLinked = teachers.some(t => t.user_id === u.id);
    return !isAlreadyLinked;
  });

  const renderMainContent = () => {
    // Публичное расписание (без входа)
    if (!user) {
      return (
        <div className="public-schedule">
          <div className="content-card">
            <div className="content-header">
              <h2><i className="fas fa-calendar-alt"></i> Расписание занятий</h2>
              <div className="header-actions">
                <button className="action-button export-excel" onClick={exportToExcel}>
                  <i className="fas fa-file-excel"></i> Excel
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="loading-state"><div className="spinner"></div><p>Загрузка расписания...</p></div>
            ) : schedule.length === 0 ? (
              <div className="empty-state"><i className="fas fa-calendar-times"></i><p>Нет занятий</p></div>
            ) : (
              <ScheduleGrid data={schedule} canEdit={false} />
            )}
          </div>
        </div>
      );
    }

    // Расписание для авторизованных
    if (activeTab === 'schedule') {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-calendar-alt"></i> Расписание занятий</h2>
              {isAdmin && (
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
            </div>
          </div>
          
          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Загрузка расписания...</p></div>
          ) : filteredScheduleResult.length === 0 ? (
            <div className="empty-state"><i className="fas fa-calendar-times"></i><p>Нет занятий</p></div>
          ) : (
            <ScheduleGrid data={filteredScheduleResult} canEdit={false} />
          )}
        </div>
      );
    }
    
    // Мои занятия (только для учителя)
    if (activeTab === 'my-lessons' && isTeacher) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-chalkboard-teacher"></i> Мои занятия</h2>
          </div>
          
          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Загрузка...</p></div>
          ) : filteredScheduleResult.length === 0 ? (
            <div className="empty-state"><i className="fas fa-info-circle"></i><p>Нет назначенных занятий</p></div>
          ) : (
            <TeacherPanel 
              data={filteredScheduleResult}
              localData={localData}
              hasChanges={hasChanges}
              saving={saving}
              onNotesChange={handleNotesChange}
              onSave={handleSaveLesson}
              onCancel={(lessonId) => {
                const lesson = filteredScheduleResult.find(l => l.id === lessonId);
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
    
    // Управление расписанием (только админ)
    if (activeTab === 'manage-schedule' && isAdmin) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2><i className="fas fa-plus-circle"></i> Управление расписанием</h2>
            <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} className="group-filter">
              <option value="">Все группы</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          
          <div className="add-lesson-section">
            <h3><i className="fas fa-plus"></i> Добавить новое занятие</h3>
            <form onSubmit={handleAddLesson} className="add-lesson-form">
              <div className="form-grid">
                <div className="form-field">
                  <label>Группа</label>
                  <select value={newLesson.group_id} onChange={e => setNewLesson({...newLesson, group_id: e.target.value})} required>
                    <option value="">Выберите группу</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Предмет</label>
                  <select value={newLesson.subject_id} onChange={e => setNewLesson({...newLesson, subject_id: e.target.value})} required>
                    <option value="">Выберите предмет</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Преподаватель</label>
                  <select value={newLesson.teacher_id} onChange={e => setNewLesson({...newLesson, teacher_id: e.target.value})} required>
                    <option value="">Выберите преподавателя</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Аудитория</label>
                  <select value={newLesson.classroom_id} onChange={e => setNewLesson({...newLesson, classroom_id: e.target.value})}>
                    <option value="">Не указана</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>День недели</label>
                  <select value={newLesson.day_of_week} onChange={e => setNewLesson({...newLesson, day_of_week: e.target.value})}>
                    {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Пара</label>
                  <select value={newLesson.pair_number} onChange={e => setNewLesson({...newLesson, pair_number: e.target.value})}>
                    {PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="submit-button">Добавить занятие</button>
            </form>
          </div>
          
          <div className="schedule-editor">
            <h3>Редактирование расписания</h3>
            {loading ? (
              <div className="loading-state"><div className="spinner"></div></div>
            ) : filteredScheduleResult.length === 0 ? (
              <div className="empty-state"><i className="fas fa-calendar-times"></i><p>Нет занятий</p></div>
            ) : (
              <ScheduleGrid 
                data={filteredScheduleResult} 
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
    
    // Справочники (только админ)
    if (activeTab === 'directories' && isAdmin) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2>Справочники</h2>
          </div>
          
          <div className="directories-grid">
            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-users"></i>
                <h3>Группы</h3>
                <button className="add-dir-btn" onClick={() => setShowGroupModal(true)}>+</button>
              </div>
              <div className="directory-list">
                {groups.map(g => (
                  <div key={g.id} className="directory-item">
                    <span>{g.name}</span>
                    <button onClick={() => deleteDirectory('groups', g.id)} className="delete-item-btn">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-chalkboard-teacher"></i>
                <h3>Преподаватели</h3>
                <button className="add-dir-btn" onClick={() => setShowTeacherModal(true)}>+</button>
              </div>
              <div className="directory-list">
                {teachers.map(t => (
                  <div key={t.id} className="directory-item">
                    <span>{t.name}</span>
                    <button onClick={() => deleteDirectory('teachers', t.id)} className="delete-item-btn">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-book"></i>
                <h3>Предметы</h3>
                <button className="add-dir-btn" onClick={() => setShowSubjectModal(true)}>+</button>
              </div>
              <div className="directory-list">
                {subjects.map(s => (
                  <div key={s.id} className="directory-item">
                    <span>{s.name}</span>
                    <button onClick={() => deleteDirectory('subjects', s.id)} className="delete-item-btn">🗑️</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="directory-card">
              <div className="directory-header">
                <i className="fas fa-door-open"></i>
                <h3>Аудитории</h3>
                <button className="add-dir-btn" onClick={() => setShowClassroomModal(true)}>+</button>
              </div>
              <div className="directory-list">
                {classrooms.map(c => (
                  <div key={c.id} className="directory-item">
                    <span>{c.name}</span>
                    <button onClick={() => handleDeleteClassroom(c.id)} className="delete-item-btn">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Управление пользователями (только админ)
    if (activeTab === 'users' && isAdmin) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2>Управление пользователями</h2>
            <button className="action-button primary" onClick={() => setShowRegister(true)}>
              Создать пользователя
            </button>
          </div>
          
          <div className="users-section">
            <h3>Список пользователей</h3>
            <div className="users-list">
              {users.map(u => (
                <div key={u.id} className="user-card">
                  <div className="user-avatar">
                    <i className={`fas ${u.role === 'admin' ? 'fa-crown' : u.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i>
                  </div>
                  <div className="user-details">
                    <div className="user-name">{u.full_name}</div>
                    <div className="user-meta">@{u.username} • {ROLES[u.role]}{u.group_name && ` • Группа: ${u.group_name}`}</div>
                  </div>
                  {u.id !== user?.id && (
                    <button onClick={() => handleDeleteUser(u.id)} className="delete-user-btn">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="teachers-link-section">
            <h3>Привязка преподавателей к учетным записям</h3>
            <div className="teachers-link-list">
              {teachers.map(teacher => {
                const linkedUser = users.find(u => u.id === teacher.user_id);
                const isLinked = teacher.user_id !== null;
                
                return (
                  <div key={teacher.id} className="teacher-link-card">
                    <div className="teacher-info">
                      <span className="teacher-name">{teacher.name}</span>
                      {isLinked ? (
                        <span className="linked-badge">Привязан: {linkedUser?.full_name}</span>
                      ) : (
                        <span className="unlinked-badge">Не привязан</span>
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
                        }} className="link-button">Привязать</button>
                      </div>
                    ) : (
                      <button onClick={() => unlinkTeacher(teacher.id)} className="unlink-button">Отвязать</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Отчет по часам (только админ)
    if (activeTab === 'report' && isAdmin) {
      return (
        <div className="content-card">
          <div className="content-header">
            <h2>Отчет по часам преподавателя</h2>
          </div>
          
          <div className="add-lesson-section">
            <div className="form-grid">
              <div className="form-field">
                <label>Преподаватель</label>
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                  <option value="">Выберите преподавателя</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            
            <button className="submit-btn" onClick={generateReport} disabled={reportLoading}>
              {reportLoading ? 'Загрузка...' : 'Сформировать отчет'}
            </button>
          </div>

          {reportData && (
            <div className="schedule-editor">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3>Отчет: {reportData.teacher.name}</h3>
                <button className="action-button export-excel" onClick={exportReportToExcel}>
                  Экспорт в Excel
                </button>
              </div>

              <div className="form-grid" style={{ marginBottom: '20px' }}>
                <div className="summary-card">Всего часов: {reportData.summary.totalHours}</div>
                <div className="summary-card">Будние дни: {reportData.summary.weekdayHours}</div>
                <div className="summary-card">Субботы: {reportData.summary.saturdayHours}</div>
                <div className="summary-card">Всего занятий: {reportData.summary.totalLessons}</div>
              </div>

              <div className="schedule-grid-wrapper">
                <table className="schedule-grid">
                  <thead>
                    <tr><th>Группа</th><th>Предмет</th><th>День недели</th><th>Пара</th></tr>
                  </thead>
                  <tbody>
                    {reportData.lessons.map(lesson => (
                      <tr key={lesson.id}>
                        <td>{lesson.group_name}</td>
                        <td>{lesson.subject_name}</td>
                        <td>{DAYS[lesson.day_of_week - 1]}</td>
                        <td>{lesson.pair_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="spinner-large"></div>
        <p>Загрузка системы...</p>
      </div>
    );
  }

  // Если пользователь не авторизован - показываем публичную страницу
  if (!user) {
    return (
      <>
        {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
        
        <div className="public-page">
          <header className="public-header">
            <div className="header-container">
              <div className="logo">
                <i className="fas fa-calendar-alt"></i>
                <span>Расписание колледжа</span>
              </div>
              <button className="login-btn" onClick={() => setShowLogin(true)}>
                <i className="fas fa-sign-in-alt"></i> Управление
              </button>
            </div>
          </header>

          <main className="public-main">
            <div className="container">
              <div className="page-title">
                <h1>Учебное расписание</h1>
                <p>Просмотр расписания занятий всех групп</p>
              </div>

              <div className="filters-card">
                <div className="filters-header">
                  <h3>Фильтрация расписания</h3>
                  {selectedGroupFilter && (
                    <button className="reset-btn" onClick={() => setSelectedGroupFilter('')}>Сбросить</button>
                  )}
                </div>
                
                <div className="filters-grid">
                  <div className="filter-field">
                    <label>Группа</label>
                    <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)}>
                      <option value="">Все группы</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="results-info">
                <span className="results-count">Найдено: {schedule.length} занятий</span>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Загрузка расписания...</p>
                </div>
              ) : schedule.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-calendar-times"></i>
                  <p>Занятия не найдены</p>
                </div>
              ) : (
                <ScheduleGrid data={schedule} canEdit={false} />
              )}
            </div>
          </main>
        </div>

        {showLogin && createPortal(
          <div className="modal-overlay" onClick={() => setShowLogin(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Вход в систему</h2>
                <button className="modal-close" onClick={() => setShowLogin(false)}>&times;</button>
              </div>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Логин</label>
                  <input type="text" placeholder="Введите логин" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Пароль</label>
                  <input type="password" placeholder="Введите пароль" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required />
                </div>
                <button type="submit" className="submit-btn">Войти</button>
              </form>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Админ-панель (для авторизованных пользователей)
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
          <div className="profile-avatar">
            <i className={`fas ${user.role === 'admin' ? 'fa-crown' : user.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i>
          </div>
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
          
          {isAdmin && (
            <>
              <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}>
                <i className="fas fa-plus-circle"></i><span>Управление</span>
              </button>
              <button className={`nav-item ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => { setActiveTab('directories'); setSidebarOpen(false); }}>
                <i className="fas fa-database"></i><span>Справочники</span>
              </button>
              <button className={`nav-item ${activeTab === 'report' ? 'active' : ''}`} onClick={() => { setActiveTab('report'); setSidebarOpen(false); }}>
                <i className="fas fa-chart-line"></i><span>Отчет по часам</span>
              </button>
              <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}>
                <i className="fas fa-users-cog"></i><span>Пользователи</span>
              </button>
            </>
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
              {activeTab === 'report' && 'Отчет по часам'}
            </h1>
          </div>
          <div className="header-actions-right">
            <button className="theme-toggle-header" onClick={toggleTheme}>
              <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>
            <div className="role-badge">{ROLES[user.role]}</div>
          </div>
        </header>
        
        <div className="app-content">{renderMainContent()}</div>
      </main>

      {/* Модальные окна */}
      {showRegister && createPortal(
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Создать пользователя</h2>
              <button className="modal-close" onClick={() => setShowRegister(false)}>&times;</button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Логин</label>
                <input placeholder="Логин" value={registerData.username} onChange={e => setRegisterData({...registerData, username: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Пароль</label>
                <input type="password" placeholder="Пароль" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>ФИО</label>
                <input placeholder="ФИО" value={registerData.fullName} onChange={e => setRegisterData({...registerData, fullName: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Роль</label>
                <select value={registerData.role} onChange={e => setRegisterData({...registerData, role: e.target.value})}>
                  <option value="student">Студент</option>
                  <option value="teacher">Преподаватель</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              {registerData.role === 'student' && (
                <div className="form-group">
                  <label>Группа</label>
                  <select value={registerData.groupId} onChange={e => setRegisterData({...registerData, groupId: e.target.value})}>
                    <option value="">Выберите группу</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="submit-btn">Создать</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showGroupModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить группу</h2>
              <button className="modal-close" onClick={() => setShowGroupModal(false)}>&times;</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addDirectory('groups', newGroup, setShowGroupModal, setNewGroup); }}>
              <div className="form-group">
                <label>Название группы</label>
                <input placeholder="Например: ИС-21" value={newGroup} onChange={e => setNewGroup(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showTeacherModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowTeacherModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить преподавателя</h2>
              <button className="modal-close" onClick={() => setShowTeacherModal(false)}>&times;</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addDirectory('teachers', newTeacher, setShowTeacherModal, setNewTeacher); }}>
              <div className="form-group">
                <label>ФИО преподавателя</label>
                <input placeholder="Иванов Иван Иванович" value={newTeacher} onChange={e => setNewTeacher(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showSubjectModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить предмет</h2>
              <button className="modal-close" onClick={() => setShowSubjectModal(false)}>&times;</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addDirectory('subjects', newSubject, setShowSubjectModal, setNewSubject); }}>
              <div className="form-group">
                <label>Название предмета</label>
                <input placeholder="Например: Математика" value={newSubject} onChange={e => setNewSubject(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showClassroomModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowClassroomModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить аудиторию</h2>
              <button className="modal-close" onClick={() => setShowClassroomModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddClassroom}>
              <div className="form-group">
                <label>Номер аудитории</label>
                <input placeholder="Например: 305" value={newClassroom} onChange={e => setNewClassroom(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="submit-btn">Добавить</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showEditModal && editingLesson && createPortal(
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLesson.id ? 'Редактировать занятие' : 'Добавить занятие'}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateLesson}>
              <div className="form-group">
                <label>Группа</label>
                <select value={editingLesson.group_id || ''} onChange={e => setEditingLesson({...editingLesson, group_id: e.target.value})} required>
                  <option value="">Выберите группу</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Предмет</label>
                <select value={editingLesson.subject_id || ''} onChange={e => setEditingLesson({...editingLesson, subject_id: e.target.value})} required>
                  <option value="">Выберите предмет</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Преподаватель</label>
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
              <div className="form-group">
                <label>День недели</label>
                <select value={editingLesson.day_of_week || '1'} onChange={e => setEditingLesson({...editingLesson, day_of_week: e.target.value})}>
                  {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Пара</label>
                <select value={editingLesson.pair_number || '1'} onChange={e => setEditingLesson({...editingLesson, pair_number: e.target.value})}>
                  {PAIRS.map(p => <option key={p.number} value={p.number}>{p.name} ({p.time})</option>)}
                </select>
              </div>
              <button type="submit" className="submit-btn">Сохранить</button>
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