import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userReducer from '../store/slices/userSlice';
import plannedWorkoutsReducer, {
  type PlannedWorkout,
} from '../store/slices/plannedWorkoutsSlice';
import { usePlannedWorkoutsSync } from './usePlannedWorkoutsSync';
import { PlannedWorkoutsService } from '../services/plannedWorkoutsService';

vi.mock('../services/plannedWorkoutsService', () => ({
  PlannedWorkoutsService: {
    loadLocal: vi.fn(),
    saveLocal: vi.fn(),
    getRemote: vi.fn(),
    saveRemote: vi.fn(),
  },
}));

const sampleRemotePlan: PlannedWorkout = {
  id: 'remote-1',
  dateKey: '2026-10-25',
  name: 'Remote Blast',
  exercises: [],
  status: 'planned',
  createdAt: '2026-10-22T08:00:00.000Z',
};

const sampleLocalPlan: PlannedWorkout = {
  id: 'local-offline',
  dateKey: '2026-10-24',
  name: 'Local Offline Blast',
  exercises: [],
  status: 'planned',
  createdAt: '2026-10-22T09:00:00.000Z',
};

function createTestStore(uid?: string) {
  const store = configureStore({
    reducer: {
      user: userReducer,
      plannedWorkouts: plannedWorkoutsReducer,
    },
    middleware: (gDM) =>
      gDM({
        serializableCheck: false,
      }),
    preloadedState: uid
      ? {
          user: {
            profile: {
              uid,
              email: 'test@example.com',
              displayName: 'Test',
              isAnonymous: false,
              createdAt: new Date(),
              lastLoginAt: new Date(),
            },
            preferences: {
              theme: 'system' as const,
              unitSystem: 'imperial' as const,
              weightUnit: 'lbs' as const,
              defaultRestTime: 90,
              autoStartTimer: true,
              keyboardShortcuts: { enabled: true, showInWorkout: true },
              notifications: { workoutReminders: true, restTimerAlerts: true, achievements: true },
            },
            status: 'authenticated' as const,
            error: null,
            isOnline: true,
            syncStatus: { pendingChanges: 0, isSyncing: false },
          },
        }
      : undefined,
  });
  return store;
}

describe('usePlannedWorkoutsSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not push empty local state to remote while remote fetch is pending (prevents data loss)', async () => {
    // Fresh device: local storage is empty
    vi.mocked(PlannedWorkoutsService.loadLocal).mockReturnValue(null);

    // Remote has existing plans, but the fetch is slow (takes 1000ms)
    let resolveRemote: (plans: PlannedWorkout[] | null) => void;
    const remotePromise = new Promise<PlannedWorkout[] | null>((resolve) => {
      resolveRemote = resolve;
    });
    vi.mocked(PlannedWorkoutsService.getRemote).mockReturnValue(remotePromise);

    const store = createTestStore('user-device-2');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => usePlannedWorkoutsSync(), { wrapper });

    // Local hydrate dispatched []
    expect(store.getState().plannedWorkouts.plans).toEqual([]);

    // Fast-forward past the 300ms debounce
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // saveRemote must NOT have been called with empty [] while remote fetch is pending!
    expect(PlannedWorkoutsService.saveRemote).not.toHaveBeenCalled();

    // Now remote fetch settles with remote plans
    await act(async () => {
      resolveRemote!([sampleRemotePlan]);
      await Promise.resolve();
    });

    // Store now has the remote plans
    expect(store.getState().plannedWorkouts.plans).toEqual([sampleRemotePlan]);

    // Fast-forward the debounce timer after merge
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Now saveRemote is called with the actual remote plans, not overwritten with empty
    expect(PlannedWorkoutsService.saveRemote).toHaveBeenCalledWith('user-device-2', [sampleRemotePlan]);
  });

  it('merges offline-created local plans with remote plans without overwriting', async () => {
    // Local has an offline-created plan
    vi.mocked(PlannedWorkoutsService.loadLocal).mockReturnValue([sampleLocalPlan]);

    let resolveRemote: (plans: PlannedWorkout[] | null) => void;
    const remotePromise = new Promise<PlannedWorkout[] | null>((resolve) => {
      resolveRemote = resolve;
    });
    vi.mocked(PlannedWorkoutsService.getRemote).mockReturnValue(remotePromise);

    const store = createTestStore('user-1');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => usePlannedWorkoutsSync(), { wrapper });

    // Initially local plan is in store
    expect(store.getState().plannedWorkouts.plans).toEqual([sampleLocalPlan]);

    // Remote fetch completes with remotePlan
    await act(async () => {
      resolveRemote!([sampleRemotePlan]);
      await Promise.resolve();
    });

    // Both plans are present!
    const plans = store.getState().plannedWorkouts.plans;
    expect(plans.map((p) => p.id)).toEqual(['local-offline', 'remote-1']);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Remote receives both merged plans
    expect(PlannedWorkoutsService.saveRemote).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-offline' }),
        expect.objectContaining({ id: 'remote-1' }),
      ]),
    );
  });

  it('saves locally and never calls remote for anonymous users', () => {
    vi.mocked(PlannedWorkoutsService.loadLocal).mockReturnValue([sampleLocalPlan]);

    const store = createTestStore(undefined);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => usePlannedWorkoutsSync(), { wrapper });

    expect(PlannedWorkoutsService.getRemote).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(PlannedWorkoutsService.saveLocal).toHaveBeenCalledWith('anon', [sampleLocalPlan]);
    expect(PlannedWorkoutsService.saveRemote).not.toHaveBeenCalled();
  });
});
