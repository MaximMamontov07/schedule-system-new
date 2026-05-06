'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

// Компоненты
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import { SearchableSelect } from './components/SearchableSelect';
import { DatePicker } from './components/DatePicker';
import { ScheduleFilters } from './components/ScheduleFilters';
import { ScheduleGrid } from './components/ScheduleGrid';
import { LessonModal } from './components/LessonModal';
import { TeacherPanel } from './components/TeacherPanel';
import { TeacherReportModal } from './components/TeacherReportModal';

// Хуки и сервисы
import { useSchedule } from './components/hooks/useSchedule';
import { ScheduleService, DateUtils, DAYS, PAIRS, ROLES } from '@/lib/schedule-service';

// ============ Компонент управления справочниками ============
const DirectoriesManager = ({ groups, teachers, subjects, classrooms, onAdd, onDelete, canEdit }) => {
  const [showModal, setShowModal] = useState(null);
  const [newItemName, setNewItemName] = useState('');

  const handleAdd = async (type) => {
    if (!newItemName.trim()) return;
    await onAdd(type, newItemName.trim());
    setNewItemName('');
    setShowModal(null);
  };

  const directoryConfigs = [
    { type: 'groups', icon: 'fas fa-users', title: 'Группы', items: groups, color: '#2c5f2d' },
    { type: 'teachers', icon: 'fas fa-chalkboard-teacher', title: 'Преподаватели', items: teachers, color: '#2c3e66' },
    { type: 'subjects', icon: 'fas fa-book', title: 'Предметы', items: subjects, color: '#c4a35a' },
    { type: 'classrooms', icon: 'fas fa-door-open', title: 'Аудитории', items: classrooms, color: '#4a6fa5' }
  ];

  return (
    <div className="directories-grid">
      {directoryConfigs.map(config => (
        <div key={config.type} className="directory-card">
          <div className="directory-header" style={{ borderLeftColor: config.color }}>
            <i className={config.icon} style={{ color: config.color }}></i>
            <h3>{config.title}</h3>
            {canEdit && (
              <button className="add-dir-btn" onClick={() => setShowModal(config.type)}>
                <i className="fas fa-plus"></i>
              </button>
            )}
          </div>
          <div className="directory-list">
            {config.items.map(item => (
              <div key={item.id} className="directory-item">
                <span>{item.name}</span>
                {canEdit && (
                  <button onClick={() => onDelete(config.type, item.id)} className="delete-item-btn">
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showModal && createPortal(
        <div className="modal" onClick={() => setShowModal(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-plus-circle"></i> Добавить в {directoryConfigs.find(c => c.type === showModal)?.title}</h2>
              <button className="modal-close" onClick={() => setShowModal(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>Название</label>
                <input 
                  type="text" 
                  value={newItemName} 
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="Введите название"
                  autoFocus
                  onKeyPress={e => e.key === 'Enter' && handleAdd(showModal)}
                />
              </div>
              <button className="submit-btn" onClick={() => handleAdd(showModal)}>
                <i className="fas fa-check"></i> Добавить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============ Компонент управления пользователями ============
const UsersManager = ({ users, teachers, groups, onDelete, onLink, onUnlink, canEdit, currentUserId }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({
    username: '', password: '', fullName: '', role: 'student', groupId: ''
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(registerData)
      });
      if (res.ok) {
        setShowRegister(false);
        setRegisterData({ username: '', password: '', fullName: '', role: 'student', groupId: '' });
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      alert('Ошибка регистрации');
    }
  };

  const groupOptions = groups.map(g => ({ value: String(g.id), label: g.name }));

  return (
    <div className="users-management">
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
              <div className="user-avatar">
                <i className={`fas ${u.role === 'admin' ? 'fa-crown' : u.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i>
              </div>
              <div className="user-details">
                <div className="user-name">{u.full_name}</div>
                <div className="user-meta">
                  @{u.username} • {ROLES[u.role]}
                  {u.group_name && ` • Группа: ${u.group_name}`}
                </div>
              </div>
              {u.id !== currentUserId && canEdit && (
                <button onClick={() => onDelete(u.id)} className="delete-user-btn">
                  <i className="fas fa-trash-alt"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="teachers-link-section">
        <h3><i className="fas fa-link"></i> Привязка преподавателей к учетным записям</h3>
        <div className="teachers-link-list">
          {teachers.map(teacher => {
            const linkedUser = users.find(u => u.id === teacher.user_id);
            const isLinked = !!teacher.user_id;
            const availableUsers = users.filter(u => u.role === 'teacher' && !teachers.some(t => t.user_id === u.id));
            
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
                    <SearchableSelect
                      options={availableUsers.map(u => ({ value: String(u.id), label: `${u.full_name} (@${u.username})` }))}
                      value=""
                      onChange={(val) => val && onLink(teacher.id, parseInt(val))}
                      placeholder="Выберите пользователя"
                      label=""
                      icon="fas fa-user"
                    />
                  </div>
                ) : (
                  <button onClick={() => onUnlink(teacher.id)} className="unlink-button">
                    <i className="fas fa-unlink"></i> Отвязать
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showRegister && createPortal(
        <div className="modal" onClick={() => setShowRegister(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-user-plus"></i> Создать пользователя</h2>
              <button className="modal-close" onClick={() => setShowRegister(false)}><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleRegister} className="modal-form">
              <div className="form-group">
                <label>Логин</label>
                <input type="text" value={registerData.username} onChange={e => setRegisterData({...registerData, username: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Пароль</label>
                <input type="password" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>ФИО</label>
                <input type="text" value={registerData.fullName} onChange={e => setRegisterData({...registerData, fullName: e.target.value})} required />
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
                  <SearchableSelect
                    options={groupOptions}
                    value={registerData.groupId}
                    onChange={(val) => setRegisterData({...registerData, groupId: val})}
                    placeholder="Выберите группу"
                    label=""
                    icon="fas fa-users"
                  />
                </div>
              )}
              <button type="submit" className="submit-btn"><i className="fas fa-check"></i> Создать</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============ Главный компонент приложения ============
function HomeContent() {
  const { theme, toggleTheme } = useTheme();
  
  // Состояния
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [notification, setNotification] = useState(null);
  
  // Справочники
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Состояния модальных окон
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [showTeacherReportModal, setShowTeacherReportModal] = useState(false);

  // Хук для работы с расписанием
  const scheduleHook = useSchedule(token, user?.role === 'student' ? user?.groupId : null);

  // Показ уведомлений
  const showNotification = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Загрузка справочников
  const loadDirectories = useCallback(async () => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
      const [groupsRes, teachersRes, subjectsRes, classroomsRes] = await Promise.all([
        fetch('/api/groups', { headers }),
        fetch('/api/teachers', { headers }),
        fetch('/api/subjects', { headers }),
        fetch('/api/classrooms', { headers })
      ]);
      setGroups(await groupsRes.json());
      setTeachers(await teachersRes.json());
      setSubjects(await subjectsRes.json());
      setClassrooms(await classroomsRes.json());
    } catch (error) {
      console.error('Failed to load directories:', error);
    }
  }, [token]);

  // Загрузка пользователей
  const loadUsers = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, [token, user]);

  // Эффекты
  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        if (JSON.parse(storedUser).role === 'teacher') {
          setActiveTab('my-lessons');
        }
      }
      setAuthChecking(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!authChecking) {
      loadDirectories();
      if (token) loadUsers();
    }
  }, [authChecking, token, loadDirectories, loadUsers]);

  // Обработчики
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
        if (data.user.role === 'teacher') setActiveTab('my-lessons');
      } else {
        showNotification(data.error, 'error');
      }
    } catch (error) {
      showNotification('Ошибка входа', 'error');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear();
    showNotification('Вы вышли из системы', 'info');
    setActiveTab('schedule');
  };

  const handleSaveLesson = async (formData) => {
    try {
      if (editingLesson) {
        await scheduleHook.updateLesson(editingLesson.id, formData);
        showNotification('Занятие обновлено');
      } else {
        await scheduleHook.createLesson(formData);
        showNotification('Занятие добавлено');
      }
      setShowLessonModal(false);
      setEditingLesson(null);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteLesson = async (id) => {
    if (confirm('Удалить занятие?')) {
      try {
        await scheduleHook.deleteLesson(id);
        showNotification('Занятие удалено');
      } catch (error) {
        showNotification(error.message, 'error');
      }
    }
  };

  const handleAddDirectory = async (type, name) => {
    try {
      const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        showNotification('Добавлено');
        loadDirectories();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (error) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleDeleteDirectory = async (type, id) => {
    if (!confirm('Удалить?')) return;
    try {
      await fetch(`/api/${type}?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Удалено');
      loadDirectories();
    } catch (error) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Удалить пользователя?')) return;
    try {
      await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Пользователь удалён');
      loadUsers();
    } catch (error) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleLinkTeacher = async (teacherId, userId) => {
    try {
      const res = await fetch('/api/teachers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teacherId, userId })
      });
      if (res.ok) {
        showNotification('Преподаватель привязан');
        loadDirectories();
        loadUsers();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (error) {
      showNotification('Ошибка', 'error');
    }
  };

  const handleUnlinkTeacher = async (teacherId) => {
    if (!confirm('Отвязать преподавателя?')) return;
    try {
      await fetch(`/api/teachers/link?teacherId=${teacherId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      showNotification('Привязка удалена');
      loadDirectories();
      loadUsers();
    } catch (error) {
      showNotification('Ошибка', 'error');
    }
  };

  const exportToExcel = () => {
    const exportData = scheduleHook.schedule.map(lesson => ({
      'День недели': DAYS.find(d => d.value === lesson.day_of_week)?.name || '-',
      'Дата': lesson.date ? new Date(lesson.date).toLocaleDateString('ru-RU') : '-',
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
    XLSX.writeFile(wb, `Расписание_${DateUtils.formatDate(new Date(), 'iso')}.xlsx`);
    showNotification('Excel файл сохранен');
  };

  const exportToPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.createElement('div');
      element.innerHTML = `
        <html>
          <head><meta charset="UTF-8"><title>Расписание</title></head>
          <body>
            <h1>Расписание занятий</h1>
            <p>Неделя: ${DateUtils.formatDate(scheduleHook.weekDates[0])} - ${DateUtils.formatDate(scheduleHook.weekDates[6])}</p>
            <table border="1" cellpadding="8">
              <thead><tr><th>День</th><th>Дата</th><th>Время</th><th>Группа</th><th>Предмет</th><th>Преподаватель</th><th>Аудитория</th><th>Заметки</th></tr></thead>
              <tbody>
                ${scheduleHook.schedule.map(lesson => `
                  <tr>
                    <td>${DAYS.find(d => d.value === lesson.day_of_week)?.name || '-'}</td>
                    <td>${lesson.date ? new Date(lesson.date).toLocaleDateString('ru-RU') : '-'}</td>
                    <td>${PAIRS[lesson.pair_number - 1].time}</td>
                    <td>${lesson.group_name}</td>
                    <td>${lesson.subject_name}</td>
                    <td>${lesson.teacher_name}</td>
                    <td>${lesson.classroom_name || '—'}</td>
                    <td>${lesson.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      await html2pdf().from(element).save();
      showNotification('PDF файл сохранен');
    } catch (error) {
      showNotification('Ошибка экспорта PDF', 'error');
    }
  };

  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin;

  // Рендер сайдбара
  const renderSidebar = () => (
    <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <i className="fas fa-calendar-alt"></i>
        <span className="brand-name">Расписание</span>
        <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="sidebar-profile">
        <div className="profile-avatar">
          <i className={`fas ${isAdmin ? 'fa-crown' : isTeacher ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i>
        </div>
        <div className="profile-info">
          <div className="profile-name">{user?.fullName}</div>
          <div className="profile-role">{ROLES[user?.role]}</div>
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
        
        {isAdmin && (
          <>
            <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}>
              <i className="fas fa-plus-circle"></i><span>Управление</span>
            </button>
            <button className={`nav-item ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => { setActiveTab('directories'); setSidebarOpen(false); }}>
              <i className="fas fa-database"></i><span>Справочники</span>
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
  );

  // Рендер контента в зависимости от вкладки
  const renderContent = () => {
    if (isTeacher) {
      const teacher = teachers.find(t => t.user_id === user?.id);
      const teacherLessons = teacher ? scheduleHook.allSchedule.filter(l => l.teacher_id === teacher.id) : [];
      
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-chalkboard-teacher"></i> Мои занятия</h2>
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
          
          <TeacherPanel
            data={teacherLessons}
            weekDates={scheduleHook.weekDates}
            onUpdateNotes={scheduleHook.updateNotes}
          />
        </div>
      );
    }

    if (activeTab === 'schedule') {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-calendar-alt"></i> Расписание занятий</h2>
              {user?.role === 'student' && user?.groupId && (
                <div className="student-group-badge">
                  <i className="fas fa-users"></i> Группа: {groups.find(g => g.id === user.groupId)?.name || '...'}
                </div>
              )}
            </div>
            <div className="header-actions">
              <button className="action-button export-excel" onClick={exportToExcel}>
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button className="action-button export-pdf" onClick={exportToPDF}>
                <i className="fas fa-file-pdf"></i> PDF
              </button>
              {isAdmin && (
                <button className="action-button report-hours" onClick={() => setShowTeacherReportModal(true)}>
                  <i className="fas fa-chart-line"></i> Отчет по часам
                </button>
              )}
            </div>
          </div>
          
          <ScheduleFilters
            filters={scheduleHook.filters}
            onFilterChange={scheduleHook.updateFilter}
            groups={groups}
            teachers={teachers}
            subjects={subjects}
            classrooms={classrooms}
            onReset={scheduleHook.resetFilters}
            onOpenCalendar={() => setShowCalendar(true)}
            currentDate={scheduleHook.currentDate}
            onPrevWeek={scheduleHook.goToPreviousWeek}
            onNextWeek={scheduleHook.goToNextWeek}
            onCurrentWeek={scheduleHook.goToCurrentWeek}
            selectedGroupId={scheduleHook.selectedGroupId}
            showGroupFilter={user?.role !== 'student'}
            isStudent={user?.role === 'student'}
            loading={scheduleHook.loading}
          />
          
          <ScheduleGrid
            data={scheduleHook.schedule}
            weekDates={scheduleHook.weekDates}
            canEdit={false}
            loading={scheduleHook.loading}
          />
        </div>
      );
    }

    if (activeTab === 'manage-schedule' && isAdmin) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-plus-circle"></i> Управление расписанием</h2>
            </div>
            <div className="header-actions">
              <button className="action-button primary" onClick={() => { setEditingLesson(null); setShowLessonModal(true); }}>
                <i className="fas fa-plus"></i> Добавить занятие
              </button>
              <button className="action-button export-excel" onClick={exportToExcel}>
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button className="action-button export-pdf" onClick={exportToPDF}>
                <i className="fas fa-file-pdf"></i> PDF
              </button>
            </div>
          </div>
          
          <ScheduleGrid
            data={scheduleHook.schedule}
            weekDates={scheduleHook.weekDates}
            canEdit={true}
            onEditClick={(lesson) => { setEditingLesson(lesson); setShowLessonModal(true); }}
            onDeleteClick={handleDeleteLesson}
            onAddClick={(slotData) => { setEditingLesson(slotData); setShowLessonModal(true); }}
            loading={scheduleHook.loading}
          />
        </div>
      );
    }

    if (activeTab === 'directories' && isAdmin) {
      return (
        <div className="content-card">
          <div className="content-header">
            <div className="header-left">
              <h2><i className="fas fa-database"></i> Справочники</h2>
            </div>
          </div>
          
          <DirectoriesManager
            groups={groups}
            teachers={teachers}
            subjects={subjects}
            classrooms={classrooms}
            onAdd={handleAddDirectory}
            onDelete={handleDeleteDirectory}
            canEdit={isAdmin}
          />
        </div>
      );
    }

    if (activeTab === 'users' && isAdmin) {
      return (
        <UsersManager
          users={users}
          teachers={teachers}
          groups={groups}
          onDelete={handleDeleteUser}
          onLink={handleLinkTeacher}
          onUnlink={handleUnlinkTeacher}
          canEdit={isAdmin}
          currentUserId={user?.id}
        />
      );
    }

    return null;
  };

  // Состояние загрузки
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

  // Страница входа
  if (!user) {
    return (
      <>
        {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
        <div className="landing-page">
          <div className="landing-content">
            <div className="landing-hero">
              <div className="hero-badge">
                <span><i className="fas fa-graduation-cap"></i> Расписание</span>
              </div>
              <h1 className="hero-title">
                Учебное расписание
                <br/>
                <span className="gradient-highlight">Колледжа</span>
              </h1>
              <p className="hero-description">
                Современная платформа для просмотра расписания в колледже
              </p>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => setShowLogin(true)}>
                  <i className="fas fa-sign-in-alt"></i> Войти в систему
                </button>
                <button className="btn-secondary" onClick={toggleTheme}>
                  <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                  {theme === 'light' ? ' Тёмная тема' : ' Светлая тема'}
                </button>
              </div>
            </div>
            
            <div className="public-schedule-section">
              <h2 className="section-title">
                <i className="fas fa-calendar-alt"></i> Расписание занятий
              </h2>
              <ScheduleFilters
                filters={scheduleHook.filters}
                onFilterChange={scheduleHook.updateFilter}
                groups={groups}
                teachers={teachers}
                subjects={subjects}
                classrooms={classrooms}
                onReset={scheduleHook.resetFilters}
                onOpenCalendar={() => setShowCalendar(true)}
                currentDate={scheduleHook.currentDate}
                onPrevWeek={scheduleHook.goToPreviousWeek}
                onNextWeek={scheduleHook.goToNextWeek}
                onCurrentWeek={scheduleHook.goToCurrentWeek}
                showGroupFilter={true}
                loading={scheduleHook.loading}
              />
              <ScheduleGrid
                data={scheduleHook.schedule}
                weekDates={scheduleHook.weekDates}
                canEdit={false}
                loading={scheduleHook.loading}
              />
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
                <div className="form-group">
                  <label><i className="fas fa-user"></i> Логин</label>
                  <input type="text" placeholder="Введите логин" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required autoFocus />
                </div>
                <div className="form-group">
                  <label><i className="fas fa-lock"></i> Пароль</label>
                  <input type="password" placeholder="Введите пароль" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required />
                </div>
                <button type="submit" className="submit-btn">
                  <i className="fas fa-sign-in-alt"></i> Войти
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Основной рендер для авторизованных пользователей
  return (
    <div className="app-container">
      {notification && <div className={`toast toast-${notification.type}`}>{notification.msg}</div>}
      
      {renderSidebar()}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      
      <main className="app-main">
        <header className="app-header">
          <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)}>
            <i className="fas fa-bars"></i>
          </button>
          <div className="header-title">
            <h1>
              {isTeacher && 'Мои занятия'}
              {!isTeacher && activeTab === 'schedule' && 'Расписание занятий'}
              {activeTab === 'manage-schedule' && 'Управление расписанием'}
              {activeTab === 'directories' && 'Справочники'}
              {activeTab === 'users' && 'Управление пользователями'}
            </h1>
          </div>
          <div className="header-actions-right">
            <button className="theme-toggle-header" onClick={toggleTheme}>
              <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>
            <div className="role-badge">{ROLES[user.role]}</div>
          </div>
        </header>
        
        <div className="app-content">{renderContent()}</div>
      </main>

      <LessonModal
        isOpen={showLessonModal}
        lesson={editingLesson}
        groups={groups}
        teachers={teachers}
        subjects={subjects}
        classrooms={classrooms}
        onSave={handleSaveLesson}
        onClose={() => {
          setShowLessonModal(false);
          setEditingLesson(null);
        }}
        isEditing={!!editingLesson?.id}
      />

      {showTeacherReportModal && createPortal(
        <TeacherReportModal
          teachers={teachers}
          schedule={scheduleHook.allSchedule}
          onClose={() => setShowTeacherReportModal(false)}
        />,
        document.body
      )}
    </div>
  );
}

// Экспорт главного компонента
export default function Home() {
  return (
    <ThemeProvider>
      <HomeContent />
    </ThemeProvider>
  );
}