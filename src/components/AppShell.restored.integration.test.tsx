import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React, { Suspense } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { store } from '../store';
import { activeWorkoutRestored, endWorkout } from '../store/slices/workoutSlice';
import { AppShell } from './AppShell';
import type { ActiveWorkout } from '../types/exercise';

// Real AppShell + real pages; only the auth/firebase edge is stubbed.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null },
    loading: false,
    error: null,
    clearError: () => {},
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {}, app: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: () => () => {} }));

const HomePage = React.lazy(() => import('../pages/HomePage'));
const ExercisesPage = React.lazy(() => import('../pages/ExercisesPage'));
const WorkoutPage = React.lazy(() => import('../pages/WorkoutPage'));

const restored: ActiveWorkout = {
  id: 'workout-restored-int',
  name: 'Restored Push',
  exercises: [
    {
      id: 'we-1',
      exercise: {
        id: 'bench-press', name: 'Bench Press', muscleGroup: 'Chest', muscleGroups: ['Chest'],
        equipment: 'Barbell', videoLinks: [], instructions: [], difficulty: 'Intermediate',
        force: 'Push', grips: null, mechanic: 'Compound', searchKeywords: [],
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
      },
      sets: [
        { id: 's-1', reps: 5, weight: 100, completed: true },
        { id: 's-2', reps: 5, weight: 100, completed: false },
      ],
    },
  ],
  currentExerciseIndex: 0,
  currentSetIndex: 1,
  startTime: '2026-10-22T10:00:00.000Z',
  duration: 10,
  isActive: true,
};

function mountAt(path: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Suspense fallback={<div>loading</div>}>
          <Routes>
            <Route path="/" element={<AppShell><HomePage /></AppShell>} />
            <Route path="/exercises" element={<AppShell><ExercisesPage /></AppShell>} />
            <Route path="/workout" element={<AppShell><WorkoutPage /></AppShell>} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </Provider>,
  );
}

describe('restored active workout settles on every route (hang detector)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    store.dispatch(endWorkout());
    store.dispatch(activeWorkoutRestored({ activeWorkout: restored }));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    store.dispatch(endWorkout());
    errorSpy.mockRestore();
  });

  const assertNoLoop = () => {
    const msgs = errorSpy.mock.calls.map((c: unknown[]) => c.map(String).join(' '));
    expect(msgs.filter((m: string) => m.includes('Maximum update depth'))).toEqual([]);
  };

  it.each([
    ['/', 'In-progress workout'],
    ['/exercises', 'In-progress workout'],
  ])('renders %s with the resume sheet and settles', async (path, sheetTitle) => {
    mountAt(path);
    await waitFor(() => expect(screen.getByText(sheetTitle)).toBeInTheDocument(), { timeout: 8000 });
    assertNoLoop();
  }, 15000);

  it('renders /workout without the resume sheet and settles', async () => {
    mountAt('/workout');
    await waitFor(() => expect(screen.getAllByText(/Restored Push|Bench Press/).length).toBeGreaterThan(0), { timeout: 8000 });
    expect(screen.queryByText('In-progress workout')).not.toBeInTheDocument();
    assertNoLoop();
  }, 15000);
});
