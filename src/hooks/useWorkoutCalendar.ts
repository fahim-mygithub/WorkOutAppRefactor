import { useState, useEffect, useMemo } from 'react';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { useAppSelector } from '../store/hooks';
import type { WorkoutSummary } from '../types/exerciseHistory';
import { generateCalendarData, type CalendarMonth } from '../utils/statsCalculator';

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

  const fetchWorkoutHistory = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      setWorkoutHistory([]); // Set empty array for demo mode
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch workout history (up to 100 recent workouts)
      const allSummaries = await ExerciseHistoryService.getWorkoutHistory(
        user.uid,
        100
      );

      setWorkoutHistory(allSummaries || []);
    } catch (err) {
      console.error('Error fetching workout history:', err);
      setError(null); // Don't show error, just use empty state
      setWorkoutHistory([]); // Fallback to empty array
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchWorkoutHistory();
  }, [user?.uid]);

  // Generate calendar data from workout history
  const calendarData = useMemo(() => {
    return generateCalendarData(workoutHistory, currentDate);
  }, [workoutHistory, currentDate]);

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