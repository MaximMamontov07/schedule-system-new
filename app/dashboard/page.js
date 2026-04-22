'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const PAIRS = [
  { number: 1, time: '8:30-10:00', name: '1 пара' },
  { number: 2, time: '10:10-11:40', name: '2 пара' },
  { number: 3, time: '12:10-13:40', name: '3 пара' },
  { number: 4, time: '13:50-15:20', name: '4 пара' },
  { number: 5, time: '15:30-17:00', name: '5 пара' },
  { number: 6, time: '17:10-18:40', name: '6 пара' }
];

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  
  // Данные для отчета по часам
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/');
      return;
    }
    
    setUser(JSON.parse(userData));
    loadTeachers();
    setLoading(false);
  }, [router]);

  const loadTeachers = async () => {
    try {
      const res = await fetch('/api/teachers');
      const data = await res.json();
      setTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Ошибка загрузки преподавателей:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedTeacher) {
      alert('Выберите преподавателя');
      return;
    }

    setReportLoading(true);
    try {
      let url = `/api/report/hours?teacherId=${selectedTeacher}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        setReportData(data);
      } else {
        alert(data.error || 'Ошибка загрузки отчета');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка загрузки отчета');
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
      'Пара': `${lesson.pair_number} (${PAIRS[lesson.pair_number - 1].time})`,
      'Дата': lesson.date ? new Date(lesson.date).toLocaleDateString() : '—'
    }));

    // Добавляем строку с итогами
    exportData.push({});
    exportData.push({
      'Группа': 'ИТОГО:',
      'Предмет': '',
      'День недели': '',
      'Пара': '',
      'Дата': ''
    });
    exportData.push({
      'Группа': `Всего занятий: ${reportData.summary.totalLessons}`,
      'Предмет': `Всего часов: ${reportData.summary.totalHours}`,
      'День недели': `Будние дни: ${reportData.summary.weekdayHours}`,
      'Пара': `Субботы: ${reportData.summary.saturdayHours}`,
      'Дата': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Отчет_${reportData.teacher.name}`);
    XLSX.writeFile(wb, `Отчет_${reportData.teacher.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner-large"></div><p>Загрузка...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Панель управления</h1>
        <div className="user-info">
          <span>{user?.fullName} (Администратор)</span>
          <button onClick={handleLogout} className="logout-btn">Выйти</button>
        </div>
      </header>

      <div className="dashboard-tabs">
        <button className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
          <i className="fas fa-calendar-alt"></i> Управление расписанием
        </button>
        <button className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>
          <i className="fas fa-chart-line"></i> Отчет по часам
        </button>
        <button className={`tab-btn ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => setActiveTab('directories')}>
          <i className="fas fa-database"></i> Справочники
        </button>
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <i className="fas fa-users"></i> Пользователи
        </button>
      </div>

      <div className="dashboard-content">
        {/* Управление расписанием */}
        {activeTab === 'schedule' && (
          <div className="content-card">
            <h2><i className="fas fa-plus-circle"></i> Управление расписанием</h2>
            <p>Здесь будет ваш существующий код управления расписанием</p>
          </div>
        )}

        {/* Отчет по часам */}
        {activeTab === 'report' && (
          <div className="content-card">
            <h2><i className="fas fa-chart-line"></i> Отчет по часам преподавателя</h2>
            
            <div className="report-filters">
              <div className="filter-group">
                <label><i className="fas fa-chalkboard-teacher"></i> Преподаватель</label>
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                  <option value="">Выберите преподавателя</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label><i className="fas fa-calendar-alt"></i> Период (необязательно)</label>
                <div className="date-range">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="С даты" />
                  <span>—</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="По дату" />
                </div>
              </div>

              <button className="generate-btn" onClick={generateReport} disabled={reportLoading}>
                {reportLoading ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-chart-line"></i>}
                Сформировать отчет
              </button>
            </div>

            {reportData && (
              <div className="report-result">
                <div className="report-header">
                  <h3>Отчет по преподавателю: {reportData.teacher.name}</h3>
                  <button className="export-btn" onClick={exportReportToExcel}>
                    <i className="fas fa-file-excel"></i> Экспорт в Excel
                  </button>
                </div>

                <div className="report-summary">
                  <div className="summary-card">
                    <i className="fas fa-clock"></i>
                    <div className="summary-value">{reportData.summary.totalHours}</div>
                    <div className="summary-label">Всего часов</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-calendar-week"></i>
                    <div className="summary-value">{reportData.summary.weekdayHours}</div>
                    <div className="summary-label">Будние дни</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-calendar-weekend"></i>
                    <div className="summary-value">{reportData.summary.saturdayHours}</div>
                    <div className="summary-label">Субботы</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-book"></i>
                    <div className="summary-value">{reportData.summary.totalLessons}</div>
                    <div className="summary-label">Всего занятий</div>
                  </div>
                </div>

                <div className="report-table-wrapper">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Группа</th>
                        <th>Предмет</th>
                        <th>День недели</th>
                        <th>Пара</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.lessons.map(lesson => (
                        <tr key={lesson.id}>
                          <td>{lesson.group_name}</td>
                          <td>{lesson.subject_name}</td>
                          <td>{DAYS[lesson.day_of_week - 1]}</td>
                          <td>{lesson.pair_number} ({PAIRS[lesson.pair_number - 1].time})</td>
                          <td>{lesson.date ? new Date(lesson.date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Справочники */}
        {activeTab === 'directories' && (
          <div className="content-card">
            <h2><i className="fas fa-database"></i> Справочники</h2>
            <p>Здесь будет ваш существующий код управления справочниками</p>
          </div>
        )}

        {/* Пользователи */}
        {activeTab === 'users' && (
          <div className="content-card">
            <h2><i className="fas fa-users"></i> Управление пользователями</h2>
            <p>Здесь будет ваш существующий код управления пользователями</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .dashboard-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 1rem 2rem;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .tab-btn {
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          color: var(--text-secondary);
          transition: var(--transition);
        }
        .tab-btn i {
          margin-right: 0.5rem;
        }
        .tab-btn:hover {
          background: var(--surface-muted);
          color: var(--primary);
        }
        .tab-btn.active {
          background: var(--primary);
          color: white;
        }
        .content-card {
          background: var(--surface);
          border-radius: 1rem;
          padding: 1.5rem;
          border: 1px solid var(--border);
        }
        .content-card h2 {
          font-size: 1.25rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }
        .content-card h2 i {
          margin-right: 0.5rem;
          color: var(--primary);
        }
        .report-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .filter-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .filter-group select,
        .filter-group input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          background: var(--surface);
          color: var(--text-primary);
        }
        .date-range {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .date-range input {
          flex: 1;
        }
        .generate-btn {
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          align-self: flex-end;
        }
        .report-result {
          margin-top: 2rem;
          border-top: 1px solid var(--border);
          padding-top: 2rem;
        }
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .report-header h3 {
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .export-btn {
          padding: 0.5rem 1rem;
          background: var(--success);
          color: white;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
        }
        .report-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .summary-card {
          background: var(--surface-muted);
          padding: 1rem;
          border-radius: 0.75rem;
          text-align: center;
        }
        .summary-card i {
          font-size: 1.5rem;
          color: var(--primary);
          margin-bottom: 0.5rem;
          display: block;
        }
        .summary-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        .summary-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .report-table-wrapper {
          overflow-x: auto;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
        }
        .report-table th,
        .report-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .report-table th {
          background: var(--surface-muted);
          font-weight: 600;
          font-size: 0.8rem;
        }
        @media (max-width: 768px) {
          .dashboard-tabs {
            padding: 0.75rem 1rem;
          }
          .tab-btn {
            padding: 0.5rem 1rem;
            font-size: 0.8rem;
          }
          .content-card {
            padding: 1rem;
          }
          .report-summary {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}