import { useState, useEffect, useMemo } from 'react';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { useAppSelector } from '../store/hooks';
import type { WorkoutSummary, ExerciseHistory, ExerciseStats } from '../types/exerciseHistory';
import {
  generateHighlights,
  type HighlightData
} from '../utils/statsCalculator';

export interface UseHighlightsReturn {
  highlights: HighlightData[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function useHighlights(): UseHighlightsReturn {
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSummary[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistory[]>([]);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user ID from auth state
  const user = useAppSelector(state => state.user.profile);

  const fetchHighlightsData = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Calculate date ranges - look back further for meaningful highlights
      const now = new Date();
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

      // Fetch data for highlights analysis
      const [allSummaries, allExercises] = await Promise.all([
        ExerciseHistoryService.getWorkoutHistory(user.uid, 200),
        ExerciseHistoryService.getExerciseHistory(user.uid, { limit: 1000 })
      ]);

      // Filter to last 2 months client-side
      const summaries = allSummaries.filter(summary => {
        const workoutDate = new Date(summary.startTime);
        return workoutDate >= twoMonthsAgo && workoutDate <= now;
      });

      const exercises = allExercises.filter(exercise => {
        const exerciseDate = new Date(exercise.workoutDate);
        return exerciseDate >= twoMonthsAgo && exerciseDate <= now;
      });

      // For now, use empty stats array as we don't have a bulk stats method
      const stats: ExerciseStats[] = [];

      setWorkoutHistory(summaries);
      setExerciseHistory(exercises);
      setExerciseStats(stats);
    } catch (err) {
      console.error('Error fetching highlights data:', err);
      setError('Failed to load workout highlights');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchHighlightsData();
  }, [user?.uid]);

  // Generate highlights from data
  const highlights = useMemo(() => {
    if (!workoutHistory.length || !exerciseHistory.length) {
      return [];
    }
    return generateHighlights(workoutHistory, exerciseHistory, exerciseStats);
  }, [workoutHistory, exerciseHistory, exerciseStats]);

  const refreshData = async () => {
    await fetchHighlightsData();
  };

  return {
    highlights,
    isLoading,
    error,
    refreshData
  };
}