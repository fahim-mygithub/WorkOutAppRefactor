import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { useWakeLock } from '../hooks/useWakeLock';
import { SharedWorkoutLoader } from '../components/SharedWorkoutLoader';
import { SharedWorkoutStartPage } from '../components/SharedWorkoutStartPage';
import { incrementWorkoutUseCount } from '../store/slices/sharedWorkoutSlice';
import { loadWorkoutContext } from '../store/slices/exerciseHistorySlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import {
  startWorkout,
  endWorkout,
  nextExercise,
  previousExercise,
  completeSet,
  uncompleteSet,
  addSet,
  jumpToSet,
  startRestTimer,
  stopRestTimer,
  nextSupersetExercise,
  completeSuperset,
  updateExercise,
  updateExerciseNotesAndTitle,
  setShowCompletionModal,
  recordProgressionOutcome
} from '../store/slices/workoutSlice';
import { RestTimer } from '../components/RestTimer';
import { SupersetExerciseCard } from '../components/SupersetExerciseCard';
import { ExerciseEditModal } from '../components/ExerciseEditModal';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { DeloadSuggestion } from '../components/workout/DeloadSuggestion';
import { FatigueCheck } from '../components/workout/FatigueCheck';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { ActiveExerciseCard } from '../components/workout/ActiveExerciseCard';
import {
  ExerciseListPanel,
  type ExerciseDisplayGroup,
} from '../components/workout/ExerciseListPanel';
import { useProgressionRecommendation } from '../hooks/useProgressionRecommendation';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Exercise, WorkoutExercise, WorkoutSet } from '../types/exercise';

// Helper function to group exercises for display purposes
const getGroupedExercisesForDisplay = (exercises: WorkoutExercise[], currentExerciseIndex: number): ExerciseDisplayGroup[] => {
  const groups: ExerciseDisplayGroup[] = [];
  const processedExerciseIds = new Set<string>();

  exercises.forEach((exercise, index) => {
    // Skip if already processed as part of a superset
    if (processedExerciseIds.has(exercise.id)) return;

    if (exercise.isSuperset && exercise.supersetId) {
      // Find all exercises in this superset
      const supersetExercises = exercises.filter(ex =>
        ex.supersetId === exercise.supersetId
      );

      // Mark all superset exercises as processed
      supersetExercises.forEach(ex => processedExerciseIds.add(ex.id));

      // Calculate totals for the superset
      const totalSets = supersetExercises.reduce((total, ex) => total + ex.sets.length, 0);
      const completedSets = supersetExercises.reduce((total, ex) =>
        total + ex.sets.filter(set => set.completed).length, 0);

      // Check if any exercise in the superset is currently active
      const isActive = supersetExercises.some(ex =>
        exercises.findIndex(e => e.id === ex.id) === currentExerciseIndex
      );

      groups.push({
        id: exercise.supersetId,
        name: supersetExercises.map(ex => ex.customTitle || ex.exercise.name).join(' + '),
        isSuperset: true,
        exercises: supersetExercises,
        totalSets,
        completedSets,
        isActive
      });
    } else {
      // Regular exercise
      processedExerciseIds.add(exercise.id);

      groups.push({
        id: exercise.id,
        name: exercise.customTitle || exercise.exercise.name,
        isSuperset: false,
        exercises: [exercise],
        totalSets: exercise.sets.length,
        completedSets: exercise.sets.filter(set => set.completed).length,
        isActive: index === currentExerciseIndex
      });
    }
  });

  return groups;
};

export default function WorkoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { activeWorkout, restTimer, showCompletionModal } = useAppSelector((state) => state.workout);
  const { preferences } = useAppSelector((state) => state.user);
  const { user } = useAuth(); // Get Firebase user from auth context
  const { previousPerformances, isLoadingPrevious } = useAppSelector((state) => state.exerciseHistory);

  // Check if we're viewing a shared workout
  const { shareId } = useParams<{ shareId?: string }>() || {};
  const isViewingSharedWorkout = !!shareId;

  // Check for stored shared context as fallback
  const storedContext = useMemo(() => {
    try {
      const stored = sessionStorage.getItem('sharedWorkoutContext');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Lock in shared session status to prevent state changes during workout
  const [isSharedSession] = useState(!!shareId || !!storedContext?.isSharedSession);
  const isAnonymousUser = (isViewingSharedWorkout || isSharedSession) && !user;

  // Keep the screen awake for the duration of a live workout (PWA hardening §3).
  // Feature-detected + auto-degrading inside the hook; safe everywhere.
  useWakeLock(!!activeWorkout);

  const [editingExercise, setEditingExercise] = useState<WorkoutExercise | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeloadModal, setShowDeloadModal] = useState(false);
  const [showFatigueModal, setShowFatigueModal] = useState(false);
  const [fatigueSetInfo, setFatigueSetInfo] = useState<{ weight: number; setNumber: number } | null>(null);
  const [failedSetsCount, setFailedSetsCount] = useState(0);
  const [showEndWorkoutModal, setShowEndWorkoutModal] = useState(false);

  // Track if workout context has been loaded to prevent duplicate calls
  const contextLoadedRef = useRef<string | null>(null);

  // Reset failed sets count when exercise changes
  useEffect(() => {
    setFailedSetsCount(0);
  }, [activeWorkout?.currentExerciseIndex]);

  // Memoize exercise IDs to prevent unnecessary re-calculations
  // Use workout ID as dependency instead of the entire exercises array
  const exerciseIdsForContext = useMemo(() => {
    if (!activeWorkout) return [];

    return activeWorkout.exercises
      .map(ex => ex.exercise.id)
      .filter(id => !id.startsWith('fallback-')); // Skip fallback exercises
  }, [activeWorkout?.id]); // Only depend on workout ID, not the entire exercises array

  // Effect for initial workout setup and context loading
  useEffect(() => {
    if (!activeWorkout) {
      // Don't redirect if we're on a shared workout route or in a shared session
      if (!isViewingSharedWorkout && !isSharedSession) {
        navigate('/build');
      }
      return;
    }

    // Load workout context only once per workout (when workout ID changes)
    // Only for authenticated users - anonymous users can workout without context
    if (user?.uid && exerciseIdsForContext.length > 0 && contextLoadedRef.current !== activeWorkout.id) {
      contextLoadedRef.current = activeWorkout.id;
      dispatch(loadWorkoutContext({ userId: user.uid, exerciseIds: exerciseIdsForContext }));
    }
  }, [activeWorkout?.id, navigate, dispatch, user?.uid, exerciseIdsForContext, isViewingSharedWorkout, isSharedSession, isAnonymousUser]);

  // NOTE: the workout-duration interval lives in <WorkoutDurationTimer> (a leaf
  // rendered by <WorkoutHeader>) so the per-second tick no longer re-renders the
  // whole workout tree — PWA hardening §5.

  // Move all variable declarations and hooks before early return to prevent hook count mismatch
  const currentExercise = activeWorkout?.exercises[activeWorkout.currentExerciseIndex];
  const currentSet = currentExercise?.sets[activeWorkout?.currentSetIndex || 0];
  const currentSupersetIndex = activeWorkout?.currentSupersetIndex || 0;

  // Initialize progression recommendation hook for current exercise (always call this hook)
  const progressionHook = useProgressionRecommendation({
    // The hook internally guards `if (!exercise)`, so an undefined exercise is
    // tolerated; the cast satisfies the (too-narrow) param type without changing behavior.
    exercise: currentExercise?.exercise as Exercise,
    currentSets: currentExercise?.sets.length || 0,
    userId: user?.uid,
    configuredReps: currentExercise?.sets?.[0]?.reps // Pass configured reps from first set
  });

  // Effect to check for deload when recommendation loads
  useEffect(() => {
    if (activeWorkout && progressionHook.recommendation?.deloadApplied &&
        progressionHook.recommendation.daysSinceLastWorkout &&
        progressionHook.recommendation.daysSinceLastWorkout >= 14) {
      setShowDeloadModal(true);
    }
  }, [progressionHook.recommendation, activeWorkout]);

  if (!activeWorkout) {
    // If we're viewing a shared workout, wrap with SharedWorkoutLoader
    if (isViewingSharedWorkout) {
      return (
        <SharedWorkoutLoader
          onWorkoutNotFound={() => navigate('/build')}
        >
          {(sharedWorkout) => (
            <SharedWorkoutStartPage
              sharedWorkout={sharedWorkout}
              onStartWorkout={(workout) => {
                // Start the shared workout
                dispatch(startWorkout({
                  name: workout.workoutData.name,
                  exercises: workout.workoutData.exercises
                }));
                // Track usage
                if (shareId) {
                  dispatch(incrementWorkoutUseCount(shareId));
                }
              }}
            />
          )}
        </SharedWorkoutLoader>
      );
    }

    // Regular no workout page for authenticated users
    return (
      <div className="flex min-h-full items-center justify-center bg-surface p-4">
        <Card elevation={1} className="p-8 text-center">
          <h1 className="mb-4 text-title font-bold text-ink">No Active Workout</h1>
          <p className="mb-6 text-ink-subtle">Start a workout from the Build page</p>
          <Button onClick={() => navigate('/build')}>Go to Build Page</Button>
        </Card>
      </div>
    );
  }

  // Guard against an out-of-bounds currentExerciseIndex (empty/short exercises
  // array, or a stale index after removing an exercise). This narrows
  // `currentExercise` to a defined value for the rest of the render.
  if (!currentExercise) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface p-4">
        <Card elevation={1} className="p-8 text-center">
          <h1 className="mb-4 text-title font-bold text-ink">No Exercise Selected</h1>
          <p className="mb-6 text-ink-subtle">This workout has no current exercise.</p>
          <Button onClick={() => navigate('/build')}>Go to Build Page</Button>
        </Card>
      </div>
    );
  }

  // Get superset exercises if we're in one
  const supersetExercises = currentExercise?.isSuperset && currentExercise.supersetId
    ? activeWorkout.exercises.filter(ex => ex.supersetId === currentExercise.supersetId)
    : [];

  const handleCompleteSet = (reps: number, weight: number) => {
    dispatch(completeSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex: activeWorkout.currentSetIndex,
      setData: { reps, weight }
    }));

    // Check for failed set (if reps are significantly less than target)
    if (currentSet) {
      const targetReps = currentSet.reps || 8; // Default target
      const setFailed = reps < targetReps * 0.8;

      if (setFailed) {
        const newFailedCount = failedSetsCount + 1;
        setFailedSetsCount(newFailedCount);

        // Determine threshold based on whether we have previous data
        const hasPreviousData = currentExercise?.exercise?.id && previousPerformances[currentExercise.exercise.id] != null;
        const requiredFailedSets = hasPreviousData ? 2 : 3; // More conservative for first-time exercises

        // Only trigger fatigue check after multiple consecutive failed sets
        if (newFailedCount >= requiredFailedSets) {
          setFatigueSetInfo({ weight, setNumber: activeWorkout.currentSetIndex + 1 });
          setShowFatigueModal(true);
          progressionHook.checkForFailedSet(currentSet, activeWorkout.currentSetIndex);
        }
      }
    }

    // Check if current exercise is part of a superset
    const isCurrentExerciseInSuperset = currentExercise?.isSuperset && currentExercise.supersetId;

    if (isCurrentExerciseInSuperset) {
      // Find all exercises in this superset
      const allSupersetExercises = activeWorkout.exercises.filter(ex =>
        ex.supersetId === currentExercise.supersetId
      );

      if (allSupersetExercises.length > 1) {
        const currentIndexInSuperset = allSupersetExercises.findIndex(ex => ex.id === currentExercise?.id);
        const isLastExerciseInSuperset = currentIndexInSuperset === allSupersetExercises.length - 1;
        const isLastSet = activeWorkout.currentSetIndex === (currentExercise?.sets.length || 0) - 1;

        if (isLastExerciseInSuperset && isLastSet) {
          // Completed all sets of superset - start rest timer and move to next exercise group
          dispatch(startRestTimer({ duration: currentExercise?.restTime || 120 }));
          dispatch(completeSuperset());
        } else if (isLastExerciseInSuperset && !isLastSet) {
          // Completed a round of the superset (last exercise of current set) - start rest timer
          dispatch(startRestTimer({ duration: currentExercise?.restTime || 120 }));
        } else {
          // Move to next exercise in superset (within the same set)
          dispatch(nextSupersetExercise());
        }
      } else {
        // Single exercise marked as superset, treat as regular exercise
        if (currentExercise?.restTime) {
          dispatch(startRestTimer({ duration: currentExercise.restTime }));
        }
      }
    } else {
      // Regular exercise: start rest timer
      if (currentExercise?.restTime) {
        dispatch(startRestTimer({ duration: currentExercise.restTime }));
      }
    }
  };

  const handleUncompleteSet = () => {
    dispatch(uncompleteSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex: activeWorkout.currentSetIndex
    }));
  };

  const handleAddSet = () => {
    dispatch(addSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setData: {
        reps: currentSet?.reps || 0,
        weight: currentSet?.weight || 0
      }
    }));
  };

  const handleJumpToSet = (setIndex: number) => {
    dispatch(jumpToSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex
    }));
  };

  const handleJumpToExercise = (exerciseIndex: number) => {
    dispatch(jumpToSet({
      exerciseIndex,
      setIndex: 0
    }));
  };

  const handleEditExercise = (exercise: WorkoutExercise) => {
    setEditingExercise(exercise);
    setShowEditModal(true);
  };

  const handleSaveExercise = (exerciseId: string, sets: WorkoutSet[], restTime: number) => {
    dispatch(updateExercise({ exerciseId, sets, restTime }));
    setShowEditModal(false);
    setEditingExercise(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingExercise(null);
  };

  const handleEndWorkoutClick = () => {
    setShowEndWorkoutModal(true);
  };

  const handleEndWithoutSaving = () => {
    dispatch(endWorkout());
    setShowEndWorkoutModal(false);
    // Navigate appropriately based on user type
    if (!isAnonymousUser) {
      navigate('/');
    }
  };

  const handleSaveAndEnd = async () => {
    try {
      // Save completed workout to Firebase
      if (user?.uid) {
        await WorkoutStorageService.saveCompletedWorkout(user.uid, activeWorkout);
      }

      dispatch(endWorkout());
      setShowEndWorkoutModal(false);
      // Navigate appropriately based on user type
      if (!isAnonymousUser) {
        navigate('/profile', { state: { showWorkoutComplete: true } });
      }
    } catch (error) {
      console.error('❌ Error saving workout:', error);
      // Show user-friendly error message
      alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');
      // Still end workout even if save fails
      dispatch(endWorkout());
      setShowEndWorkoutModal(false);
      // Navigate appropriately based on user type
      if (!isAnonymousUser) {
        navigate('/');
      }
    }
  };

  // Calculate accurate progress based on completed sets
  const calculateWorkoutProgress = () => {
    const totalSets = activeWorkout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    const completedSets = activeWorkout.exercises.reduce((total, ex) =>
      total + ex.sets.filter(set => set.completed).length, 0
    );

    const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    return { completedSets, totalSets, percentage };
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if disabled or user is typing in an input
      if (!preferences.keyboardShortcuts.enabled) {
        return;
      }

      // More comprehensive check for input elements
      const target = event.target as HTMLElement;
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true' ||
        target.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'enter':
          event.preventDefault();
          if (currentSet && !currentSet.completed) {
            const reps = currentSet.reps || 0;
            const weight = currentSet.weight || 0;
            handleCompleteSet(reps, weight);
          }
          break;
        case 'n':
          event.preventDefault();
          if (currentExercise && activeWorkout.currentSetIndex < currentExercise.sets.length - 1) {
            handleJumpToSet(activeWorkout.currentSetIndex + 1);
          }
          break;
        case 'p':
          event.preventDefault();
          if (activeWorkout.currentSetIndex > 0) {
            handleJumpToSet(activeWorkout.currentSetIndex - 1);
          }
          break;
        case 'r':
          event.preventDefault();
          if (restTimer.isActive) {
            dispatch(stopRestTimer());
          } else {
            dispatch(startRestTimer({ duration: currentExercise?.restTime || 120 }));
          }
          break;
        case 'u':
          event.preventDefault();
          if (currentSet && currentSet.completed) {
            handleUncompleteSet();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentSet, currentExercise, activeWorkout, restTimer, dispatch, handleCompleteSet, handleUncompleteSet, handleJumpToSet]);

  const progress = calculateWorkoutProgress();
  const exerciseGroups = getGroupedExercisesForDisplay(
    activeWorkout.exercises,
    activeWorkout.currentExerciseIndex,
  );
  const isSupersetView =
    !!currentExercise?.isSuperset &&
    !!currentExercise.supersetId &&
    supersetExercises.length > 1;

  return (
    <div className="min-h-full bg-surface p-4">
      <div className="mx-auto max-w-4xl">
        <WorkoutHeader
          name={activeWorkout.name}
          overallCompletedSets={progress.completedSets}
          overallTotalSets={progress.totalSets}
          overallPercentage={progress.percentage}
          currentExerciseNumber={activeWorkout.currentExerciseIndex + 1}
          totalExercises={activeWorkout.exercises.length}
          currentExerciseCompletedSets={
            currentExercise?.sets.filter((set) => set.completed).length || 0
          }
          currentExerciseTotalSets={currentExercise?.sets.length || 0}
          onEndWorkout={handleEndWorkoutClick}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Exercise Panel */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {isSupersetView ? (
              <SupersetExerciseCard
                exercises={supersetExercises}
                currentSupersetIndex={currentSupersetIndex}
                currentSetIndex={activeWorkout.currentSetIndex}
                onCompleteSet={handleCompleteSet}
                onUncompleteSet={handleUncompleteSet}
                onJumpToSet={handleJumpToSet}
                onAddSet={handleAddSet}
                previousPerformances={previousPerformances}
              />
            ) : (
              <ActiveExerciseCard
                exercise={currentExercise}
                exerciseIndex={activeWorkout.currentExerciseIndex}
                totalExercises={activeWorkout.exercises.length}
                currentSetIndex={activeWorkout.currentSetIndex}
                currentSet={currentSet}
                previousPerformance={
                  currentExercise?.exercise.id
                    ? previousPerformances[currentExercise.exercise.id] || null
                    : null
                }
                isLoadingPrevious={isLoadingPrevious}
                isAnonymousUser={isAnonymousUser}
                restActive={restTimer.isActive}
                restTimeRemaining={restTimer.timeRemaining}
                showProgressionSlider={
                  !!progressionHook.recommendation && !progressionHook.isLoading
                }
                recommendation={progressionHook.recommendation}
                recommendedWeight={
                  progressionHook.acceptedRecommendation
                    ? progressionHook.recommendation?.recommendedWeight
                    : undefined
                }
                recommendedReps={
                  progressionHook.acceptedRecommendation
                    ? progressionHook.recommendation?.recommendedReps
                    : undefined
                }
                onAcceptWeight={(weight) => {
                  progressionHook.modifyRecommendation(
                    weight,
                    progressionHook.recommendation?.recommendedReps,
                  );
                  progressionHook.acceptRecommendation();
                }}
                onUpdateTitle={(title) =>
                  dispatch(
                    updateExerciseNotesAndTitle({
                      exerciseId: currentExercise.id,
                      customTitle: title,
                    }),
                  )
                }
                onUpdateNotes={(notes) =>
                  dispatch(
                    updateExerciseNotesAndTitle({
                      exerciseId: currentExercise.id,
                      notes,
                    }),
                  )
                }
                onEditSets={() => handleEditExercise(currentExercise)}
                onPreviousExercise={() => dispatch(previousExercise())}
                onNextExercise={() => dispatch(nextExercise())}
                onCompleteSet={handleCompleteSet}
                onUncompleteSet={handleUncompleteSet}
                onJumpToSet={handleJumpToSet}
                onAddSet={handleAddSet}
              />
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Rest Timer - Desktop only */}
            <RestTimer className="hidden lg:block" />

            {/* Exercise List */}
            <ExerciseListPanel
              groups={exerciseGroups}
              exercises={activeWorkout.exercises}
              onJumpToExercise={handleJumpToExercise}
              onEditExercise={handleEditExercise}
            />
          </div>
        </div>
      </div>

      {/* Exercise Edit Modal */}
      <ExerciseEditModal
        isOpen={showEditModal}
        exercise={editingExercise}
        onClose={handleCloseEditModal}
        onSave={handleSaveExercise}
      />

      {/* Workout Completion Modal */}
      <WorkoutCompletionModal
        isOpen={showCompletionModal}
        onClose={() => dispatch(setShowCompletionModal(false))}
      />

      {/* End Workout Modal */}
      <EndWorkoutModal
        isOpen={showEndWorkoutModal}
        activeWorkout={activeWorkout}
        onClose={() => setShowEndWorkoutModal(false)}
        onEndWithoutSaving={handleEndWithoutSaving}
        onSaveAndEnd={handleSaveAndEnd}
        isAnonymousUser={isAnonymousUser}
        isSharedWorkout={isViewingSharedWorkout}
      />

      {/* Deload Suggestion Slide-out - Only for authenticated users */}
      {!isAnonymousUser && progressionHook.showDeloadSuggestion && progressionHook.recommendation && (
        <DeloadSuggestion
          weeksSinceLastWorkout={Math.ceil((progressionHook.recommendation.daysSinceLastWorkout || 14) / 7)}
          suggestedDeloadPercentage={15}
          previousWeight={progressionHook.recommendation.previousWeight || 0}
          suggestedWeight={progressionHook.recommendation.recommendedWeight || 0}
          exerciseName={currentExercise?.exercise.name || ''}
          onAccept={progressionHook.applyDeload}
          onDecline={progressionHook.declineDeload}
          onClose={() => setShowDeloadModal(false)}
        />
      )}

      {/* Fatigue Check Slide-out - Only for authenticated users */}
      {!isAnonymousUser && showFatigueModal && fatigueSetInfo && (
        <FatigueCheck
          exerciseName={currentExercise?.exercise.name || ''}
          currentWeight={fatigueSetInfo.weight}
          setNumber={fatigueSetInfo.setNumber}
          onFatigued={() => {
            progressionHook.applyFatigue();
            setShowFatigueModal(false);
            // Record fatigue in Redux
            dispatch(recordProgressionOutcome({
              exerciseId: currentExercise?.exercise.id || '',
              outcome: 'failed',
              failureReason: 'fatigue'
            }));
          }}
          onNotFatigued={() => {
            progressionHook.continuePlan();
            setShowFatigueModal(false);
          }}
          onClose={() => setShowFatigueModal(false)}
        />
      )}
    </div>
  );
}
