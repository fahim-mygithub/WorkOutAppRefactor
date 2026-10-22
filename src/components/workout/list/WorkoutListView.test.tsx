import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActiveWorkout, Exercise } from '../../../types/exercise';
import { WorkoutListView } from './WorkoutListView';

const benchEx = {
  id: 'x-bench',
  name: 'Bench Press',
  muscleGroup: 'Chest',
  equipment: 'Barbell',
  instructions: ['Lie back', 'Press barbell'],
  difficulty: 'Intermediate',
} as Exercise;

const flyeEx = {
  id: 'x-flye',
  name: 'Dumbbell Flye',
  muscleGroup: 'Chest',
  equipment: 'Dumbbells',
  instructions: ['Lie back', 'Fly dumbbells'],
  difficulty: 'Beginner',
} as Exercise;

function createMockWorkout(): ActiveWorkout {
  return {
    id: 'w-1',
    name: 'Chest Day',
    startTime: new Date().toISOString(),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    isActive: true,
    duration: 0,
    exercises: [
      {
        id: 'we-1',
        exercise: benchEx,
        sets: [
          { id: 's1', reps: 8, weight: 70, completed: true },
          { id: 's2', reps: 8, weight: 70, completed: false },
        ],
        isSuperset: true,
        supersetId: 'ss-chest',
      },
      {
        id: 'we-2',
        exercise: flyeEx,
        sets: [
          { id: 's3', reps: 12, weight: 30, completed: false },
        ],
        isSuperset: true,
        supersetId: 'ss-chest',
      },
    ],
  } as unknown as ActiveWorkout;
}

describe('WorkoutListView', () => {
  it('renders every exercise in the workout', () => {
    const workout = createMockWorkout();
    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Dumbbell Flye')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 sets done')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 sets done')).toBeInTheDocument();
  });

  it('logs the right set with exerciseIndex and setIndex', async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={onCompleteSet}
        onUncompleteSet={vi.fn()}
      />
    );

    // Set 2 of Bench Press is not completed
    const logButtons = screen.getAllByRole('button', { name: /log set/i });
    // First uncompleted set is bench press set 2 (index 1)
    await user.click(logButtons[0]);

    expect(onCompleteSet).toHaveBeenCalledWith(0, 1, 8, 70, undefined);
  });

  it('collapses logged set and reopens it on tap', async () => {
    const user = userEvent.setup();
    const onUncompleteSet = vi.fn();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={onUncompleteSet}
      />
    );

    // Completed set 1 of Bench Press (8x70) should be collapsed
    const collapsedButton = screen.getByRole('button', {
      name: /set 1:.*8.*70.*completed/i,
    });
    expect(collapsedButton).toBeInTheDocument();
    expect(screen.getByText(/8[×x]70.*✓/)).toBeInTheDocument();

    // Tap to reopen
    await user.click(collapsedButton);

    // After reopening, the undo and edit set buttons from SetInput should be accessible
    const undoButton = screen.getByRole('button', { name: /undo set/i });
    expect(undoButton).toBeInTheDocument();

    await user.click(undoButton);
    expect(onUncompleteSet).toHaveBeenCalledWith(0, 0);
  });

  it('displays the superset badge for paired movements', () => {
    const workout = createMockWorkout();
    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    expect(screen.getByText(/Superset with Dumbbell Flye/)).toBeInTheDocument();
    expect(screen.getByText(/Superset with Bench Press/)).toBeInTheDocument();
  });

  it('renders cue strip under the logged set and wires Apply and Keep', async () => {
    const user = userEvent.setup();
    const onApplySuggestion = vi.fn();
    const onKeepSuggestion = vi.fn();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        suggestion={{
          exerciseIndex: 0,
          setIndex: 0,
          decision: {
            action: 'reduce',
            suggestedWeight: 65,
            message: 'Tough set? Cut load to 65 lb',
          },
        }}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
        onApplySuggestion={onApplySuggestion}
        onKeepSuggestion={onKeepSuggestion}
      />
    );

    expect(screen.getByText('Tough set? Cut load to 65 lb')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /use 65 lb/i });
    await user.click(applyBtn);
    expect(onApplySuggestion).toHaveBeenCalledWith(65, 'x-bench');

    // Test Keep button
    const keepBtn = screen.getByRole('button', { name: 'Keep' });
    await user.click(keepBtn);
    expect(onKeepSuggestion).toHaveBeenCalledOnce();
  });

  it('renders empty or single-exercise workouts normally', () => {
    const singleWorkout = {
      id: 'w-single',
      name: 'Single Exercise',
      startTime: new Date().toISOString(),
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      isActive: true,
      duration: 0,
      exercises: [
        {
          id: 'we-single',
          exercise: benchEx,
          sets: [],
        },
      ],
    } as unknown as ActiveWorkout;

    render(
      <WorkoutListView
        workout={singleWorkout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    expect(screen.queryByText('Single Exercise')).not.toBeInTheDocument(); // Name is in TopBar
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('0 of 0 sets done')).toBeInTheDocument();
  });
});
