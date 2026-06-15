import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { ProgressionRecommendation } from './ProgressionRecommendation';
import { ExperienceSlider } from './ExperienceSlider';
import { DeloadSuggestion } from './DeloadSuggestion';
import { FatigueCheck } from './FatigueCheck';
import { useProgressionRecommendation } from '../../hooks/useProgressionRecommendation';
import {
  setExperienceLevel,
  setProgressionTracking,
  updateProgressionTracking,
  recordProgressionOutcome
} from '../../store/slices/workoutSlice';
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../types/exercise';
import type { ExperienceLevel } from '../../types/progression';

interface ProgressionIntegrationProps {
  workoutExercise: WorkoutExercise;
  currentSetIndex: number;
  onWeightChange: (weight: number) => void;
  onRepsChange: (reps: number) => void;
}

/**
 * Example integration component showing how to use all progression system components together
 * This component should be integrated into the existing WorkoutPage
 */
export const ProgressionIntegration: React.FC<ProgressionIntegrationProps> = ({
  workoutExercise,
  currentSetIndex,
  onWeightChange,
  onRepsChange
}) => {
  const dispatch = useAppDispatch();
  const { experienceLevel: globalExperienceLevel } = useAppSelector(state => state.workout);
  const user = useAppSelector(state => state.user.currentUser);

  const [showDeload, setShowDeload] = useState(false);
  const [showFatigue, setShowFatigue] = useState(false);
  const [fatigueSetInfo, setFatigueSetInfo] = useState<{ weight: number; setNumber: number } | null>(null);

  const {
    recommendation,
    isLoading,
    error,
    experienceLevel,
    progressionTracking,
    setExperienceLevel: setLocalExperienceLevel,
    acceptRecommendation,
    modifyRecommendation,
    dismissRecommendation,
    applyFatigue,
    refreshRecommendation
  } = useProgressionRecommendation({
    exercise: workoutExercise.exercise,
    currentSets: workoutExercise.sets.length,
    userId: user?.uid
  });

  // Sync local experience level with global
  useEffect(() => {
    setLocalExperienceLevel(globalExperienceLevel);
  }, [globalExperienceLevel, setLocalExperienceLevel]);

  // Check if we should show deload suggestion
  useEffect(() => {
    if (recommendation?.deloadApplied && recommendation.daysSinceLastWorkout && recommendation.daysSinceLastWorkout >= 14) {
      setShowDeload(true);
    }
  }, [recommendation]);

  // Save progression tracking to Redux when it changes
  useEffect(() => {
    if (progressionTracking) {
      dispatch(setProgressionTracking({
        exerciseId: workoutExercise.exercise.id,
        tracking: progressionTracking
      }));
    }
  }, [progressionTracking, workoutExercise.exercise.id, dispatch]);

  // Handle experience level change
  const handleExperienceLevelChange = (level: ExperienceLevel) => {
    dispatch(setExperienceLevel(level));
    setLocalExperienceLevel(level);
    refreshRecommendation();
  };

  // Handle accepting recommendation
  const handleAcceptRecommendation = () => {
    acceptRecommendation();

    if (recommendation?.recommendedWeight) {
      onWeightChange(recommendation.recommendedWeight);
    }
    if (recommendation?.recommendedReps) {
      onRepsChange(recommendation.recommendedReps);
    }
  };

  // Handle modifying recommendation
  const handleModifyRecommendation = (weight?: number, reps?: number) => {
    modifyRecommendation(weight, reps);

    if (weight !== undefined) {
      onWeightChange(weight);
    }
    if (reps !== undefined) {
      onRepsChange(reps);
    }
  };

  // Handle deload acceptance
  const handleDeloadAccept = () => {
    setShowDeload(false);
    if (recommendation?.recommendedWeight) {
      onWeightChange(recommendation.recommendedWeight);
    }
  };

  // Handle deload decline
  const handleDeloadDecline = () => {
    setShowDeload(false);
    if (recommendation?.previousWeight) {
      onWeightChange(recommendation.previousWeight);
    }
  };

  // Handle fatigue check
  const handleFatigueApply = () => {
    setShowFatigue(false);
    applyFatigue();

    // Update weight based on fatigue adjustment
    if (recommendation?.recommendedWeight) {
      const adjustedWeight = Math.round(recommendation.recommendedWeight * 0.9);
      onWeightChange(adjustedWeight);
    }

    // Record fatigue outcome
    dispatch(recordProgressionOutcome({
      exerciseId: workoutExercise.exercise.id,
      outcome: 'failed',
      failureReason: 'fatigue'
    }));
  };

  // Handle fatigue decline
  const handleFatigueContinue = () => {
    setShowFatigue(false);
  };

  // Check for failed set (this should be called after each set completion)
  const checkSetPerformance = (set: WorkoutSet, setIndex: number) => {
    if (!set.completed || set.failed) {
      setFatigueSetInfo({
        weight: set.weight || 0,
        setNumber: setIndex + 1
      });
      setShowFatigue(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Experience Level Slider */}
      <ExperienceSlider
        currentLevel={experienceLevel}
        onChange={handleExperienceLevelChange}
        showTooltip={true}
      />

      {/* Progression Recommendation */}
      {recommendation && !isLoading && (
        <ProgressionRecommendation
          recommendation={recommendation}
          onAccept={handleAcceptRecommendation}
          onModify={handleModifyRecommendation}
          onDismiss={dismissRecommendation}
          isLoading={isLoading}
        />
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-md p-4">
          <p className="text-danger text-body-sm">{error}</p>
        </div>
      )}

      {/* Deload Suggestion Slide-out */}
      {showDeload && recommendation && (
        <DeloadSuggestion
          weeksSinceLastWorkout={Math.ceil((recommendation.daysSinceLastWorkout || 14) / 7)}
          suggestedDeloadPercentage={recommendation.deloadApplied ? 15 : 0}
          previousWeight={recommendation.previousWeight || 0}
          suggestedWeight={recommendation.recommendedWeight || 0}
          exerciseName={workoutExercise.exercise.name}
          onAccept={handleDeloadAccept}
          onDecline={handleDeloadDecline}
          onClose={() => setShowDeload(false)}
        />
      )}

      {/* Fatigue Check Slide-out */}
      {showFatigue && fatigueSetInfo && (
        <FatigueCheck
          exerciseName={workoutExercise.exercise.name}
          currentWeight={fatigueSetInfo.weight}
          setNumber={fatigueSetInfo.setNumber}
          onFatigued={handleFatigueApply}
          onNotFatigued={handleFatigueContinue}
          onClose={() => setShowFatigue(false)}
        />
      )}

      {/* Usage Instructions (remove in production) */}
      <div className="bg-accent/10 border border-accent/30 rounded-md p-4 text-caption">
        <h4 className="font-semibold text-ink mb-2">Integration Points:</h4>
        <ul className="space-y-1 text-ink-muted">
          <li>• Call checkSetPerformance() after each set completion</li>
          <li>• Save progressionTracking with exercise history</li>
          <li>• Load recommendation on exercise start</li>
          <li>• Update weights/reps based on accepted recommendations</li>
        </ul>
      </div>
    </div>
  );
};

export default ProgressionIntegration;