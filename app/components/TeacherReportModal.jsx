import { memo, useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { DateUtils, DAYS, PAIRS } from '@/lib/schedule-service';

export const TeacherReportModal = memo(({ teachers, schedule, onClose }) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [generating, setGenerating] = useState(false);

  const teacherOptions = teachers.map(t => ({ value: String(t.id), label: t.name }));

  const generateReport = async () => {
    if (!selectedTeacherId) {
      alert('Выберите преподавателя');
      return;
    }

    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const teacher = teachers.find(t => t.id === parseInt(selectedTeacherId));
      const teacherLessons = schedule.filter(l => l.teacher_id === teacher.id);
      
      const subjectsHours = {};
      teacherLessons.forEach(lesson => {
        if (!subjectsHours[lesson.subject_name]) {
          subjectsHours[lesson.subject_name] = { name: lesson.subject_name, hours: 0, lessons: [] };
        }
        subjectsHours[lesson.subject_name].hours += 1.5;
        subjectsHours[lesson.subject_name].lessons.push(lesson);
      });

      const now = new Date();
      const weekDates = DateUtils.getWeekDates(now);
      const weekNumber = DateUtils.getWeekNumber(now);

      const element = document.createElement('div');
      element.innerHTML = `
        <html>
          <head><meta charset="UTF-8"><style>
            body { font-family: 'Inter', Arial, sans-serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2c3e66; }
            .teacher-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .summary-table th, .summary-table td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            .summary-table th { background: #2c3e66; color: white; }
            .total-row { background: #e2e8f0; font-weight: bold; }
          </style></head>
          <body>
            <div class="header">
              <h1>Отчет о нагрузке преподавателя</h1>
              <h2>${DateUtils.formatDate(weekDates[0])} - ${DateUtils.formatDate(weekDates[6])} (${weekNumber} неделя)</h2>
            </div>
            <div class="teacher-info">
              <p><strong>Преподаватель:</strong> ${teacher.name}</p>
              <p><strong>Всего занятий:</strong> ${teacherLessons.length} пар</p>
              <p><strong>Общая нагрузка:</strong> ${(teacherLessons.length * 1.5).toFixed(1)} часов</p>
            </div>
            <h3>Сводка по предметам</h3>
            <table class="summary-table">
              <thead><tr><th>№</th><th>Предмет</th><th>Кол-во пар</th><th>Часов</th></tr></thead>
              <tbody>
                ${Object.values(subjectsHours).map((item, idx) => `
                  <tr><td>${idx + 1}</td><td>${item.name}</td><td>${item.lessons.length}</td><td>${item.hours.toFixed(1)}</td></tr>
                `).join('')}
                <tr class="total-row"><td colspan="2"><strong>ИТОГО:</strong></td><td><strong>${teacherLessons.length}</strong></td><td><strong>${(teacherLessons.length * 1.5).toFixed(1)}</strong></td></tr>
              </tbody>
            </table>
            <div class="footer"><p>Отчет сгенерирован ${new Date().toLocaleString('ru-RU')}</p></div>
          </body>
        </html>
      `;

      await html2pdf().set({
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `Отчет_${teacher.name}_неделя_${weekNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      }).from(element).save();

      alert('Отчет успешно сформирован');
      onClose();
    } catch (error) {
      console.error('Report error:', error);
      alert('Ошибка формирования отчета');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><i className="fas fa-chart-line"></i> Отчет по часам преподавателя</h2>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-form">
          <div className="form-group">
            <SearchableSelect
              options={teacherOptions}
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              placeholder="Выберите преподавателя"
              label="Преподаватель"
              icon="fas fa-chalkboard-teacher"
            />
          </div>
          <button className="submit-btn" onClick={generateReport} disabled={generating}>
            {generating ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-download"></i>}
            {generating ? ' Формирование...' : ' Сформировать отчет'}
          </button>
        </div>
      </div>
    </div>
  );
});

TeacherReportModal.displayName = 'TeacherReportModal';