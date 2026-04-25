import { useState, useEffect, useMemo } from 'react';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { useAppSelector } from '../store/hooks';
import type { WorkoutSummary, ExerciseHistory } from '../types/exerciseHistory';
import {
  calculateWeeklyStats,
  calculateMonthlyStats,
  type WeeklyStats,
  type MonthlyStats
} from '../utils/statsCalculator';

export interface LastWorkoutStats {
  name: string;
  date: Date;
  duration: number;
  totalVolume: number;
  totalSets: number;
  totalExercises: number;
  averageRPE?: number;
  personalRecords: number;
}

export interface UseWorkoutStatsReturn {
  weeklyStats: WeeklyStats;
  monthlyStats: MonthlyStats;
  lastWorkoutStats: LastWorkoutStats | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function useWorkoutStats(): UseWorkoutStatsReturn {
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSummary[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user ID from auth state
  const user = useAppSelector(state => state.user.profile);

  const fetchStatsData = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Calculate date ranges
      const now = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

      // Fetch workout summaries and exercise history in parallel
      const [allSummaries, allExercises] = await Promise.all([
        ExerciseHistoryService.getWorkoutHistory(user.uid, 100),
        ExerciseHistoryService.getExerciseHistory(user.uid, { limit: 500 })
      ]);

      // Filter to last month client-side
      const summaries = allSummaries.filter(summary => {
        const workoutDate = new Date(summary.startTime);
        return workoutDate >= oneMonthAgo && workoutDate <= now;
      });

      const exercises = allExercises.filter(exercise => {
        const exerciseDate = new Date(exercise.workoutDate);
        return exerciseDate >= oneMonthAgo && exerciseDate <= now;
      });

      setWorkoutHistory(summaries);
      setExerciseHistory(exercises);
    } catch (err) {
      console.error('Error fetching workout stats:', err);
      setError('Failed to load workout statistics');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchStatsData();
  }, [user?.uid]);

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    if (!workoutHistory.length || !exerciseHistory.length) {
      return {
        workoutsCompleted: 0,
        totalVolume: 0,
        totalDuration: 0,
        mostTrainedMuscles: [],
        streak: 0,
        consistencyScore: 0
      };
    }
    return calculateWeeklyStats(workoutHistory, exerciseHistory);
  }, [workoutHistory, exerciseHistory]);

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    if (!workoutHistory.length || !exerciseHistory.length) {
      return {
        workoutsCompleted: 0,
        totalTrainingTime: 0,
        volumeProgression: [],
        consistencyScore: 0,
        newExercisesTried: 0,
        personalRecords: 0
      };
    }
    return calculateMonthlyStats(workoutHistory, exerciseHistory);
  }, [workoutHistory, exerciseHistory]);

  // Calculate last workout stats
  const lastWorkoutStats = useMemo((): LastWorkoutStats | null => {
    if (!workoutHistory.length || !exerciseHistory.length) return null;

    // Get the most recent workout
    const lastWorkout = workoutHistory.reduce((latest, workout) =>
      new Date(workout.startTime) > new Date(latest.startTime) ? workout : latest
    );

    // Get exercises from the last workout
    const lastWorkoutExercises = exerciseHistory.filter(
      exercise => exercise.workoutId === lastWorkout.id
    );

    // Calculate average RPE if available
    const rpeValues = lastWorkoutExercises
      .flatMap(exercise => exercise.sets)
      .map(set => set.rpe)
      .filter((rpe): rpe is number => rpe !== undefined);

    const averageRPE = rpeValues.length > 0
      ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length
      : undefined;

    // Count personal records from last workout
    const personalRecords = lastWorkoutExercises.reduce((count, exercise) => {
      const hasAnyPR = exercise.personalRecords && (
        exercise.personalRecords.maxWeight ||
        exercise.personalRecords.maxReps ||
        exercise.personalRecords.maxVolume
      );
      return count + (hasAnyPR ? 1 : 0);
    }, 0);

    return {
      name: lastWorkout.name,
      date: new Date(lastWorkout.startTime),
      duration: lastWorkout.duration,
      totalVolume: lastWorkout.totalVolume,
      totalSets: lastWorkout.totalSets,
      totalExercises: lastWorkout.totalExercises,
      averageRPE,
      personalRecords
    };
  }, [workoutHistory, exerciseHistory]);

  const refreshData = async () => {
    await fetchStatsData();
  };

  return {
    weeklyStats,
    monthlyStats,
    lastWorkoutStats,
    isLoading,
    error,
    refreshData
  };
}