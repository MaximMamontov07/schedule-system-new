'use client';

import { memo, useState } from 'react';

export const DatePicker = memo(({ onDateSelect, onClose, selectedDate }) => {
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
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        isCurrentMonth: false,
        day: prevMonthLastDay - i
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        day: i
      });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        day: i
      });
    }
    
    return days;
  };
  
  const changeMonth = (delta) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };
  
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  const isSelected = (date) => {
    return selectedDate && 
           date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };
  
  const handleDateClick = (date) => {
    onDateSelect(date);
    onClose();
  };
  
  const years = [];
  const currentYear = currentMonth.getFullYear();
  for (let i = currentYear - 5; i <= currentYear + 5; i++) {
    years.push(i);
  }
  
  return (
    <div className="datepicker-modal" onClick={(e) => e.stopPropagation()}>
      <div className="datepicker-header">
        <div className="datepicker-nav">
          <button onClick={() => changeMonth(-1)} className="datepicker-nav-btn">
            <i className="fas fa-chevron-left"></i>
          </button>
          <button 
            className="datepicker-month-year"
            onClick={() => setViewMode(viewMode === 'month' ? 'year' : 'month')}
          >
            {viewMode === 'month' ? (
              <span>{months[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            ) : (
              <span>{currentMonth.getFullYear()}</span>
            )}
            <i className="fas fa-chevron-down"></i>
          </button>
          <button onClick={() => changeMonth(1)} className="datepicker-nav-btn">
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        <button className="datepicker-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      {viewMode === 'month' ? (
        <>
          <div className="datepicker-weekdays">
            {weekdays.map(day => (
              <div key={day} className="datepicker-weekday">{day}</div>
            ))}
          </div>
          <div className="datepicker-days">
            {getDaysInMonth(currentMonth).map((day, idx) => (
              <button
                key={idx}
                className={`datepicker-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday(day.date) ? 'today' : ''} ${isSelected(day.date) ? 'selected' : ''}`}
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
            <button
              key={year}
              className={`datepicker-year ${year === currentMonth.getFullYear() ? 'active' : ''}`}
              onClick={() => {
                setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
                setViewMode('month');
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}
      
      <div className="datepicker-footer">
        <button className="datepicker-today-btn" onClick={() => {
          const today = new Date();
          handleDateClick(today);
        }}>
          <i className="fas fa-calendar-day"></i> Сегодня
        </button>
      </div>
    </div>
  );
});

DatePicker.displayName = 'DatePicker';