import { useState, useEffect, useMemo } from 'react';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { ScheduleService } from '../services/scheduleService';
import { useAppSelector } from '../store/hooks';
import type { WorkoutSummary } from '../types/exerciseHistory';
import { generateCalendarData, type CalendarMonth } from '../utils/statsCalculator';
import { usePlannedSchedule } from './usePlannedSchedule';

export interface UseWorkoutCalendarReturn {
  calendarData: CalendarMonth;
  /** Raw history (month-independent) so consumers can derive "today" without
   *  re-fetching or being affected by which month the grid is paged to. */
  workoutHistory: WorkoutSummary[];
  currentDate: Date;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  navigateMonth: (direction: 'prev' | 'next') => void;
  goToMonth: (date: Date) => void;
}

export function useWorkoutCalendar(): UseWorkoutCalendarReturn {
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSummary[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user ID from auth state
  const user = useAppSelector(state => state.user.profile);
  const { plannedByDate } = usePlannedSchedule();

  const fetchWorkoutHistory = async () => {
    const idKey = user?.uid ?? 'anon';
    try {
      setIsLoading(true);
      setError(null);

      // Remote history (authed only); demo/anon rely on the local performed store.
      let remote: WorkoutSummary[] = [];
      if (user?.uid) {
        remote = (await ExerciseHistoryService.getWorkoutHistory(user.uid, 100)) || [];
      }
      // Merge locally-completed Charlie days so they render even when Firestore
      // writes are stubbed (loginless demo) or offline.
      const local = ScheduleService.getPerformedLocal(idKey);
      setWorkoutHistory([...remote, ...local]);
    } catch (err) {
      console.error('Error fetching workout history:', err);
      setError(null); // Don't show error, just use empty state
      setWorkoutHistory(ScheduleService.getPerformedLocal(user?.uid ?? 'anon'));
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchWorkoutHistory();
  }, [user?.uid]);

  // Generate calendar data from workout history + the planned-schedule projection
  const calendarData = useMemo(() => {
    return generateCalendarData(workoutHistory, currentDate, plannedByDate);
  }, [workoutHistory, currentDate, plannedByDate]);

  // Navigation functions
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToMonth = (date: Date) => {
    setCurrentDate(new Date(date));
  };

  const refreshData = async () => {
    await fetchWorkoutHistory();
  };

  return {
    calendarData,
    workoutHistory,
    currentDate,
    isLoading,
    error,
    refreshData,
    navigateMonth,
    goToMonth
  };
}