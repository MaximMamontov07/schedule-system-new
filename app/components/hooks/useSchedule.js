import { useState, useCallback, useMemo, useEffect } from 'react';
import { ScheduleService, DateUtils } from '@/lib/schedule-service';

export function useSchedule(token, initialGroupId = null) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [filters, setFilters] = useState({
    teacherId: '',
    subjectId: '',
    dayOfWeek: '',
    pairNumber: '',
    classroomId: ''
  });

  const service = useMemo(() => new ScheduleService(token), [token]);

  const weekRange = useMemo(() => DateUtils.getWeekRange(currentDate), [currentDate]);
  const weekDates = useMemo(() => DateUtils.getWeekDates(currentDate), [currentDate]);
  const weekNumber = useMemo(() => DateUtils.getWeekNumber(currentDate), [currentDate]);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await service.getWeekSchedule(
        weekRange.startDate,
        weekRange.endDate,
        selectedGroupId
      );
      setSchedule(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [weekRange, selectedGroupId, service]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const filteredSchedule = useMemo(() => {
    let filtered = [...schedule];
    
    if (filters.teacherId) {
      filtered = filtered.filter(s => s.teacher_id === parseInt(filters.teacherId));
    }
    if (filters.subjectId) {
      filtered = filtered.filter(s => s.subject_id === parseInt(filters.subjectId));
    }
    if (filters.dayOfWeek) {
      filtered = filtered.filter(s => s.day_of_week === parseInt(filters.dayOfWeek));
    }
    if (filters.pairNumber) {
      filtered = filtered.filter(s => s.pair_number === parseInt(filters.pairNumber));
    }
    if (filters.classroomId) {
      filtered = filtered.filter(s => s.classroom_id === parseInt(filters.classroomId));
    }
    
    return filtered;
  }, [schedule, filters]);

  const goToPreviousWeek = useCallback(() => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  }, [currentDate]);

  const goToNextWeek = useCallback(() => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  }, [currentDate]);

  const goToCurrentWeek = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToDate = useCallback((date) => {
    setCurrentDate(date);
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      teacherId: '',
      subjectId: '',
      dayOfWeek: '',
      pairNumber: '',
      classroomId: ''
    });
  }, []);

  const createLesson = useCallback(async (lessonData) => {
    const response = await service.createLesson(lessonData);
    await loadSchedule();
    return response;
  }, [service, loadSchedule]);

  const updateLesson = useCallback(async (id, lessonData) => {
    const response = await service.updateLesson(id, lessonData);
    await loadSchedule();
    return response;
  }, [service, loadSchedule]);

  const deleteLesson = useCallback(async (id) => {
    await service.deleteLesson(id);
    await loadSchedule();
  }, [service, loadSchedule]);

  const updateNotes = useCallback(async (id, notes) => {
    await service.updateNotes(id, notes);
    await loadSchedule();
  }, [service, loadSchedule]);

  return {
    schedule: filteredSchedule,
    allSchedule: schedule,
    loading,
    error,
    currentDate,
    weekDates,
    weekRange,
    weekNumber,
    filters,
    selectedGroupId,
    setSelectedGroupId,
    updateFilter,
    resetFilters,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    goToDate,
    createLesson,
    updateLesson,
    deleteLesson,
    updateNotes,
    loadSchedule,
    hasActiveFilters: Object.values(filters).some(v => v)
  };
}