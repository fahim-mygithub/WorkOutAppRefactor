import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { useWakeLock } from '../hooks/useWakeLock';
import { SharedWorkoutLoader } from '../components/SharedWorkoutLoader';
import { SharedWorkoutStartPage } from '../components/SharedWorkoutStartPage';
import { incrementWorkoutUseCount } from '../store/slices/sharedWorkoutSlice';
import { loadWorkoutContext } from '../store/slices/exerciseHistorySlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { ScheduleService } from '../services/scheduleService';
import { dayOverrideSet, retestAdvanced } from '../store/slices/scheduleSlice';
import type { WorkoutSummary } from '../types/exerciseHistory';
import type { ActiveWorkout } from '../types/exercise';
import type { ActivePlanContext } from '../hooks/useStartPlannedDay';
import {
  startWorkout,
  endWorkout,
  nextExercise,
  previousExercise,
  completeSet,
  uncompleteSet,
  jumpToSet,
  startRestTimer,
  stopRestTimer,
  nextSupersetExercise,
  completeSuperset,
  updateExercise,
  setShowCompletionModal
} from '../store/slices/workoutSlice';
import { ExerciseEditModal } from '../components/ExerciseEditModal';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { WorkoutTopBar } from '../components/workout/player/WorkoutTopBar';
import { ExerciseDeck } from '../components/workout/player/ExerciseDeck';
import { ExercisePlayCard } from '../components/workout/player/ExercisePlayCard';
import { RestTimerBar } from '../components/workout/player/RestTimerBar';
import { WelcomeBackSuggestion } from '../components/workout/player/WelcomeBackSuggestion';
import { useProgressionRecommendation } from '../hooks/useProgressionRecommendation';
import { inSessionSuggestion } from '../lib/progression/inSession';
import { welcomeBackSuggestion } from '../lib/progression/welcomeBack';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Exercise, WorkoutExercise, WorkoutSet } from '../types/exercise';
import type { InSessionDecision } from '../types/progression';

/** Build a calendar-shaped WorkoutSummary from a finished ActiveWorkout, for the
 *  local performed store (so completed Charlie days render in the loginless demo). */
function buildLocalSummary(workout: ActiveWorkout, userId: string): WorkoutSummary {
  const start = new Date(workout.startTime);
  const end = new Date();
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const exercisesSummary = workout.exercises.map((we) => {
    const done = we.sets.filter((s) => s.completed);
    const sets = done.length;
    const reps = done.reduce((n, s) => n + (s.reps || 0), 0);
    const volume = done.reduce((n, s) => n + (s.weight || 0) * (s.reps || 0), 0);
    totalSets += sets;
    totalReps += reps;
    totalVolume += volume;
    return { exerciseId: we.exercise.id, exerciseName: we.exercise.name, sets, reps, volume };
  });
  return {
    id: `local-${workout.id}`,
    userId,
    name: workout.name,
    workoutId: workout.id,
    templateId: 'charlie-split',
    startTime: start,
    endTime: end,
    duration: workout.duration || Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
    totalExercises: workout.exercises.length,
    totalSets,
    totalReps,
    totalVolume,
    exercisesSummary,
  };
}

export default function WorkoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { activeWorkout, restTimer, showCompletionModal } = useAppSelector((state) => state.workout);
  const { preferences } = useAppSelector((state) => state.user);
  const { user } = useAuth(); // Get Firebase user from auth context
  const { previousPerformances } = useAppSelector((state) => state.exerciseHistory);

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
  const [showEndWorkoutModal, setShowEndWorkoutModal] = useState(false);
  // Live in-session cue after a logged set (reduce/repeat only).
  const [suggestion, setSuggestion] = useState<InSessionDecision | null>(null);
  // Applied "lighter" loads keyed by exercise IDENTITY (catalog exercise id). A
  // chosen reduction (welcome-back OR in-session) pre-fills the working sets via
  // recommendedWeight; keying by id — not the current index — means it survives
  // the index cycling within a superset (A→B→A→B). Cleared when the page remounts
  // for a new workout.
  const [appliedWeights, setAppliedWeights] = useState<Record<string, number>>({});
  // Exercises whose opt-in welcome-back prompt the lifter has answered (applied
  // the lighter load OR kept the full load). Keyed by exercise identity so the
  // prompt doesn't re-pop on superset rounds or back-nav.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(() => new Set());

  // Track if workout context has been loaded to prevent duplicate calls
  const contextLoadedRef = useRef<string | null>(null);

  // A new exercise starts with no carried-over transient cue. (The applied load
  // and the answered-prompt set are keyed by exercise identity, not index, so
  // they deliberately persist across superset rounds and back-nav.)
  useEffect(() => {
    setSuggestion(null);
  }, [activeWorkout?.currentExerciseIndex]);

  // Moving to another set dismisses the transient cue (the applied load persists
  // for the rest of the exercise via the recommendedWeight autofill path).
  useEffect(() => {
    setSuggestion(null);
  }, [activeWorkout?.currentSetIndex]);

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

  // Initialize progression recommendation hook for current exercise (always call this hook)
  const progressionHook = useProgressionRecommendation({
    // The hook internally guards `if (!exercise)`, so an undefined exercise is
    // tolerated; the cast satisfies the (too-narrow) param type without changing behavior.
    exercise: currentExercise?.exercise as Exercise,
    currentSets: currentExercise?.sets.length || 0,
    userId: user?.uid,
    configuredReps: currentExercise?.sets?.[0]?.reps, // Pass configured reps from first set
    configuredWeight: currentExercise?.sets?.[0]?.weight // Prescribed load (e.g. "12 × 60") seeds the first-session weight
  });

  const handleEditExercise = useCallback((exercise: WorkoutExercise) => {
    setEditingExercise(exercise);
    setShowEditModal(true);
  }, []);

  // Persist an applied load / an answered welcome-back prompt by exercise
  // identity (see the appliedWeights / answeredIds state notes).
  const applyLoadToExercise = (exerciseId: string, weight: number) =>
    setAppliedWeights((prev) => ({ ...prev, [exerciseId]: weight }));
  const markWelcomeBackAnswered = (exerciseId: string) =>
    setAnsweredIds((prev) => (prev.has(exerciseId) ? prev : new Set(prev).add(exerciseId)));

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

  // Names of the OTHER movements paired with the current one (superset context).
  const supersetPartners = currentExercise?.isSuperset && currentExercise.supersetId
    ? activeWorkout.exercises
        .filter((ex) => ex.supersetId === currentExercise.supersetId && ex.id !== currentExercise.id)
        .map((ex) => ex.customTitle || ex.exercise.name)
    : [];

  const handleCompleteSet = (reps: number, weight: number, rir?: number) => {
    const setIndex = activeWorkout.currentSetIndex;
    const totalSets = currentExercise.sets.length;
    // Snapshot the prescription before the set is mutated, for the live decision.
    const loggedSet = currentSet;

    dispatch(completeSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex,
      setData: { reps, weight },
      rir
    }));

    // Per-set, in-session cue from the load ACTUALLY lifted — pure and account-
    // free (no uid needed), so it works for anonymous/demo users too. Replaces the
    // old cumulative "consecutive failed sets" threshold (which had a counter bug):
    // each set now gets its own decision. inSessionSuggestion returns null for
    // continue/end, so those stay silent and keep the no-scroll player calm.
    if (loggedSet) {
      setSuggestion(inSessionSuggestion(loggedSet, { reps, weight, rir }, setIndex, totalSets));
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

  // Apply the suggested cut to the remaining sets: route it through the same
  // recommendedWeight autofill SetInput already honors, so each upcoming set
  // pre-fills with the reduced load. Dismiss the cue either way.
  const handleApplySuggestion = (weight: number) => {
    applyLoadToExercise(currentExercise.exercise.id, weight);
    setSuggestion(null);
  };

  const handleKeepSuggestion = () => {
    setSuggestion(null);
  };

  const handleJumpToSet = (setIndex: number) => {
    dispatch(jumpToSet({
      exerciseIndex: activeWorkout.currentExerciseIndex,
      setIndex
    }));
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
    // A Charlie-Split planned day stashes context at launch; if present we flip
    // the calendar day to completed and write a local summary (so the loginless
    // demo renders it despite stubbed Firestore writes), then route to Home.
    let planCtx: ActivePlanContext | null = null;
    try {
      const raw = sessionStorage.getItem('activePlanContext');
      if (raw) planCtx = JSON.parse(raw) as ActivePlanContext;
    } catch {
      planCtx = null;
    }

    const completePlanDay = () => {
      if (!planCtx) return;
      const idKey = user?.uid ?? 'anon';
      const summary = buildLocalSummary(activeWorkout, idKey);
      ScheduleService.appendPerformedLocal(idKey, summary);
      dispatch(
        dayOverrideSet({
          dateKey: planCtx.dateKey,
          status: 'completed',
          dayType: planCtx.dayType,
          cycleOrdinal: planCtx.cycleOrdinal,
          completedSummaryId: summary.id,
          updatedAt: new Date().toISOString(),
        }),
      );
      // A completed retest advances the rotating-retest pointer to the next lift.
      if (planCtx.isRetest) {
        dispatch(retestAdvanced({ testedAtKey: planCtx.dateKey }));
      }
      try {
        sessionStorage.removeItem('activePlanContext');
      } catch {
        /* ignore */
      }
    };

    try {
      // Save completed workout to Firebase
      if (user?.uid) {
        await WorkoutStorageService.saveCompletedWorkout(user.uid, activeWorkout);
      }

      completePlanDay();
      dispatch(endWorkout());
      setShowEndWorkoutModal(false);
      // Plan days route home so the calendar flip is visible; others keep prior behavior.
      if (planCtx) {
        navigate('/');
      } else if (!isAnonymousUser) {
        navigate('/profile', { state: { showWorkoutComplete: true } });
      }
    } catch (error) {
      console.error('❌ Error saving workout:', error);
      // Show user-friendly error message
      alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');
      completePlanDay();
      // Still end workout even if save fails
      dispatch(endWorkout());
      setShowEndWorkoutModal(false);
      // Navigate appropriately based on user type
      if (planCtx || !isAnonymousUser) {
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

  // Group the workout into "cards" (a superset is one card) so the deck can show
  // how many remain and so within-superset moves flip instead of slide.
  const groupKeys: string[] = [];
  {
    const seen = new Set<string>();
    activeWorkout.exercises.forEach((ex, i) => {
      const k = ex.isSuperset && ex.supersetId ? `ss:${ex.supersetId}` : `ex:${i}`;
      if (!seen.has(k)) {
        seen.add(k);
        groupKeys.push(k);
      }
    });
  }
  const currentSupersetId = currentExercise.isSuperset ? currentExercise.supersetId : undefined;
  const curGroupKey = currentSupersetId
    ? `ss:${currentSupersetId}`
    : `ex:${activeWorkout.currentExerciseIndex}`;
  const cardsLeft = Math.max(0, groupKeys.length - groupKeys.indexOf(curGroupKey) - 1);

  // Opt-in welcome-back gate (pure): null unless the CURRENT exercise's rec
  // signals a real layoff and the lifter hasn't already answered for it. The
  // exerciseId match also discards a stale rec held during an async reload, so
  // the sheet never flashes one exercise's numbers under another's name.
  const welcomeBack = welcomeBackSuggestion(
    progressionHook.recommendation,
    currentExercise.exercise.id,
    answeredIds,
  );

  return (
    <>
      {/* No-scroll player: slim top bar, swipeable exercise deck, rest-timer bar.
          Phone-first — capped to a phone-width column and centered on wider screens. */}
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-surface">
        <WorkoutTopBar
          name={activeWorkout.name}
          overallCompletedSets={progress.completedSets}
          overallTotalSets={progress.totalSets}
          overallPercentage={progress.percentage}
          currentExerciseNumber={activeWorkout.currentExerciseIndex + 1}
          totalExercises={activeWorkout.exercises.length}
          onEndWorkout={handleEndWorkoutClick}
        />

        <ExerciseDeck
          index={activeWorkout.currentExerciseIndex}
          canPrev={activeWorkout.currentExerciseIndex > 0}
          canNext={
            activeWorkout.currentExerciseIndex < activeWorkout.exercises.length - 1
          }
          onPrev={() => dispatch(previousExercise())}
          onNext={() => dispatch(nextExercise())}
          currentSupersetId={currentSupersetId}
          cardsLeft={cardsLeft}
        >
          <ExercisePlayCard
            exercise={currentExercise}
            currentSetIndex={activeWorkout.currentSetIndex}
            currentSet={currentSet}
            supersetPartners={supersetPartners}
            previousPerformance={
              currentExercise.exercise.id
                ? previousPerformances[currentExercise.exercise.id] || null
                : null
            }
            recommendedWeight={appliedWeights[currentExercise.exercise.id] ?? progressionHook.recommendation?.recommendedWeight}
            recommendedReps={progressionHook.recommendation?.recommendedReps}
            onEditSets={() => handleEditExercise(currentExercise)}
            onCompleteSet={handleCompleteSet}
            onUncompleteSet={handleUncompleteSet}
            onJumpToSet={handleJumpToSet}
            suggestion={suggestion}
            onApplySuggestion={handleApplySuggestion}
            onKeepSuggestion={handleKeepSuggestion}
          />
        </ExerciseDeck>

        <RestTimerBar />
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

      {/* Opt-in welcome-back after a real layoff — shows the CORRECT reduction and
          the REAL previous load, and never cuts the load on its own. Gated by the
          pure helper (data + per-exercise answered set), not auth. */}
      {welcomeBack && (
        <WelcomeBackSuggestion
          suggestion={welcomeBack.suggestion}
          previousWeight={welcomeBack.previousWeight}
          exerciseName={currentExercise.exercise.name}
          onApply={(weight) => {
            applyLoadToExercise(currentExercise.exercise.id, weight);
            markWelcomeBackAnswered(currentExercise.exercise.id);
          }}
          onDismiss={() => markWelcomeBackAnswered(currentExercise.exercise.id)}
        />
      )}
    </>
  );
}
