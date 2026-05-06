// Константы
export const DAYS = [
  { value: 1, name: 'Понедельник', short: 'Пн', isWeekend: false },
  { value: 2, name: 'Вторник', short: 'Вт', isWeekend: false },
  { value: 3, name: 'Среда', short: 'Ср', isWeekend: false },
  { value: 4, name: 'Четверг', short: 'Чт', isWeekend: false },
  { value: 5, name: 'Пятница', short: 'Пт', isWeekend: false },
  { value: 6, name: 'Суббота', short: 'Сб', isWeekend: true },
  { value: 7, name: 'Воскресенье', short: 'Вс', isWeekend: true }
];

export const PAIRS = [
  { number: 1, time: '8:30-10:00', name: '1 пара' },
  { number: 2, time: '10:10-11:40', name: '2 пара' },
  { number: 3, time: '12:10-13:40', name: '3 пара' },
  { number: 4, time: '13:50-15:20', name: '4 пара' },
  { number: 5, time: '15:30-17:00', name: '5 пара' },
  { number: 6, time: '17:10-18:40', name: '6 пара' }
];

export const ROLES = {
  admin: 'Администратор',
  teacher: 'Преподаватель',
  student: 'Студент'
};

// Утилиты для работы с датами
export const DateUtils = {
  getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
  },

  getSunday(date) {
    const monday = this.getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  },

  getWeekDates(date) {
    const monday = this.getMonday(date);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  },

  formatDate(date, format = 'ru') {
    if (!date) return '';
    const d = new Date(date);
    if (format === 'ru') {
      const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    }
    if (format === 'iso') {
      return d.toISOString().split('T')[0];
    }
    return d.toLocaleDateString('ru-RU');
  },

  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  },

  getWeekNumber(date) {
    const d = new Date(date);
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  getWeekRange(date) {
    const start = this.getMonday(date);
    const end = this.getSunday(date);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      start,
      end
    };
  }
};

// Сервис для работы с API
export class ScheduleService {
  constructor(token) {
    this.token = token;
    this.baseUrl = '/api/schedule';
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async getWeekSchedule(startDate, endDate, groupId = null) {
    let url = `${this.baseUrl}?weekStart=${startDate}&weekEnd=${endDate}`;
    if (groupId) {
      url += `&groupId=${groupId}`;
    }
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch schedule');
    return response.json();
  }

  async createLesson(lessonData) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(lessonData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create lesson');
    }
    return response.json();
  }

  async updateLesson(id, lessonData) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(lessonData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update lesson');
    }
    return response.json();
  }

  async deleteLesson(id) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete lesson');
    }
    return response.json();
  }

  async updateNotes(id, notes) {
    const response = await fetch(this.baseUrl, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ id, notes })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update notes');
    }
    return response.json();
  }
}