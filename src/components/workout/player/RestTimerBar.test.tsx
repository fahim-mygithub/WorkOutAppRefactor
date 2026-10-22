import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import workoutReducer, { activeWorkoutRestored } from '../../../store/slices/workoutSlice';
import type { ActiveWorkout, Exercise, WorkoutExercise } from '../../../types/exercise';
import { RestTimerBar } from './RestTimerBar';

// Mock Web Audio API
class AudioContextMock {
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }
}
// @ts-expect-error test mock
window.AudioContext = AudioContextMock;

const cableRowEx = {
  id: 'x-cable-row',
  name: 'Cable Row',
  muscleGroup: 'Back',
  equipment: 'Cable',
} as unknown as Exercise;

const benchEx = {
  id: 'x-bench',
  name: 'Bench Press',
  muscleGroup: 'Chest',
  equipment: 'Barbell',
} as unknown as Exercise;

const inclineEx = {
  id: 'x-incline',
  name: 'Incline Dumbbell Press',
  muscleGroup: 'Chest',
  equipment: 'Dumbbells',
} as unknown as Exercise;

const lateralRaiseEx = {
  id: 'x-lateral-raise',
  name: 'Lateral Raise',
  muscleGroup: 'Shoulders',
  equipment: 'Dumbbells',
} as unknown as Exercise;

function createWorkout(exercises: WorkoutExercise[], currentExerciseIndex = 0, currentSetIndex = 0): ActiveWorkout {
  return {
    id: 'w-test',
    name: 'Test Workout',
    exercises,
    startTime: '2026-10-22T14:00:00.000Z',
    duration: 0,
    isActive: true,
    currentExerciseIndex,
    currentSetIndex,
  } as unknown as ActiveWorkout;
}

function renderBar(
  workout: ActiveWorkout,
  restTimer: { isActive: boolean; duration: number; timeRemaining: number; targetEndTime: number | null } = {
    isActive: true,
    duration: 90,
    timeRemaining: 90,
    targetEndTime: Date.now() + 90_000,
  },
) {
  const store = configureStore({
    reducer: {
      workout: workoutReducer,
    },
  });

  store.dispatch(
    activeWorkoutRestored({
      activeWorkout: workout,
      restTimer,
    }),
  );

  return {
    store,
    ...render(
      <Provider store={store}>
        <RestTimerBar />
      </Provider>
    ),
  };
}

describe('RestTimerBar Up next', () => {
  it('list-mode: card 1 logged, card 4 pre-logged -> up next is card 2 first unlogged set', () => {
    // 4 cards:
    // Card 1: Cable Row (single, 1 set completed)
    // Card 2: Superset (Incline DB Press + Lateral Raise, 1 set each uncompleted)
    // Card 3: Bench Press (single, 1 set uncompleted)
    // Card 4: Pre-logged single (1 set completed)
    const cableRow: WorkoutExercise = {
      id: 'we-1',
      exercise: cableRowEx,
      restTime: 60,
      sets: [{ id: 's1', reps: 10, weight: 120, unit: 'lbs', completed: true }],
    };

    const incline: WorkoutExercise = {
      id: 'we-2',
      exercise: inclineEx,
      restTime: 60,
      isSuperset: true,
      supersetId: 'ss-1',
      sets: [{ id: 's2', reps: 10, weight: 40, unit: 'lbs', completed: false }],
    };

    const lateralRaise: WorkoutExercise = {
      id: 'we-3',
      exercise: lateralRaiseEx,
      restTime: 60,
      isSuperset: true,
      supersetId: 'ss-1',
      sets: [{ id: 's3', reps: 12, weight: 20, unit: 'lbs', completed: false }],
    };

    const preLogged: WorkoutExercise = {
      id: 'we-4',
      exercise: benchEx,
      restTime: 60,
      sets: [{ id: 's4', reps: 8, weight: 185, unit: 'lbs', completed: true }],
    };

    // Card 1 was logged, cursor is at 0, 0
    const workout = createWorkout([cableRow, incline, lateralRaise, preLogged], 0, 0);

    renderBar(workout);

    // Cable Row is already logged, so it must NOT be named in Up next!
    expect(screen.queryByText(/Cable Row/i)).not.toBeInTheDocument();

    // Up next should be Incline Dumbbell Press (card 2's first unlogged set)
    expect(screen.getByText(/Up next:/i)).toBeInTheDocument();
    expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
    expect(screen.getByText(/40 × 10/i)).toBeInTheDocument();
  });

  it('cards-mode / in-order: skips completed sets to find the next uncompleted set', () => {
    const bench: WorkoutExercise = {
      id: 'we-1',
      exercise: benchEx,
      restTime: 60,
      sets: [
        { id: 's1', reps: 10, weight: 135, unit: 'lbs', completed: true },
        { id: 's2', reps: 10, weight: 135, unit: 'lbs', completed: true },
        { id: 's3', reps: 10, weight: 135, unit: 'lbs', completed: false },
      ],
    };

    // Cursor is on set 0 or 1 which is already completed
    const workout = createWorkout([bench], 0, 0);
    renderBar(workout);

    expect(screen.getByText(/Up next: set 3/i)).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
  });

  it('cards-mode / superset rounds: picks the next uncompleted set in superset or next exercise', () => {
    const incline: WorkoutExercise = {
      id: 'we-1',
      exercise: inclineEx,
      restTime: 60,
      isSuperset: true,
      supersetId: 'ss-1',
      sets: [
        { id: 's1', reps: 10, weight: 40, unit: 'lbs', completed: true },
        { id: 's2', reps: 10, weight: 40, unit: 'lbs', completed: false },
      ],
    };

    const lateralRaise: WorkoutExercise = {
      id: 'we-2',
      exercise: lateralRaiseEx,
      restTime: 60,
      isSuperset: true,
      supersetId: 'ss-1',
      sets: [
        { id: 's3', reps: 12, weight: 20, unit: 'lbs', completed: false },
        { id: 's4', reps: 12, weight: 20, unit: 'lbs', completed: false },
      ],
    };

    // Incline set 1 is logged, lateral raise set 1 is next uncompleted
    const workout = createWorkout([incline, lateralRaise], 0, 0);
    renderBar(workout);

    expect(screen.getByText(/Up next: set 1/i)).toBeInTheDocument();
    expect(screen.getByText('Lateral Raise')).toBeInTheDocument();
  });

  it('everything logged -> no up-next (or workout complete voice)', () => {
    const cableRow: WorkoutExercise = {
      id: 'we-1',
      exercise: cableRowEx,
      restTime: 60,
      sets: [{ id: 's1', reps: 10, weight: 120, unit: 'lbs', completed: true }],
    };
    const bench: WorkoutExercise = {
      id: 'we-2',
      exercise: benchEx,
      restTime: 60,
      sets: [{ id: 's2', reps: 8, weight: 185, unit: 'lbs', completed: true }],
    };

    const workout = createWorkout([cableRow, bench], 1, 0);

    renderBar(workout);

    expect(screen.queryByText(/Up next:/i)).not.toBeInTheDocument();
  });
});

const idleTimer = { isActive: false, duration: 0, timeRemaining: 0, targetEndTime: null };

function loggedSingle(id: string, completed: boolean): WorkoutExercise {
  return {
    id,
    exercise: benchEx,
    restTime: 60,
    sets: [{ id: `${id}-s1`, reps: 8, weight: 185, unit: 'lbs', completed }],
  };
}

describe('RestTimerBar finish workout', () => {
  it('all sets logged: idle bar shows "Finish workout" instead of "Start rest"', () => {
    renderBar(createWorkout([loggedSingle('a', true), loggedSingle('b', true)], 0, 0), idleTimer);

    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeInTheDocument();
    expect(screen.queryByText('Start rest')).not.toBeInTheDocument();
  });

  it('clicking "Finish workout" opens the completion modal', () => {
    const { store } = renderBar(createWorkout([loggedSingle('a', true)], 0, 0), idleTimer);

    fireEvent.click(screen.getByRole('button', { name: 'Finish workout' }));

    expect(store.getState().workout.showCompletionModal).toBe(true);
  });

  it('partially logged: idle bar still shows "Start rest" and no finish button', () => {
    renderBar(createWorkout([loggedSingle('a', true), loggedSingle('b', false)], 0, 0), idleTimer);

    expect(screen.getByText('Start rest')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish workout' })).not.toBeInTheDocument();
  });

  it('finished rest with all sets logged opens the modal even when the cursor is not on the last exercise', () => {
    vi.useFakeTimers();
    try {
      const { store } = renderBar(
        createWorkout([loggedSingle('a', true), loggedSingle('b', true)], 0, 0),
        { isActive: true, duration: 90, timeRemaining: 0, targetEndTime: Date.now() - 1000 },
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(store.getState().workout.showCompletionModal).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
