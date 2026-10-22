import type { Store } from '@reduxjs/toolkit';
import type { RootState } from './index';
import {
  saveWorkoutSnapshot,
  clearWorkoutSnapshot,
  getStoredPlanContext,
  type StorageLike,
} from '../lib/workoutSession';

export interface PersistWorkoutOptions {
  storage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
  debounceMs?: number;
  windowObj?: Window | null;
  documentObj?: Document | null;
}

export function initWorkoutPersistence(
  store: Store<RootState>,
  options: PersistWorkoutOptions = {},
) {
  const storage = options.storage !== undefined
    ? options.storage
    : (typeof window !== 'undefined' ? window.localStorage : null);
  const sessionStore = options.sessionStorage !== undefined
    ? options.sessionStorage
    : (typeof window !== 'undefined' ? window.sessionStorage : null);
  const debounceMs = options.debounceMs ?? 300;
  const win = options.windowObj !== undefined
    ? options.windowObj
    : (typeof window !== 'undefined' ? window : null);
  const doc = options.documentObj !== undefined
    ? options.documentObj
    : (typeof document !== 'undefined' ? document : null);

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let prevActiveWorkout = store.getState().workout.activeWorkout;
  let prevRestTimer = store.getState().workout.restTimer;

  const flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    const state = store.getState();
    const activeWorkout = state.workout.activeWorkout;
    const restTimer = state.workout.restTimer;
    if (activeWorkout && activeWorkout.exercises && activeWorkout.exercises.length > 0) {
      const planContext = getStoredPlanContext(storage, sessionStore);
      saveWorkoutSnapshot(
        {
          activeWorkout,
          restTimer,
          planContext,
          savedAt: new Date().toISOString(),
        },
        storage,
      );
    }
  };

  const scheduleSave = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      flush();
    }, debounceMs);
  };

  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    const activeWorkout = state.workout.activeWorkout;
    const restTimer = state.workout.restTimer;

    // Workout ended or discarded: clear snapshot and cancel pending timers
    if (!activeWorkout) {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (prevActiveWorkout !== null) {
        clearWorkoutSnapshot(storage);
      }
      prevActiveWorkout = null;
      prevRestTimer = restTimer;
      return;
    }

    // Check if activeWorkout or restTimer changed
    if (activeWorkout !== prevActiveWorkout || restTimer !== prevRestTimer) {
      prevActiveWorkout = activeWorkout;
      prevRestTimer = restTimer;
      scheduleSave();
    }
  });

  const onVisibilityChange = () => {
    if (doc?.visibilityState === 'hidden') {
      flush();
    }
  };

  const onPageHide = () => {
    flush();
  };

  if (doc) {
    doc.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (win) {
    win.addEventListener('pagehide', onPageHide);
  }

  return {
    flush,
    unsubscribe: () => {
      unsubscribe();
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (doc) {
        doc.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (win) {
        win.removeEventListener('pagehide', onPageHide);
      }
    },
  };
}
