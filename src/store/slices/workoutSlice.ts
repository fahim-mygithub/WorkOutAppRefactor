import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ActiveWorkout, RestTimer, WorkoutExercise, WorkoutSet } from '../../types/exercise';
import type { ExperienceLevel, ProgressionTracking } from '../../types/progression';
import { computeTargetEndTime } from '../../lib/restTimer';

export interface WorkoutState {
  activeWorkout: ActiveWorkout | null;
  restTimer: RestTimer;
  workoutHistory: string[];
  showCompletionModal: boolean;
  isLoading: boolean;
  error: string | null;
  // Progression related state
  experienceLevel: ExperienceLevel;
  progressionTracking: Record<string, ProgressionTracking>; // exerciseId -> tracking
}

const initialRestTimer: RestTimer = {
  isActive: false,
  timeRemaining: 0,
  duration: 120, // 2 minutes default
  targetEndTime: null,
};

const initialState: WorkoutState = {
  activeWorkout: null,
  restTimer: initialRestTimer,
  workoutHistory: [],
  showCompletionModal: false,
  isLoading: false,
  error: null,
  experienceLevel: 'standard',
  progressionTracking: {},
};

const workoutSlice = createSlice({
  name: 'workout',
  initialState,
  reducers: {
    startWorkout: (state, action: PayloadAction<{ name: string; exercises: WorkoutExercise[] }>) => {
      const { name, exercises } = action.payload;
      const firstExercise = exercises[0];
      state.activeWorkout = {
        id: `workout-${Date.now()}`,
        name,
        exercises,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        startTime: new Date().toISOString(),
        duration: 0,
        isActive: true,
        // Initialize superset tracking
        isInSuperset: firstExercise?.isSuperset || false,
        currentSupersetIndex: 0,
      };
    },

    endWorkout: (state) => {
      if (state.activeWorkout) {
        state.workoutHistory.unshift(state.activeWorkout.id);
        state.activeWorkout = null;
        state.restTimer = initialRestTimer;
      }
    },

    nextExercise: (state) => {
      if (state.activeWorkout && state.activeWorkout.currentExerciseIndex < state.activeWorkout.exercises.length - 1) {
        state.activeWorkout.currentExerciseIndex += 1;
        state.activeWorkout.currentSetIndex = 0;
      }
    },

    previousExercise: (state) => {
      if (state.activeWorkout && state.activeWorkout.currentExerciseIndex > 0) {
        state.activeWorkout.currentExerciseIndex -= 1;
        state.activeWorkout.currentSetIndex = 0;
      }
    },

    nextSet: (state) => {
      if (!state.activeWorkout) return;

      const currentExercise = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex];
      if (state.activeWorkout.currentSetIndex < currentExercise.sets.length - 1) {
        state.activeWorkout.currentSetIndex += 1;
      } else {
        // Move to next exercise if no more sets
        if (state.activeWorkout.currentExerciseIndex < state.activeWorkout.exercises.length - 1) {
          state.activeWorkout.currentExerciseIndex += 1;
          state.activeWorkout.currentSetIndex = 0;

          // Update superset status for new exercise
          const nextExercise = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex];
          state.activeWorkout.isInSuperset = nextExercise?.isSuperset || false;
          state.activeWorkout.currentSupersetIndex = 0;
        }
      }
    },

    previousSet: (state) => {
      if (state.activeWorkout && state.activeWorkout.currentSetIndex > 0) {
        state.activeWorkout.currentSetIndex -= 1;
      }
    },

    jumpToSet: (state, action: PayloadAction<{ exerciseIndex: number; setIndex: number }>) => {
      if (!state.activeWorkout) return;

      const { exerciseIndex, setIndex } = action.payload;
      if (exerciseIndex >= 0 && exerciseIndex < state.activeWorkout.exercises.length) {
        const exercise = state.activeWorkout.exercises[exerciseIndex];
        if (setIndex >= 0 && setIndex < exercise.sets.length) {
          state.activeWorkout.currentExerciseIndex = exerciseIndex;
          state.activeWorkout.currentSetIndex = setIndex;

          // Update superset status for new exercise
          const newExercise = state.activeWorkout.exercises[exerciseIndex];
          state.activeWorkout.isInSuperset = newExercise?.isSuperset || false;
          state.activeWorkout.currentSupersetIndex = 0;
        }
      }
    },

    completeSet: (state, action: PayloadAction<{ exerciseIndex: number; setIndex: number; setData: Partial<WorkoutSet>; rir?: number }>) => {
      if (!state.activeWorkout) return;

      const { exerciseIndex, setIndex, setData, rir } = action.payload;
      const exercise = state.activeWorkout.exercises[exerciseIndex];
      if (exercise && exercise.sets[setIndex]) {
        const set = exercise.sets[setIndex];
        // `failed` is a real, written field: did the LOGGED reps fall below the
        // prescribed range floor (repMin, or the single configured reps)? Read the
        // prescription BEFORE the assign overwrites `reps` with the logged value.
        const prescribedFloor = set.repMin ?? set.reps;
        const loggedReps = setData.reps ?? set.reps;
        Object.assign(set, setData, {
          completed: true,
          failed: loggedReps < prescribedFloor,
        });
        // Optional effort tap; only written when the lifter actually logged it.
        if (rir !== undefined) set.rir = rir;
        // No additional logic here - the UI drives progression via the per-set
        // in-session decision and the nextSupersetExercise action.
      }
    },

    uncompleteSet: (state, action: PayloadAction<{ exerciseIndex: number; setIndex: number }>) => {
      if (!state.activeWorkout) return;
      
      const { exerciseIndex, setIndex } = action.payload;
      const exercise = state.activeWorkout.exercises[exerciseIndex];
      if (exercise && exercise.sets[setIndex]) {
        exercise.sets[setIndex].completed = false;
      }
    },

    addSet: (state, action: PayloadAction<{ exerciseIndex: number; setData?: Partial<WorkoutSet> }>) => {
      if (!state.activeWorkout) return;

      const { exerciseIndex, setData = {} } = action.payload;
      const exercise = state.activeWorkout.exercises[exerciseIndex];
      if (exercise) {
        // Get default reps from the last set if it exists
        const lastSet = exercise.sets[exercise.sets.length - 1];
        const defaultReps = lastSet?.reps || 0;
        const defaultWeight = lastSet?.weight || 0;

        const newSet: WorkoutSet = {
          id: `set-${Date.now()}`,
          reps: defaultReps,
          weight: defaultWeight,
          completed: false,
          ...setData,
        };
        exercise.sets.push(newSet);
      }
    },

    // Starts (or resumes) the countdown. We anchor an absolute `targetEndTime`
    // (epoch ms) instead of decrementing a counter, so the remaining time can be
    // re-derived from the clock after the tab is backgrounded. `duration` is
    // both the initial length and the canonical length used for the progress
    // bar; on resume the caller passes the remaining-on-pause seconds.
    startRestTimer: (state, action: PayloadAction<{ duration?: number }>) => {
      const duration = action.payload.duration ?? 120;
      state.restTimer = {
        isActive: true,
        timeRemaining: duration,
        duration,
        targetEndTime: computeTargetEndTime(duration, Date.now()),
      };
    },

    // Tick/resume sync. The component derives the remaining seconds from
    // `targetEndTime` against the current clock (each second and on
    // visibilitychange) and dispatches the result here. Reaching 0 ends the
    // countdown and clears the anchor.
    updateRestTimer: (state, action: PayloadAction<number>) => {
      if (state.restTimer.isActive) {
        state.restTimer.timeRemaining = Math.max(0, action.payload);
        if (state.restTimer.timeRemaining === 0) {
          state.restTimer.isActive = false;
          state.restTimer.targetEndTime = null;
        }
      }
    },

    // Pause: freeze on the remaining seconds and drop the clock anchor so the
    // derived countdown stops advancing. Resuming re-dispatches startRestTimer
    // with this remaining value, re-anchoring a fresh targetEndTime.
    pauseRestTimer: (state, action: PayloadAction<number>) => {
      if (state.restTimer.isActive) {
        state.restTimer.isActive = false;
        state.restTimer.timeRemaining = Math.max(0, action.payload);
        state.restTimer.targetEndTime = null;
      }
    },

    stopRestTimer: (state) => {
      state.restTimer.isActive = false;
      state.restTimer.timeRemaining = 0;
      state.restTimer.targetEndTime = null;
    },

    // New action to advance to next superset round after rest
    advanceToNextSupersetRound: (state) => {
      if (!state.activeWorkout) return;

      const currentExercise = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex];

      // Check if current exercise is part of a superset
      if (!currentExercise.isSuperset || !currentExercise.supersetId) return;

      // Find all exercises in this superset
      const allSupersetExercises = state.activeWorkout.exercises.filter(ex =>
        ex.supersetId === currentExercise.supersetId
      );

      if (allSupersetExercises.length > 1) {
        const isLastSet = state.activeWorkout.currentSetIndex >= currentExercise.sets.length - 1;

        if (!isLastSet) {
          // Move to next set and reset to first exercise in superset
          state.activeWorkout.currentSetIndex += 1;
          const firstExercise = allSupersetExercises[0];
          const firstExerciseIndex = state.activeWorkout.exercises.findIndex(ex => ex.id === firstExercise.id);
          if (firstExerciseIndex !== -1) {
            state.activeWorkout.currentExerciseIndex = firstExerciseIndex;
            state.activeWorkout.currentSupersetIndex = 0;
            state.activeWorkout.isInSuperset = true;
          }
        }
      }
    },

    updateWorkoutDuration: (state, action: PayloadAction<number>) => {
      if (state.activeWorkout) {
        state.activeWorkout.duration = action.payload;
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },

    // Superset-specific actions
    nextSupersetExercise: (state) => {
      if (!state.activeWorkout) return;

      const currentExercise = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex];

      // Check if current exercise is part of a superset
      if (!currentExercise.isSuperset || !currentExercise.supersetId) return;

      // Find all exercises in this superset
      const allSupersetExercises = state.activeWorkout.exercises.filter(ex =>
        ex.supersetId === currentExercise.supersetId
      );

      if (allSupersetExercises.length > 1) {
        const currentIndexInSuperset = allSupersetExercises.findIndex(ex => ex.id === currentExercise.id);
        const nextIndexInSuperset = currentIndexInSuperset + 1;

        if (nextIndexInSuperset < allSupersetExercises.length) {
          // Move to next exercise in superset
          const nextExercise = allSupersetExercises[nextIndexInSuperset];
          const nextExerciseIndex = state.activeWorkout.exercises.findIndex(ex => ex.id === nextExercise.id);
          if (nextExerciseIndex !== -1) {
            state.activeWorkout.currentExerciseIndex = nextExerciseIndex;
            state.activeWorkout.currentSupersetIndex = nextIndexInSuperset;
            state.activeWorkout.isInSuperset = true;
          }
        }
        // No automatic set advancement here - let rest timer handle progression to next set
      }
    },

    completeSuperset: (state) => {
      if (!state.activeWorkout) return;

      const currentExercise = state.activeWorkout.exercises[state.activeWorkout.currentExerciseIndex];

      if (!currentExercise.isSuperset || !currentExercise.supersetId) return;

      // Find all exercises in this superset
      const allSupersetExercises = state.activeWorkout.exercises.filter(ex =>
        ex.supersetId === currentExercise.supersetId
      );

      if (allSupersetExercises.length > 0) {
        // Find the last exercise in the superset and move to the next one
        const lastSupersetExercise = allSupersetExercises[allSupersetExercises.length - 1];
        const lastSupersetIndex = state.activeWorkout.exercises.findIndex(ex => ex.id === lastSupersetExercise.id);
        const nextExerciseIndex = lastSupersetIndex + 1;

        if (nextExerciseIndex < state.activeWorkout.exercises.length) {
          state.activeWorkout.currentExerciseIndex = nextExerciseIndex;
          state.activeWorkout.currentSetIndex = 0;
          state.activeWorkout.currentSupersetIndex = 0;

          // Check if next exercise is also a superset
          const nextExercise = state.activeWorkout.exercises[nextExerciseIndex];
          state.activeWorkout.isInSuperset = nextExercise?.isSuperset || false;
        } else {
          // No more exercises, end workout
          state.activeWorkout.isInSuperset = false;
        }
      }
    },

    updateExercise: (state, action: PayloadAction<{ exerciseId: string; sets: WorkoutSet[]; restTime: number }>) => {
      if (!state.activeWorkout) return;

      const { exerciseId, sets, restTime } = action.payload;
      const exerciseIndex = state.activeWorkout.exercises.findIndex(ex => ex.id === exerciseId);

      if (exerciseIndex !== -1) {
        state.activeWorkout.exercises[exerciseIndex].sets = sets;
        state.activeWorkout.exercises[exerciseIndex].restTime = restTime;
      }
    },

    updateExerciseNotesAndTitle: (state, action: PayloadAction<{ exerciseId: string; notes?: string; customTitle?: string }>) => {
      if (!state.activeWorkout) return;

      const { exerciseId, notes, customTitle } = action.payload;
      const exerciseIndex = state.activeWorkout.exercises.findIndex(ex => ex.id === exerciseId);

      if (exerciseIndex !== -1) {
        if (notes !== undefined) {
          state.activeWorkout.exercises[exerciseIndex].notes = notes;
        }
        if (customTitle !== undefined) {
          state.activeWorkout.exercises[exerciseIndex].customTitle = customTitle;
        }
      }
    },

    setShowCompletionModal: (state, action: PayloadAction<boolean>) => {
      state.showCompletionModal = action.payload;
    },

    checkWorkoutCompletion: (state) => {
      if (!state.activeWorkout) return;

      const totalSets = state.activeWorkout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
      const completedSets = state.activeWorkout.exercises.reduce((total, ex) =>
        total + ex.sets.filter(set => set.completed).length, 0
      );

      if (totalSets > 0 && completedSets === totalSets) {
        state.showCompletionModal = true;
      }
    },

    // Progression related actions
    setExperienceLevel: (state, action: PayloadAction<ExperienceLevel>) => {
      state.experienceLevel = action.payload;
    },

    setProgressionTracking: (state, action: PayloadAction<{ exerciseId: string; tracking: ProgressionTracking }>) => {
      const { exerciseId, tracking } = action.payload;
      state.progressionTracking[exerciseId] = tracking;
    },

    updateProgressionTracking: (state, action: PayloadAction<{ exerciseId: string; updates: Partial<ProgressionTracking> }>) => {
      const { exerciseId, updates } = action.payload;
      if (state.progressionTracking[exerciseId]) {
        state.progressionTracking[exerciseId] = {
          ...state.progressionTracking[exerciseId],
          ...updates,
        };
      }
    },

    clearProgressionTracking: (state) => {
      state.progressionTracking = {};
    },

    recordProgressionOutcome: (state, action: PayloadAction<{
      exerciseId: string;
      outcome: 'exceeded' | 'met' | 'failed';
      failureReason?: 'fatigue' | 'form' | 'weight-too-heavy' | 'other';
    }>) => {
      const { exerciseId, outcome, failureReason } = action.payload;
      if (state.progressionTracking[exerciseId]) {
        state.progressionTracking[exerciseId].outcomeRating = outcome;
        if (failureReason) {
          state.progressionTracking[exerciseId].failureReason = failureReason;
        }
      }
    },
  },
});

export const {
  startWorkout,
  endWorkout,
  nextExercise,
  previousExercise,
  nextSet,
  previousSet,
  jumpToSet,
  completeSet,
  uncompleteSet,
  addSet,
  startRestTimer,
  updateRestTimer,
  pauseRestTimer,
  stopRestTimer,
  advanceToNextSupersetRound,
  updateWorkoutDuration,
  setLoading,
  setError,
  clearError,
  nextSupersetExercise,
  completeSuperset,
  updateExercise,
  updateExerciseNotesAndTitle,
  setShowCompletionModal,
  checkWorkoutCompletion,
  // Progression actions
  setExperienceLevel,
  setProgressionTracking,
  updateProgressionTracking,
  clearProgressionTracking,
  recordProgressionOutcome,
} = workoutSlice.actions;

export default workoutSlice.reducer;