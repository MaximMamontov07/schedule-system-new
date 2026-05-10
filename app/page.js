'use client';

import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
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

// ============ ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ ============

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  try {
    if (dateString instanceof Date) {
      return new Date(dateString.getFullYear(), dateString.getMonth(), dateString.getDate());
    }
    let str = String(dateString);
    if (str.includes('T')) str = str.split('T')[0];
    if (str.includes('.')) str = str.split('.')[0];
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

// ============ SearchableSelect Component ============
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
        } else if (!isOpen) setIsOpen(true);
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
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          value={isOpen ? searchTerm : (selectedOption?.label || '')}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
        />
        <div className="searchable-select-icons">
          {value && (
            <button className="searchable-select-clear-btn" onClick={() => onChange('')}>
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
              <div className="searchable-select-empty">Ничего не найдено</div>
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
                    {value === option.value && <i className="fas fa-check"></i>}
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

// ============ ScheduleGrid Component ============
const ScheduleGrid = ({ data, canEdit = false, onEditClick, onDeleteClick, onAddClick, weekDates, selectedDate }) => {
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
            <th className="time-header">Время</th>
            {DAYS.map((day, idx) => {
              const date = weekDates?.[idx];
              const isToday = date && date.toDateString() === new Date().toDateString();
              const isWeekend = idx === 5 || idx === 6;
              return (
                <th key={day} className={`day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
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
                const dateStr = date ? formatForInput(date) : '';
                
                return (
                  <td key={`${dayIndex}-${pair.number}`} className={`lesson-cell ${hasLessons ? 'has-lessons' : 'empty'}`}>
                    {hasLessons ? (
                      <div className="lessons-container">
                        {lessons.map((lesson, idx) => (
                          <div key={lesson.id || idx} className="lesson-card-modern">
                            <div className="lesson-header">
                              <h4 className="lesson-title">{lesson.subject_name}</h4>
                              <span className="lesson-group-tag">{lesson.group_name}</span>
                              {lesson.is_exception && <span className="exception-badge"><i className="fas fa-edit"></i> изменено</span>}
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
                              {lesson.notes && <div className="lesson-notes-badge">{lesson.notes}</div>}
                            </div>
                            {canEdit && (
                              <div className="lesson-actions-modern">
                                <button className="lesson-action-btn edit" onClick={() => onEditClick(lesson)}><i className="fas fa-edit"></i></button>
                                <button className="lesson-action-btn delete" onClick={() => onDeleteClick(lesson.id)}><i className="fas fa-trash-alt"></i></button>
                              </div>
                            )}
                          </div>
                        ))}
                        {canEdit && onAddClick && (
                          <button className="add-lesson-btn-mini" onClick={() => onAddClick({ day_of_week: dayIndex + 1, pair_number: pair.number, date: dateStr })}>
                            <i className="fas fa-plus"></i> Добавить
                          </button>
                        )}
                      </div>
                    ) : (
                      canEdit && onAddClick && (
                        <button className="add-lesson-btn" onClick={() => onAddClick({ day_of_week: dayIndex + 1, pair_number: pair.number, date: dateStr })}>
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
};

// ============ TemplateManager Component ============
const TemplateManager = ({ groups, teachers, subjects, classrooms, token, showNotification, onTemplateChange }) => {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [templates, setTemplates] = useState([]);
  const [weekStartDate, setWeekStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  
  const weekDates = getWeekDates(weekStartDate);
  
  useEffect(() => {
    if (selectedGroup) {
      fetch(`/api/schedule-templates?groupId=${selectedGroup}`)
        .then(res => res.json())
        .then(setTemplates)
        .catch(console.error);
    }
  }, [selectedGroup]);
  
  const updateTemplate = async (dayOfWeek, pairNumber, data) => {
    try {
      const res = await fetch('/api/schedule-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          group_id: selectedGroup,
          day_of_week: dayOfWeek,
          pair_number: pairNumber,
          ...data
        })
      });
      
      if (res.ok) {
        showNotification('Шаблон сохранён', 'success');
        const updated = await fetch(`/api/schedule-templates?groupId=${selectedGroup}`).then(r => r.json());
        setTemplates(updated);
        if (onTemplateChange) onTemplateChange();
      } else {
        const error = await res.json();
        showNotification(error.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка сохранения', 'error');
    }
  };
  
  const deleteTemplate = async (dayOfWeek, pairNumber) => {
    try {
      const res = await fetch(`/api/schedule-templates?groupId=${selectedGroup}&dayOfWeek=${dayOfWeek}&pairNumber=${pairNumber}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        showNotification('Шаблон удалён', 'success');
        const updated = await fetch(`/api/schedule-templates?groupId=${selectedGroup}`).then(r => r.json());
        setTemplates(updated);
        if (onTemplateChange) onTemplateChange();
      }
    } catch (e) {
      showNotification('Ошибка удаления', 'error');
    }
  };
  
  const generateWeek = async () => {
    if (!selectedGroup) {
      showNotification('Выберите группу', 'error');
      return;
    }
    
    setGenerating(true);
    try {
      const res = await fetch('/api/schedule/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          groupId: selectedGroup,
          weekStartDate: weekStartDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message, 'success');
        if (onTemplateChange) onTemplateChange();
      } else {
        showNotification(data.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка генерации', 'error');
    } finally {
      setGenerating(false);
    }
  };
  
  const copyFromPreviousWeek = async () => {
    if (!selectedGroup) {
      showNotification('Выберите группу', 'error');
      return;
    }
    
    const prevWeekDate = new Date(weekStartDate);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeekStr = prevWeekDate.toISOString().split('T')[0];
    
    setCopying(true);
    try {
      const res = await fetch('/api/schedule/generate-week', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          groupId: selectedGroup,
          sourceDate: prevWeekStr,
          targetDate: weekStartDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message, 'success');
        if (onTemplateChange) onTemplateChange();
      } else {
        showNotification(data.error, 'error');
      }
    } catch (e) {
      showNotification('Ошибка копирования', 'error');
    } finally {
      setCopying(false);
    }
  };
  
  const openTemplateEditor = (dayOfWeek, pairNumber, existingTemplate) => {
    setEditingSlot({
      dayOfWeek,
      pairNumber,
      dayName: DAYS[dayOfWeek - 1],
      pairName: PAIRS[pairNumber - 1].name,
      pairTime: PAIRS[pairNumber - 1].time,
      template: existingTemplate || { teacher_id: '', subject_id: '', classroom_id: '' }
    });
    setShowTemplateEditor(true);
  };
  
  const renderTemplateGrid = () => {
    const matrix = Array(7).fill().map(() => Array(6).fill().map(() => null));
    templates.forEach(tpl => {
      const dayIdx = tpl.day_of_week - 1;
      const pairIdx = tpl.pair_number - 1;
      if (dayIdx >= 0 && dayIdx < 7 && pairIdx >= 0 && pairIdx < 6) {
        matrix[dayIdx][pairIdx] = tpl;
      }
    });
    
    return (
      <div className="schedule-grid-wrapper">
        <table className="schedule-grid">
          <thead>
            <tr>
              <th className="time-header">Время</th>
              {DAYS.map(day => <th key={day} className="day-header">{day}</th>)}
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
                {DAYS.map((_, dayIdx) => {
                  const tpl = matrix[dayIdx][pair.number - 1];
                  return (
                    <td key={`${dayIdx}-${pair.number}`} className="lesson-cell">
                      {tpl ? (
                        <div className="template-lesson-card">
                          <div className="template-lesson-subject">{tpl.subject_name || '—'}</div>
                          <div className="template-lesson-teacher">{tpl.teacher_name || '—'}</div>
                          <div className="template-lesson-classroom">{tpl.classroom_name || '—'}</div>
                          <div className="template-lesson-actions">
                            <button className="edit-template-btn" onClick={() => openTemplateEditor(dayIdx + 1, pair.number, tpl)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="delete-template-btn" onClick={() => deleteTemplate(dayIdx + 1, pair.number)}>
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="add-template-btn" onClick={() => openTemplateEditor(dayIdx + 1, pair.number, null)}>
                          <i className="fas fa-plus"></i> Добавить
                        </button>
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
  
  return (
    <div className="content-card">
      <div className="content-header">
        <div className="header-left">
          <h2><i className="fas fa-layer-group"></i> Шаблоны расписания</h2>
        </div>
        <div className="header-actions">
          <select className="group-filter" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            <option value="">Выберите группу</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>
      
      {selectedGroup && (
        <>
          <div className="template-info">
            <div className="info-banner">
              <i className="fas fa-info-circle"></i>
              <div>
                <strong>Как работает система шаблонов:</strong>
                <ul>
                  <li>Заполните шаблон для выбранной группы (какая пара в какой день)</li>
                  <li>Нажмите "Сгенерировать на неделю" — занятия создадутся на все дни выбранной недели</li>
                  <li>Любые изменения в расписании на конкретной неделе будут сохранены и не затронут другие недели</li>
                  <li>При повторной генерации обновятся только те занятия, которые не были изменены вручную</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="filter-section" style={{ margin: '1rem', padding: '1rem' }}>
            <div className="filter-section-header">
              <div className="week-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input 
                  type="date" 
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  className="group-filter"
                  style={{ width: 'auto' }}
                />
                <div className="week-display">
                  <i className="fas fa-calendar-week"></i>
                  <span>{formatDate(weekDates[0])} - {formatDate(weekDates[6])}</span>
                </div>
                <button className="action-button primary" onClick={generateWeek} disabled={generating}>
                  <i className={`fas ${generating ? 'fa-spinner fa-pulse' : 'fa-magic'}`}></i>
                  {generating ? ' Генерация...' : ' Сгенерировать на неделю'}
                </button>
                <button className="action-button" onClick={copyFromPreviousWeek} disabled={copying}>
                  <i className={`fas ${copying ? 'fa-spinner fa-pulse' : 'fa-copy'}`}></i>
                  {copying ? ' Копирование...' : ' Копировать с прошлой недели'}
                </button>
              </div>
            </div>
          </div>
          
          {renderTemplateGrid()}
        </>
      )}
      
      {!selectedGroup && (
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <p>Выберите группу для настройки шаблона расписания</p>
        </div>
      )}
      
      {/* Modal для редактирования шаблона */}
      {showTemplateEditor && editingSlot && createPortal(
        <div className="modal" onClick={() => setShowTemplateEditor(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-layer-group"></i> Настройка шаблона</h2>
              <button className="modal-close" onClick={() => setShowTemplateEditor(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-form">
              <div className="info-row" style={{ marginBottom: '1rem', padding: '0.5rem', background: 'var(--surface-muted)', borderRadius: '0.75rem' }}>
                <span><strong>День:</strong> {editingSlot.dayName}</span>
                <span style={{ marginLeft: '1rem' }}><strong>Пара:</strong> {editingSlot.pairName} ({editingSlot.pairTime})</span>
              </div>
              
              <div className="form-group">
                <label>Предмет</label>
                <select 
                  value={editingSlot.template.subject_id || ''}
                  onChange={(e) => setEditingSlot({
                    ...editingSlot,
                    template: { ...editingSlot.template, subject_id: e.target.value }
                  })}
                >
                  <option value="">Выберите предмет</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label>Преподаватель</label>
                <select 
                  value={editingSlot.template.teacher_id || ''}
                  onChange={(e) => setEditingSlot({
                    ...editingSlot,
                    template: { ...editingSlot.template, teacher_id: e.target.value }
                  })}
                >
                  <option value="">Выберите преподавателя</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label>Аудитория (опционально)</label>
                <select 
                  value={editingSlot.template.classroom_id || ''}
                  onChange={(e) => setEditingSlot({
                    ...editingSlot,
                    template: { ...editingSlot.template, classroom_id: e.target.value }
                  })}
                >
                  <option value="">Не выбрана</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="submit-btn" onClick={() => {
                  updateTemplate(editingSlot.dayOfWeek, editingSlot.pairNumber, {
                    teacher_id: editingSlot.template.teacher_id,
                    subject_id: editingSlot.template.subject_id,
                    classroom_id: editingSlot.template.classroom_id
                  });
                  setShowTemplateEditor(false);
                }}>
                  <i className="fas fa-save"></i> Сохранить
                </button>
                <button className="cancel-btn" onClick={() => setShowTemplateEditor(false)} style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-muted)', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
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
  
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', password: '', fullName: '', role: 'student', groupId: '' });
  const [newLesson, setNewLesson] = useState({ group_id: '', teacher_id: '', subject_id: '', classroom_id: '', pair_number: '1', day_of_week: '1', date: '' });
  const [editingLesson, setEditingLesson] = useState(null);
  const [newGroup, setNewGroup] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newClassroom, setNewClassroom] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [manageCurrentDate, setManageCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  
  const canEditSchedule = user && (user.role === 'admin' || user.role === 'methodist');
  const canManageUsers = user && user.role === 'admin';
  const isTeacher = user && user.role === 'teacher';
  
  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };
  
  const loadData = async () => {
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
      await loadSchedule();
    } catch (e) {
      console.error(e);
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const loadSchedule = async () => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
      let url = '/api/schedule';
      if (selectedGroupFilter) {
        url += `?groupId=${selectedGroupFilter}`;
      }
      const res = await fetch(url, { headers });
      const data = await res.json();
      setSchedule(data);
    } catch (e) {
      console.error(e);
    }
  };
  
  const loadScheduleForWeek = async (startDate, endDate, groupId = null) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    let url = `/api/schedule?weekStart=${startDate}&weekEnd=${endDate}`;
    if (groupId) url += `&groupId=${groupId}`;
    else if (selectedGroupFilter) url += `&groupId=${selectedGroupFilter}`;
    
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      setSchedule(data);
      return data;
    } catch (e) {
      console.error(e);
      return [];
    }
  };
  
  const loadUsers = async () => {
    if (!token || !canManageUsers) return;
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  };
  
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
  
  const handleAddScheduleClick = (slotData) => {
    setEditingLesson({
      id: null,
      group_id: selectedGroupFilter || '',
      teacher_id: '',
      subject_id: '',
      classroom_id: '',
      pair_number: String(slotData.pair_number),
      day_of_week: String(slotData.day_of_week),
      date: slotData.date || ''
    });
    setShowEditModal(true);
  };
  
  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!canEditSchedule) return showNotification('Нет прав', 'error');
    
    const dataToSend = {
      group_id: parseInt(editingLesson.group_id),
      teacher_id: parseInt(editingLesson.teacher_id),
      subject_id: parseInt(editingLesson.subject_id),
      classroom_id: editingLesson.classroom_id ? parseInt(editingLesson.classroom_id) : null,
      pair_number: parseInt(editingLesson.pair_number),
      day_of_week: parseInt(editingLesson.day_of_week),
      date: editingLesson.date
    };
    
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dataToSend)
      });
      const result = await res.json();
      if (res.ok) {
        showNotification('Занятие добавлено', 'success');
        setShowEditModal(false);
        setEditingLesson(null);
        loadSchedule();
        setRefreshKey(prev => prev + 1);
      } else if (res.status === 409) {
        showNotification(result.error, 'error');
      } else {
        showNotification(result.error || 'Ошибка сервера', 'error');
      }
    } catch (error) {
      showNotification('Ошибка соединения', 'error');
    }
  };
  
  const handleUpdateLesson = async (e) => {
    e.preventDefault();
    if (!editingLesson) return;
    
    const dataToSend = {
      group_id: parseInt(editingLesson.group_id),
      teacher_id: parseInt(editingLesson.teacher_id),
      subject_id: parseInt(editingLesson.subject_id),
      classroom_id: editingLesson.classroom_id ? parseInt(editingLesson.classroom_id) : null,
      pair_number: parseInt(editingLesson.pair_number),
      day_of_week: parseInt(editingLesson.day_of_week),
      date: editingLesson.date
    };
    
    try {
      const res = await fetch(`/api/schedule/${editingLesson.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dataToSend)
      });
      const result = await res.json();
      if (res.ok) {
        showNotification('Занятие обновлено', 'success');
        setShowEditModal(false);
        setEditingLesson(null);
        loadSchedule();
        setRefreshKey(prev => prev + 1);
      } else if (res.status === 409) {
        showNotification(result.error, 'error');
      } else {
        showNotification(result.error || 'Ошибка сервера', 'error');
      }
    } catch (error) {
      showNotification('Ошибка соединения', 'error');
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
      loadSchedule();
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };
  
  const handleEditClick = (lesson) => {
    setEditingLesson({ ...lesson, date: lesson.date || '' });
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
  
  useEffect(() => {
    const init = async () => {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('user');
      if (t && u) {
        setToken(t);
        const userData = JSON.parse(u);
        setUser(userData);
      }
      setAuthChecking(false);
    };
    init();
  }, []);
  
  useEffect(() => {
    if (!authChecking) loadData();
  }, [authChecking, token, selectedGroupFilter]);
  
  useEffect(() => {
    if (token && canManageUsers) loadUsers();
  }, [token, canManageUsers]);
  
  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="spinner-large"></div>
        <p>Загрузка системы...</p>
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
              <div className="hero-badge"><span>Расписание колледжа</span></div>
              <h1 className="hero-title">Система управления<br/><span className="gradient-highlight">расписанием</span></h1>
              <div className="hero-buttons">
                <button className="btn-primary" onClick={() => setShowLogin(true)}><i className="fas fa-sign-in-alt"></i> Войти</button>
                <button className="btn-secondary" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i> {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</button>
              </div>
            </div>
          </div>
        </div>
        
        {showLogin && createPortal(
          <div className="modal" onClick={() => setShowLogin(false)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h2>Вход в систему</h2><button className="modal-close" onClick={() => setShowLogin(false)}><i className="fas fa-times"></i></button></div>
              <form onSubmit={handleLogin} className="modal-form">
                <div className="form-group"><label>Логин</label><input type="text" placeholder="Логин" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required /></div>
                <div className="form-group"><label>Пароль</label><input type="password" placeholder="Пароль" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required /></div>
                <button type="submit" className="submit-btn">Войти</button>
              </form>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
  
  const weekDates = getWeekDates(manageCurrentDate);
  
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
          <button className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); }}>
            <i className="fas fa-calendar-week"></i><span>Расписание</span>
          </button>
          {(user.role === 'admin' || user.role === 'methodist') && (
            <>
              <button className={`nav-item ${activeTab === 'manage-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('manage-schedule'); setSidebarOpen(false); }}>
                <i className="fas fa-edit"></i><span>Управление</span>
              </button>
              <button className={`nav-item ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => { setActiveTab('templates'); setSidebarOpen(false); }}>
                <i className="fas fa-layer-group"></i><span>Шаблоны</span>
              </button>
              <button className={`nav-item ${activeTab === 'directories' ? 'active' : ''}`} onClick={() => { setActiveTab('directories'); setSidebarOpen(false); }}>
                <i className="fas fa-database"></i><span>Справочники</span>
              </button>
            </>
          )}
          {user.role === 'admin' && (
            <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}>
              <i className="fas fa-users-cog"></i><span>Пользователи</span>
            </button>
          )}
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
          <div className="header-title"><h1>{activeTab === 'schedule' ? 'Расписание занятий' : activeTab === 'manage-schedule' ? 'Управление расписанием' : activeTab === 'templates' ? 'Шаблоны расписания' : activeTab === 'directories' ? 'Справочники' : 'Пользователи'}</h1></div>
          <div className="header-actions-right">
            <button className="theme-toggle-header" onClick={toggleTheme}><i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button>
            <div className="role-badge">{ROLES[user.role]}</div>
          </div>
        </header>
        
        <div className="app-content">
          {activeTab === 'schedule' && (
            <div className="content-card">
              <div className="content-header">
                <div className="header-left"><h2><i className="fas fa-calendar-alt"></i> Расписание</h2></div>
                <div className="header-actions">
                  <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} className="group-filter">
                    <option value="">Все группы</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              {loading ? <div className="loading-state"><div className="spinner"></div></div> : (
                <ScheduleGrid data={schedule} canEdit={false} weekDates={weekDates} />
              )}
            </div>
          )}
          
          {activeTab === 'manage-schedule' && (user.role === 'admin' || user.role === 'methodist') && (
            <div className="content-card">
              <div className="content-header">
                <div className="header-left"><h2><i className="fas fa-edit"></i> Управление расписанием</h2></div>
                <div className="header-actions">
                  <div className="week-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => { const newDate = new Date(manageCurrentDate); newDate.setDate(manageCurrentDate.getDate() - 7); setManageCurrentDate(newDate); }} className="week-nav-btn"><i className="fas fa-chevron-left"></i></button>
                    <div className="week-display">{formatDate(weekDates[0])} - {formatDate(weekDates[6])}</div>
                    <button onClick={() => { const newDate = new Date(manageCurrentDate); newDate.setDate(manageCurrentDate.getDate() + 7); setManageCurrentDate(newDate); }} className="week-nav-btn"><i className="fas fa-chevron-right"></i></button>
                    <button onClick={() => setManageCurrentDate(new Date())} className="week-today-btn">Сегодня</button>
                  </div>
                  <select value={selectedGroupFilter} onChange={(e) => setSelectedGroupFilter(e.target.value)} className="group-filter">
                    <option value="">Все группы</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <ScheduleGrid data={schedule} canEdit={true} onEditClick={handleEditClick} onDeleteClick={handleDeleteLesson} onAddClick={handleAddScheduleClick} weekDates={weekDates} />
            </div>
          )}
          
          {activeTab === 'templates' && (user.role === 'admin' || user.role === 'methodist') && (
            <TemplateManager 
              groups={groups}
              teachers={teachers}
              subjects={subjects}
              classrooms={classrooms}
              token={token}
              showNotification={showNotification}
              onTemplateChange={() => { loadSchedule(); setRefreshKey(prev => prev + 1); }}
            />
          )}
          
          {activeTab === 'directories' && (user.role === 'admin' || user.role === 'methodist') && (
            <div className="content-card">
              <div className="content-header"><h2><i className="fas fa-database"></i> Справочники</h2></div>
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
                  <div className="directory-list">{classrooms.map(c => <div key={c.id} className="directory-item"><span>{c.name}</span><button onClick={() => deleteDirectory('classrooms', c.id)} className="delete-item-btn"><i className="fas fa-trash-alt"></i></button></div>)}</div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'users' && user.role === 'admin' && (
            <div className="content-card">
              <div className="content-header"><h2><i className="fas fa-users-cog"></i> Пользователи</h2><button className="action-button primary" onClick={() => setShowRegister(true)}>Создать</button></div>
              <div className="users-section">
                <div className="users-list">{users.map(u => <div key={u.id} className="user-card"><div className="user-avatar"><i className={`fas ${u.role === 'admin' ? 'fa-crown' : u.role === 'teacher' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i></div><div className="user-details"><div className="user-name">{u.full_name}</div><div className="user-meta">@{u.username} • {ROLES[u.role]}</div></div>{u.id !== user?.id && <button onClick={() => handleDeleteUser(u.id)} className="delete-user-btn"><i className="fas fa-trash-alt"></i></button>}</div>)}</div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Modals */}
      {showEditModal && editingLesson && createPortal(
        <div className="modal" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingLesson.id ? 'Редактировать' : 'Добавить'} занятие</h2><button className="modal-close" onClick={() => setShowEditModal(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={editingLesson.id ? handleUpdateLesson : handleAddLesson} className="modal-form">
              <div className="form-group"><label>Группа</label><select value={editingLesson.group_id || ''} onChange={e => setEditingLesson({...editingLesson, group_id: e.target.value})} required><option value="">Выберите группу</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
              <div className="form-group"><label>Предмет</label><select value={editingLesson.subject_id || ''} onChange={e => setEditingLesson({...editingLesson, subject_id: e.target.value})} required><option value="">Выберите предмет</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="form-group"><label>Преподаватель</label><select value={editingLesson.teacher_id || ''} onChange={e => setEditingLesson({...editingLesson, teacher_id: e.target.value})} required><option value="">Выберите преподавателя</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="form-group"><label>Аудитория</label><select value={editingLesson.classroom_id || ''} onChange={e => setEditingLesson({...editingLesson, classroom_id: e.target.value})}><option value="">Не выбрана</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="form-row"><div className="form-group half"><label>День</label><select value={editingLesson.day_of_week || '1'} onChange={e => setEditingLesson({...editingLesson, day_of_week: e.target.value})}>{DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}</select></div><div className="form-group half"><label>Пара</label><select value={editingLesson.pair_number || '1'} onChange={e => setEditingLesson({...editingLesson, pair_number: e.target.value})}>{PAIRS.map(p => <option key={p.number} value={p.number}>{p.name}</option>)}</select></div></div>
              <div className="form-group"><label>Дата</label><input type="date" value={editingLesson.date || ''} onChange={e => setEditingLesson({...editingLesson, date: e.target.value})} required /></div>
              <button type="submit" className="submit-btn">Сохранить</button>
            </form>
          </div>
        </div>,
        document.body
      )}
      
      {showRegister && createPortal(
        <div className="modal" onClick={() => setShowRegister(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Создать пользователя</h2><button className="modal-close" onClick={() => setShowRegister(false)}><i className="fas fa-times"></i></button></div>
            <form onSubmit={handleRegister} className="modal-form">
              <div className="form-group"><input placeholder="Логин" value={registerData.username} onChange={e => setRegisterData({...registerData, username: e.target.value})} required /></div>
              <div className="form-group"><input type="password" placeholder="Пароль" value={registerData.password} onChange={e => setRegisterData({...registerData, password: e.target.value})} required /></div>
              <div className="form-group"><input placeholder="ФИО" value={registerData.fullName} onChange={e => setRegisterData({...registerData, fullName: e.target.value})} required /></div>
              <div className="form-group"><select value={registerData.role} onChange={e => setRegisterData({...registerData, role: e.target.value})}><option value="student">Студент</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select></div>
              {registerData.role === 'student' && (<div className="form-group"><select value={registerData.groupId} onChange={e => setRegisterData({...registerData, groupId: e.target.value})}><option value="">Группа</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>)}
              <button type="submit" className="submit-btn">Создать</button>
            </form>
          </div>
        </div>,
        document.body
      )}
      
      {showGroupModal && createPortal(<div className="modal" onClick={() => setShowGroupModal(false)}><div className="modal-container"><div className="modal-header"><h2>Добавить группу</h2><button className="modal-close" onClick={() => setShowGroupModal(false)}><i className="fas fa-times"></i></button></div><form onSubmit={(e) => { e.preventDefault(); addDirectory('groups', newGroup, setShowGroupModal, setNewGroup); }}><input placeholder="Название" value={newGroup} onChange={e => setNewGroup(e.target.value)} required /><button type="submit">Добавить</button></form></div></div>, document.body)}
      {showTeacherModal && createPortal(<div className="modal" onClick={() => setShowTeacherModal(false)}><div className="modal-container"><div className="modal-header"><h2>Добавить преподавателя</h2><button className="modal-close" onClick={() => setShowTeacherModal(false)}><i className="fas fa-times"></i></button></div><form onSubmit={(e) => { e.preventDefault(); addDirectory('teachers', newTeacher, setShowTeacherModal, setNewTeacher); }}><input placeholder="ФИО" value={newTeacher} onChange={e => setNewTeacher(e.target.value)} required /><button type="submit">Добавить</button></form></div></div>, document.body)}
      {showSubjectModal && createPortal(<div className="modal" onClick={() => setShowSubjectModal(false)}><div className="modal-container"><div className="modal-header"><h2>Добавить предмет</h2><button className="modal-close" onClick={() => setShowSubjectModal(false)}><i className="fas fa-times"></i></button></div><form onSubmit={(e) => { e.preventDefault(); addDirectory('subjects', newSubject, setShowSubjectModal, setNewSubject); }}><input placeholder="Название" value={newSubject} onChange={e => setNewSubject(e.target.value)} required /><button type="submit">Добавить</button></form></div></div>, document.body)}
      {showClassroomModal && createPortal(<div className="modal" onClick={() => setShowClassroomModal(false)}><div className="modal-container"><div className="modal-header"><h2>Добавить аудиторию</h2><button className="modal-close" onClick={() => setShowClassroomModal(false)}><i className="fas fa-times"></i></button></div><form onSubmit={(e) => { e.preventDefault(); addDirectory('classrooms', newClassroom, setShowClassroomModal, setNewClassroom); }}><input placeholder="Номер" value={newClassroom} onChange={e => setNewClassroom(e.target.value)} required /><button type="submit">Добавить</button></form></div></div>, document.body)}
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