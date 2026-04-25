import { useState, useEffect, useCallback } from 'react';
import { ProgressiveOverloadService } from '../services/progressiveOverloadService';
import type {
  ProgressionRecommendation,
  ExperienceLevel,
  ProgressionTracking
} from '../types/progression';
import type { Exercise, WorkoutSet } from '../types/exercise';
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
}

interface UseProgressionRecommendationReturn {
  recommendation: ProgressionRecommendation | null;
  isLoading: boolean;
  error: string | null;
  experienceLevel: ExperienceLevel;
  showDeloadSuggestion: boolean;
  showFatigueCheck: boolean;
  progressionTracking: ProgressionTracking | null;
  acceptedRecommendation: boolean;

  // Actions
  setExperienceLevel: (level: ExperienceLevel) => void;
  acceptRecommendation: () => void;
  modifyRecommendation: (weight?: number, reps?: number) => void;
  dismissRecommendation: () => void;
  applyDeload: () => void;
  declineDeload: () => void;
  applyFatigue: () => void;
  continuePlan: () => void;
  checkForFailedSet: (set: WorkoutSet, setNumber: number) => void;
  refreshRecommendation: () => Promise<void>;
}

export const useProgressionRecommendation = ({
  exercise,
  currentSets,
  userId,
  configuredReps
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
  const [showDeloadSuggestion, setShowDeloadSuggestion] = useState(false);
  const [showFatigueCheck, setShowFatigueCheck] = useState(false);
  const [progressionTracking, setProgressionTracking] = useState<ProgressionTracking | null>(null);
  const [acceptedRecommendation, setAcceptedRecommendation] = useState(false);
  const [failedSetInfo, setFailedSetInfo] = useState<{ weight: number; setNumber: number } | null>(null);

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
        configuredReps
      );

      setRecommendation(rec);

      // Auto-accept the recommendation by default so weight gets pre-populated
      setAcceptedRecommendation(true);

      // Check if deload suggestion should be shown
      if (rec.deloadApplied && rec.daysSinceLastWorkout && rec.daysSinceLastWorkout >= 14) {
        setShowDeloadSuggestion(true);
      }

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
  }, [effectiveUserId, exercise, currentSets, experienceLevel, configuredReps]);

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

  const applyDeload = useCallback(() => {
    setShowDeloadSuggestion(false);
    // Deload is already applied in the recommendation
    acceptRecommendation();
  }, [acceptRecommendation]);

  const declineDeload = useCallback(() => {
    if (!recommendation) return;

    setShowDeloadSuggestion(false);

    // Recalculate without deload
    const originalWeight = recommendation.previousWeight || recommendation.recommendedWeight || 0;
    const adjustedRec = {
      ...recommendation,
      recommendedWeight: originalWeight,
      deloadApplied: false,
      reasoning: 'Deload declined. Using previous weight.'
    };

    setRecommendation(adjustedRec);
  }, [recommendation]);

  const applyFatigue = useCallback(() => {
    if (!recommendation) return;

    setShowFatigueCheck(false);

    // Apply fatigue adjustment
    const fatigueAdjusted = ProgressiveOverloadService.applyFatigueAdjustment(recommendation);
    setRecommendation(fatigueAdjusted);

    // Set accepted recommendation to true so the adjusted weight auto-fills in remaining sets
    setAcceptedRecommendation(true);

    if (progressionTracking) {
      setProgressionTracking({
        ...progressionTracking,
        progressionFollowed: true,
        failureReason: 'fatigue',
        actualWeight: fatigueAdjusted.recommendedWeight,
        actualReps: fatigueAdjusted.recommendedReps
      });
    }
  }, [recommendation, progressionTracking]);

  const continuePlan = useCallback(() => {
    setShowFatigueCheck(false);
    // Continue with current plan, no changes
  }, []);

  const checkForFailedSet = useCallback((set: WorkoutSet, setNumber: number) => {
    // Check if set was failed (didn't hit target reps)
    if (!set.completed || (set.reps > 0 && set.failed)) {
      setFailedSetInfo({ weight: set.weight || 0, setNumber });
      setShowFatigueCheck(true);

      // Update tracking
      if (progressionTracking) {
        setProgressionTracking({
          ...progressionTracking,
          outcomeRating: 'failed'
        });
      }
    }
  }, [progressionTracking]);

  const refreshRecommendation = useCallback(async () => {
    await loadRecommendation();
  }, [loadRecommendation]);

  return {
    recommendation,
    isLoading,
    error,
    experienceLevel,
    showDeloadSuggestion,
    showFatigueCheck,
    progressionTracking,
    acceptedRecommendation,
    setExperienceLevel,
    acceptRecommendation,
    modifyRecommendation,
    dismissRecommendation,
    applyDeload,
    declineDeload,
    applyFatigue,
    continuePlan,
    checkForFailedSet,
    refreshRecommendation
  };
};

export default useProgressionRecommendation;