import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import workoutReducer, { activeWorkoutRestored, startWorkout } from '../../store/slices/workoutSlice';
import { ResumeWorkoutSheet } from './ResumeWorkoutSheet';
import {
  saveWorkoutSnapshot,
  loadWorkoutSnapshot,
  clearWorkoutSnapshot,
} from '../../lib/workoutSession';
import type { ActiveWorkout } from '../../types/exercise';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockFinishWorkout = vi.fn().mockResolvedValue(true);
let mockIsAnonymous = false;
vi.mock('../../hooks/useFinishWorkout', () => ({
  useFinishWorkout: () => ({
    finishWorkout: mockFinishWorkout,
  }),
  useIsAnonymousWorkoutUser: () => mockIsAnonymous,
}));

const sampleWorkout: ActiveWorkout = {
  id: 'workout-resume-1',
  name: 'Upper Body Power',
  exercises: [
    {
      id: 'ex-1',
      exercise: {
        id: 'bench-press',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        muscleGroups: ['Chest'],
        equipment: 'Barbell',
        videoLinks: [],
        instructions: [],
        difficulty: 'Intermediate',
        force: 'Push',
        grips: 'Overhand',
        mechanic: 'Compound',
        searchKeywords: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      sets: [
        { id: 's-1', reps: 5, weight: 225, completed: true },
        { id: 's-2', reps: 5, weight: 225, completed: true },
        { id: 's-3', reps: 5, weight: 225, completed: false },
        { id: 's-4', reps: 5, weight: 225, completed: false },
      ],
    },
  ],
  currentExerciseIndex: 0,
  currentSetIndex: 2,
  startTime: '2026-10-22T10:00:00.000Z',
  duration: 30,
  isActive: true,
};

function renderSheet(
  initialPath = '/',
  workout: ActiveWorkout | null = sampleWorkout,
  { restored = true }: { restored?: boolean } = {},
) {
  const store = configureStore({
    reducer: {
      workout: workoutReducer,
    },
  });

  if (workout && restored) {
    store.dispatch(activeWorkoutRestored({ activeWorkout: workout }));
  } else if (workout) {
    store.dispatch(startWorkout({ name: workout.name, exercises: workout.exercises }));
  }

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialPath]}>
          <ResumeWorkoutSheet />
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('ResumeWorkoutSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockIsAnonymous = false;
  });

  it('renders workout name, set counts, saved time, and all three actions', () => {
    // 2 completed sets out of 4 total sets
    saveWorkoutSnapshot({
      activeWorkout: sampleWorkout,
      savedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    });

    renderSheet('/');

    expect(screen.getByText('In-progress workout')).toBeInTheDocument();
    expect(screen.getByText('Upper Body Power')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 sets logged')).toBeInTheDocument();
    expect(screen.getByText(/Saved 5 minutes ago/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish & save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('navigates to /workout on Resume click', () => {
    saveWorkoutSnapshot({ activeWorkout: sampleWorkout });
    renderSheet('/');

    const resumeBtn = screen.getByRole('button', { name: 'Resume' });
    fireEvent.click(resumeBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/workout');
  });

  it('calls finishWorkout on Finish & save click', async () => {
    saveWorkoutSnapshot({ activeWorkout: sampleWorkout });
    renderSheet('/');

    const finishBtn = screen.getByRole('button', { name: 'Finish & save' });
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(mockFinishWorkout).toHaveBeenCalled();
    });
  });

  it('requires confirmation on Discard before ending workout and clearing snapshot', async () => {
    saveWorkoutSnapshot({ activeWorkout: sampleWorkout });
    const { store } = renderSheet('/');

    const discardBtn = screen.getByRole('button', { name: 'Discard' });
    fireEvent.click(discardBtn);

    // Shows confirmation prompt
    expect(screen.getByText(/Discard this workout\? This cannot be undone\./)).toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm discard' });

    // Cancel returns to unconfirmed state without ending workout
    fireEvent.click(cancelBtn);
    expect(screen.queryByText(/Discard this workout\? This cannot be undone\./)).not.toBeInTheDocument();
    expect(store.getState().workout.activeWorkout).not.toBeNull();

    // Re-click Discard and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm discard' }));

    expect(store.getState().workout.activeWorkout).toBeNull();
    expect(loadWorkoutSnapshot()).toBeNull();
  });

  it('does not render when on /workout', () => {
    saveWorkoutSnapshot({ activeWorkout: sampleWorkout });
    renderSheet('/workout');

    expect(screen.queryByText('In-progress workout')).not.toBeInTheDocument();
  });

  it('does not render when there is no active workout', () => {
    renderSheet('/', null);

    expect(screen.queryByText('In-progress workout')).not.toBeInTheDocument();
  });

  it('stays closed for a live (non-restored) workout off /workout', () => {
    renderSheet('/', sampleWorkout, { restored: false });
    expect(screen.queryByText('In-progress workout')).not.toBeInTheDocument();
  });

  it('opens for a restored workout and does not reopen after Resume', async () => {
    const { store } = renderSheet('/');
    expect(screen.getByText('In-progress workout')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(mockNavigate).toHaveBeenCalledWith('/workout');
    expect(store.getState().workout.restoredFromSnapshot).toBe(false);
    expect(store.getState().workout.activeWorkout).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByText('In-progress workout')).not.toBeInTheDocument(),
    );
  });

  it('disables Finish & save when no set is completed; Discard and Resume remain', () => {
    const empty: ActiveWorkout = {
      ...sampleWorkout,
      exercises: [{
        ...sampleWorkout.exercises[0],
        sets: sampleWorkout.exercises[0].sets.map((st) => ({ ...st, completed: false })),
      }],
    };
    renderSheet('/', empty);
    expect(screen.getByRole('button', { name: 'Finish & save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish & save' }));
    expect(mockFinishWorkout).not.toHaveBeenCalled();
  });

  it('passes the same isAnonymousUser value WorkoutPage would to finishWorkout', async () => {
    mockIsAnonymous = true;
    renderSheet('/');
    fireEvent.click(screen.getByRole('button', { name: 'Finish & save' }));
    await waitFor(() => {
      expect(mockFinishWorkout).toHaveBeenCalledWith({ isAnonymousUser: true });
    });
  });

  it('does not read the snapshot from storage on every render', () => {
    saveWorkoutSnapshot({ activeWorkout: sampleWorkout });
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    renderSheet('/');
    const afterMount = spy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(spy.mock.calls.length).toBe(afterMount);
    spy.mockRestore();
  });
});
