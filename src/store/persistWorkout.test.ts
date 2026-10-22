import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import workoutReducer, {
  startWorkout,
  endWorkout,
  completeSet,
  startRestTimer,
} from './slices/workoutSlice';
import { initWorkoutPersistence } from './persistWorkout';
import {
  WORKOUT_SNAPSHOT_KEY,
  type StorageLike,
} from '../lib/workoutSession';
import type { WorkoutExercise } from '../types/exercise';

class MockStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const mockExercise: WorkoutExercise = {
  id: 'we-1',
  exercise: {
    id: 'pushup',
    name: 'Push Up',
    muscleGroup: 'Chest',
    muscleGroups: ['Chest'],
    equipment: 'Bodyweight',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: 'Push',
    grips: null,
    mechanic: 'Compound',
    searchKeywords: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  sets: [
    { id: 'set-1', reps: 10, completed: false },
    { id: 'set-2', reps: 10, completed: false },
  ],
};

function createTestStore() {
  return configureStore({
    reducer: {
      workout: workoutReducer,
    },
  });
}

describe('persistWorkout', () => {
  let storage: MockStorage;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new MockStorage();
    store = createTestStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces snapshot save on workout state changes (~300ms trailing)', () => {
    const { unsubscribe } = initWorkoutPersistence(store as any, {
      storage,
      debounceMs: 300,
    });

    store.dispatch(startWorkout({ name: 'Chest Day', exercises: [mockExercise] }));

    // Before debounce runs, storage should not have snapshot yet
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();

    // Advance 150ms - still pending
    vi.advanceTimersByTime(150);
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();

    // Another change: complete set resets trailing timer
    store.dispatch(completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 10, weight: 0 } }));
    vi.advanceTimersByTime(200);
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();

    // Advance remaining debounce time
    vi.advanceTimersByTime(100);
    const raw = storage.getItem(WORKOUT_SNAPSHOT_KEY);
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw!);
    expect(snapshot.activeWorkout.name).toBe('Chest Day');
    expect(snapshot.activeWorkout.exercises[0].sets[0].completed).toBe(true);

    unsubscribe();
  });

  it('flushes synchronously on visibilitychange (hidden)', () => {
    let visibilityState = 'visible';
    const fakeDoc = {
      get visibilityState() {
        return visibilityState;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    let visibilityListener: any = null;
    fakeDoc.addEventListener.mockImplementation((event: string, handler: any) => {
      if (event === 'visibilitychange') visibilityListener = handler;
    });

    const { unsubscribe } = initWorkoutPersistence(store as any, {
      storage,
      debounceMs: 300,
      documentObj: fakeDoc as any,
    });

    store.dispatch(startWorkout({ name: 'Chest Day', exercises: [mockExercise] }));
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();

    // Simulate tab hiding
    visibilityState = 'hidden';
    if (visibilityListener) visibilityListener();

    // Flushed synchronously without waiting for debounce timer!
    const raw = storage.getItem(WORKOUT_SNAPSHOT_KEY);
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw!);
    expect(snapshot.activeWorkout.name).toBe('Chest Day');

    unsubscribe();
  });

  it('flushes synchronously on pagehide', () => {
    let pageHideListener: any = null;
    const fakeWin = {
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'pagehide') pageHideListener = handler;
      }),
      removeEventListener: vi.fn(),
    };

    const { unsubscribe } = initWorkoutPersistence(store as any, {
      storage,
      debounceMs: 300,
      windowObj: fakeWin as any,
    });

    store.dispatch(startWorkout({ name: 'Chest Day', exercises: [mockExercise] }));
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();

    // Trigger pagehide
    if (pageHideListener) pageHideListener();

    // Flushed immediately
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).not.toBeNull();

    unsubscribe();
  });

  it('clears the snapshot when the workout ends', () => {
    const { unsubscribe } = initWorkoutPersistence(store as any, {
      storage,
      debounceMs: 300,
    });

    store.dispatch(startWorkout({ name: 'Chest Day', exercises: [mockExercise] }));
    vi.advanceTimersByTime(300);
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).not.toBeNull();

    store.dispatch(endWorkout());
    expect(storage.getItem(WORKOUT_SNAPSHOT_KEY)).toBeNull();

    unsubscribe();
  });
});
