import { useState, useEffect, useCallback } from 'react';
import { ProgressiveOverloadService } from '../services/progressiveOverloadService';
import type {
  ProgressionRecommendation,
  ExperienceLevel,
  ProgressionTracking
} from '../types/progression';
import type { Exercise } from '../types/exercise';
import { useAppSelector } from '../store/hooks';

// Convert user-friendly progression rate to technical experience level
const mapProgressionRateToExperienceLevel = (rate: 'beginner' | 'intermediate' | 'advanced'): ExperienceLevel => {
  switch (rate) {
    case 'beginner':
      return 'conservative';
    case 'intermediate':
      return 'standard';
    case 'advanced':
      return 'aggressive';
    default:
      return 'standard';
  }
};

interface UseProgressionRecommendationProps {
  exercise: Exercise;
  currentSets: number;
  userId?: string;
  configuredReps?: number; // Reps configured in the parsed workout
  configuredWeight?: number; // Prescribed working load from the planned/parsed workout
}

interface UseProgressionRecommendationReturn {
  recommendation: ProgressionRecommendation | null;
  isLoading: boolean;
  error: string | null;
  experienceLevel: ExperienceLevel;
  progressionTracking: ProgressionTracking | null;
  acceptedRecommendation: boolean;

  // Actions
  setExperienceLevel: (level: ExperienceLevel) => void;
  acceptRecommendation: () => void;
  modifyRecommendation: (weight?: number, reps?: number) => void;
  dismissRecommendation: () => void;
  refreshRecommendation: () => Promise<void>;
}

export const useProgressionRecommendation = ({
  exercise,
  currentSets,
  userId,
  configuredReps,
  configuredWeight
}: UseProgressionRecommendationProps): UseProgressionRecommendationReturn => {
  // Get user from Redux store if not provided
  const reduxUser = useAppSelector(state => state.user.currentUser);
  const userPreferences = useAppSelector(state => state.user.preferences);
  const effectiveUserId = userId || reduxUser?.uid;

  // State
  const [recommendation, setRecommendation] = useState<ProgressionRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    mapProgressionRateToExperienceLevel(userPreferences.defaultProgressionRate)
  );
  const [progressionTracking, setProgressionTracking] = useState<ProgressionTracking | null>(null);
  const [acceptedRecommendation, setAcceptedRecommendation] = useState(false);

  // Load recommendation
  const loadRecommendation = useCallback(async () => {
    if (!effectiveUserId || !exercise) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rec = await ProgressiveOverloadService.getRecommendation(
        effectiveUserId,
        exercise,
        currentSets,
        experienceLevel,
        configuredReps,
        configuredWeight
      );

      // Stamp the rec with the exercise it was computed for, so consumers can
      // discard a stale rec still held during an async reload (the modify/
      // fatigue/decline paths spread `...recommendation`, preserving the stamp).
      setRecommendation({ ...rec, exerciseId: exercise.id });

      // Auto-accept the recommendation by default so weight gets pre-populated
      setAcceptedRecommendation(true);

      // Initialize progression tracking
      setProgressionTracking({
        recommendedWeight: rec.recommendedWeight,
        recommendedReps: rec.recommendedReps,
        recommendedTime: rec.recommendedTime,
        progressionFollowed: true, // Set to true since we're auto-accepting
        experienceLevel,
        outcomeRating: 'met',
        deloadApplied: rec.deloadApplied
      });

    } catch (err) {
      console.error('Error loading progression recommendation:', err);
      setError('Failed to load progression recommendation');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, exercise, currentSets, experienceLevel, configuredReps, configuredWeight]);

  // Update experience level when user's default progression rate changes
  useEffect(() => {
    const newExperienceLevel = mapProgressionRateToExperienceLevel(userPreferences.defaultProgressionRate);
    if (newExperienceLevel !== experienceLevel) {
      setExperienceLevel(newExperienceLevel);
    }
  }, [userPreferences.defaultProgressionRate, experienceLevel]);

  // Load recommendation on mount and when dependencies change
  useEffect(() => {
    loadRecommendation();
    // Reset accepted state when exercise changes
    setAcceptedRecommendation(false);
  }, [loadRecommendation]);

  // Actions
  const acceptRecommendation = useCallback(() => {
    if (!recommendation || !progressionTracking) return;

    setAcceptedRecommendation(true);
    setProgressionTracking({
      ...progressionTracking,
      progressionFollowed: true,
      actualWeight: recommendation.recommendedWeight,
      actualReps: recommendation.recommendedReps,
      actualTime: recommendation.recommendedTime
    });
  }, [recommendation, progressionTracking]);

  const modifyRecommendation = useCallback((weight?: number, reps?: number) => {
    if (!recommendation || !progressionTracking) return;

    const modifiedRec = { ...recommendation };
    if (weight !== undefined) {
      modifiedRec.recommendedWeight = weight;
    }
    if (reps !== undefined) {
      modifiedRec.recommendedReps = reps;
    }

    setRecommendation(modifiedRec);
    setProgressionTracking({
      ...progressionTracking,
      progressionFollowed: false,
      actualWeight: weight || progressionTracking.actualWeight,
      actualReps: reps || progressionTracking.actualReps
    });
    setAcceptedRecommendation(true);
  }, [recommendation, progressionTracking]);

  const dismissRecommendation = useCallback(() => {
    setRecommendation(null);
    setAcceptedRecommendation(false);
  }, []);

  const refreshRecommendation = useCallback(async () => {
    await loadRecommendation();
  }, [loadRecommendation]);

  return {
    recommendation,
    isLoading,
    error,
    experienceLevel,
    progressionTracking,
    acceptedRecommendation,
    setExperienceLevel,
    acceptRecommendation,
    modifyRecommendation,
    dismissRecommendation,
    refreshRecommendation
  };
};

export default useProgressionRecommendation;