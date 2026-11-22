import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import userReducer, { resetUser, setProfile } from './userSlice';
import type { StorageLike } from '../../lib/workoutSession';
import strengthMarkersReducer, {
  aiReviewsApplied,
  aiReviewsCleared,
  initStrengthMarkersPersistence,
  loadStrengthMarkers,
  statedMaxCleared,
  statedMaxSet,
  strengthMarkersStorageKey,
} from './strengthMarkersSlice';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const profile = (uid: string) => ({
  uid,
  email: `${uid}@example.com`,
  displayName: uid,
  createdAt: '',
  lastActiveAt: '',
});

function boot(storage: StorageLike | null, uid?: string) {
  const store = configureStore({
    reducer: {
      user: userReducer,
      strengthMarkers: strengthMarkersReducer,
    },
  });
  initStrengthMarkersPersistence(store, storage);
  if (uid) store.dispatch(setProfile(profile(uid)));
  return store;
}

describe('strengthMarkersSlice', () => {
  it('sets, updates, and clears a stated max and persists across reloads', () => {
    const storage = memoryStorage();
    const a = boot(storage, 'u1');

    a.dispatch(
      statedMaxSet({
        exerciseKey: 'bench-press',
        exerciseName: 'Barbell Bench Press',
        weight: 265,
        unit: 'lbs',
      }),
    );

    expect(a.getState().strengthMarkers.statedMaxes['bench-press']).toMatchObject({
      exerciseKey: 'bench-press',
      exerciseName: 'Barbell Bench Press',
      weight: 265,
      unit: 'lbs',
    });

    // Reload for same user
    const b = boot(storage, 'u1');
    expect(b.getState().strengthMarkers.statedMaxes['bench-press']?.weight).toBe(265);

    // Clear removes it from state and storage when empty
    b.dispatch(statedMaxCleared('bench-press'));
    expect(b.getState().strengthMarkers.statedMaxes).toEqual({});
    expect(storage.data.has(strengthMarkersStorageKey('u1'))).toBe(false);
  });

  it('ignores non-positive or non-finite stated maxes', () => {
    const storage = memoryStorage();
    const store = boot(storage, 'u1');

    store.dispatch(
      statedMaxSet({
        exerciseKey: 'bench-press',
        exerciseName: 'Barbell Bench Press',
        weight: 0,
        unit: 'lbs',
      }),
    );
    store.dispatch(
      statedMaxSet({
        exerciseKey: 'squat',
        exerciseName: 'Back Squat',
        weight: -100,
        unit: 'lbs',
      }),
    );
    store.dispatch(
      statedMaxSet({
        exerciseKey: 'deadlift',
        exerciseName: 'Deadlift',
        weight: Number.NaN,
        unit: 'lbs',
      }),
    );

    expect(store.getState().strengthMarkers.statedMaxes).toEqual({});
  });

  it('isolates persisted markers per user and handles sign-out safely', () => {
    const storage = memoryStorage();
    const store = boot(storage, 'u1');
    store.dispatch(
      statedMaxSet({
        exerciseKey: 'bench-press',
        exerciseName: 'Barbell Bench Press',
        weight: 265,
        unit: 'lbs',
      }),
    );

    store.dispatch(resetUser());
    expect(store.getState().strengthMarkers.statedMaxes).toEqual({});

    store.dispatch(setProfile(profile('u2')));
    expect(store.getState().strengthMarkers.statedMaxes).toEqual({});
    store.dispatch(
      statedMaxSet({
        exerciseKey: 'bench-press',
        exerciseName: 'Barbell Bench Press',
        weight: 185,
        unit: 'lbs',
      }),
    );

    expect(boot(storage, 'u1').getState().strengthMarkers.statedMaxes['bench-press']?.weight).toBe(265);
    expect(boot(storage, 'u2').getState().strengthMarkers.statedMaxes['bench-press']?.weight).toBe(185);
  });

  it('stores and clears AI reviews', () => {
    const storage = memoryStorage();
    const store = boot(storage, 'u1');
    store.dispatch(
      aiReviewsApplied({
        reviewedAt: '2026-11-22T00:00:00Z',
        reviews: {
          'bench-press': {
            exerciseKey: 'bench-press',
            e1RM: 240,
            note: 'Steady progress across recent sessions.',
            reviewedAt: '2026-11-22T00:00:00Z',
            formulaE1RM: 234,
          },
        },
      }),
    );

    const reloaded = boot(storage, 'u1');
    expect(reloaded.getState().strengthMarkers.aiReviews['bench-press']?.e1RM).toBe(240);
    expect(reloaded.getState().strengthMarkers.lastReviewedAt).toBe('2026-11-22T00:00:00Z');

    reloaded.dispatch(aiReviewsCleared());
    expect(reloaded.getState().strengthMarkers.aiReviews).toEqual({});
    expect(reloaded.getState().strengthMarkers.lastReviewedAt).toBeNull();
  });

  it('falls back safely on corrupt or throwing storage', () => {
    const storage = memoryStorage();
    storage.setItem(strengthMarkersStorageKey('u1'), '{bad json');
    expect(loadStrengthMarkers('u1', storage)).toBeNull();

    storage.setItem(
      strengthMarkersStorageKey('u1'),
      JSON.stringify({
        schemaVersion: 1,
        statedMaxes: {
          good: { exerciseName: 'Squat', weight: 315, unit: 'lbs', updatedAt: '' },
          bad: { exerciseName: 'Curl', weight: -5, unit: 'lbs' },
        },
        aiReviews: {
          badReview: { e1RM: 'nope' },
        },
      }),
    );
    expect(loadStrengthMarkers('u1', storage)).toEqual({
      statedMaxes: {
        good: { exerciseKey: 'good', exerciseName: 'Squat', weight: 315, unit: 'lbs', updatedAt: '' },
      },
      aiReviews: {},
      lastReviewedAt: null,
    });

    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = boot(throwing, 'u1');
    store.dispatch(
      statedMaxSet({ exerciseKey: 'squat', exerciseName: 'Squat', weight: 315, unit: 'lbs' }),
    );
    expect(store.getState().strengthMarkers.statedMaxes.squat?.weight).toBe(315);
  });
});
