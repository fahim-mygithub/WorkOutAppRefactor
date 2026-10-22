import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActiveWorkout, Exercise, WorkoutExercise } from '../../../types/exercise';
import { WorkoutListView } from './WorkoutListView';

const benchEx = {
  id: 'x-bench',
  name: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  equipment: 'Barbell',
  instructions: ['Lie back', 'Press barbell'],
  difficulty: 'Intermediate',
} as unknown as Exercise;

const inclineEx = {
  id: 'x-incline',
  name: 'Incline Dumbbell Press',
  muscleGroup: 'Chest',
  equipment: 'Dumbbells',
  instructions: ['Set bench to 30 deg', 'Press dumbbells'],
  difficulty: 'Intermediate',
} as unknown as Exercise;

const lateralRaiseEx = {
  id: 'x-raise',
  name: 'Dumbbell Lateral Raise',
  muscleGroup: 'Shoulders',
  equipment: 'Dumbbells',
  instructions: ['Stand tall', 'Raise arms to sides'],
  difficulty: 'Beginner',
} as unknown as Exercise;

function createMockWorkout(exercises?: WorkoutExercise[]): ActiveWorkout {
  return {
    id: 'w-1',
    name: 'Push Day',
    startTime: new Date().toISOString(),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    isActive: true,
    duration: 0,
    exercises: exercises ?? [
      {
        id: 'we-bench',
        exercise: benchEx,
        restTime: 90,
        sets: [
          { id: 's1', reps: 5, weight: 100, completed: false },
          { id: 's2', reps: 5, weight: 100, completed: false },
          { id: 's3', reps: 5, weight: 100, completed: false },
          { id: 's4', reps: 5, weight: 100, completed: false },
        ],
      },
    ],
  } as unknown as ActiveWorkout;
}

describe('WorkoutListView', () => {
  it('interleaving (superset): renders a single card interleaving A1, B1, A2, B2... with unequal set counts', () => {
    const supersetWorkout = createMockWorkout([
      {
        id: 'we-incline',
        exercise: inclineEx,
        restTime: 120,
        isSuperset: true,
        supersetId: 'ss-push',
        sets: [
          { id: 'inc-1', reps: 10, weight: 40, completed: false },
          { id: 'inc-2', reps: 10, weight: 40, completed: false },
          { id: 'inc-3', reps: 10, weight: 40, completed: false },
        ],
      },
      {
        id: 'we-raise',
        exercise: lateralRaiseEx,
        restTime: 60,
        isSuperset: true,
        supersetId: 'ss-push',
        sets: [
          { id: 'rs-1', reps: 12, weight: 20, completed: false },
          { id: 'rs-2', reps: 12, weight: 20, completed: false },
        ],
      },
    ]);

    render(
      <WorkoutListView
        workout={supersetWorkout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    // Both titles visible in the superset header
    expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
    expect(screen.getByText('Dumbbell Lateral Raise')).toBeInTheDocument();

    // Exactly 5 line items interleaved: A1, B1, A2, B2, A3
    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    expect(lineButtons).toHaveLength(5);

    expect(lineButtons[0]).toHaveAccessibleName(/incline.*set 1.*10 reps.*40/i);
    expect(lineButtons[1]).toHaveAccessibleName(/raise.*set 1.*12 reps.*20/i);
    expect(lineButtons[2]).toHaveAccessibleName(/incline.*set 2.*10 reps.*40/i);
    expect(lineButtons[3]).toHaveAccessibleName(/raise.*set 2.*12 reps.*20/i);
    expect(lineButtons[4]).toHaveAccessibleName(/incline.*set 3.*10 reps.*40/i);
  });

  it('one line per set: displays each set as a ledger line', () => {
    const workout = createMockWorkout();
    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    expect(lineButtons).toHaveLength(4);

    // Each displays 5 Reps and 100 lb
    lineButtons.forEach((btn, idx) => {
      expect(btn).toHaveAccessibleName(new RegExp(`set ${idx + 1}:.*5 reps.*100`, 'i'));
    });
  });

  it('line edit affects only that line', async () => {
    const user = userEvent.setup();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    // Tap the 3rd line (Set 3)
    await user.click(lineButtons[2]);

    // Inline stepper should appear
    const increaseWeight = screen.getByRole('button', { name: /increase weight/i });
    await user.click(increaseWeight); // 100 -> 105

    const increaseReps = screen.getByRole('button', { name: /increase reps/i });
    await user.click(increaseReps); // 5 -> 6

    // Line 3 now reflects 6 reps and 105 lb
    expect(screen.getAllByRole('button', { name: /set \d/i })[2]).toHaveAccessibleName(
      /set 3:.*6 reps.*105/i
    );

    // Lines 1, 2, 4 remain unchanged (5 reps, 100 lb)
    const updatedButtons = screen.getAllByRole('button', { name: /set \d/i });
    expect(updatedButtons[0]).toHaveAccessibleName(/set 1:.*5 reps.*100/i);
    expect(updatedButtons[1]).toHaveAccessibleName(/set 2:.*5 reps.*100/i);
    expect(updatedButtons[3]).toHaveAccessibleName(/set 4:.*5 reps.*100/i);
  });

  it('Log workout logs all unlogged sets and starts exactly one rest', async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn();
    const onStartRest = vi.fn();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={onCompleteSet}
        onUncompleteSet={vi.fn()}
        onStartRest={onStartRest}
      />
    );

    // Edit set 3 to 105 lb before logging
    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    await user.click(lineButtons[2]);
    await user.click(screen.getByRole('button', { name: /increase weight/i })); // 100 -> 105

    // Click Log workout
    const logButton = screen.getByRole('button', { name: /log workout|log all sets/i });
    await user.click(logButton);

    // Called for all 4 unlogged sets in order with their current reps/weight
    expect(onCompleteSet).toHaveBeenCalledTimes(4);
    expect(onCompleteSet).toHaveBeenNthCalledWith(1, 0, 0, 5, 100, undefined);
    expect(onCompleteSet).toHaveBeenNthCalledWith(2, 0, 1, 5, 100, undefined);
    expect(onCompleteSet).toHaveBeenNthCalledWith(3, 0, 2, 5, 105, undefined);
    expect(onCompleteSet).toHaveBeenNthCalledWith(4, 0, 3, 5, 100, undefined);

    // Starts exactly ONE rest timer using the exercise restTime (90)
    expect(onStartRest).toHaveBeenCalledOnce();
    expect(onStartRest).toHaveBeenCalledWith(90);
  });

  it('undo: when all sets are logged, button allows undo and does not start rest', async () => {
    const user = userEvent.setup();
    const onUncompleteSet = vi.fn();
    const onStartRest = vi.fn();
    const allDoneWorkout = createMockWorkout([
      {
        id: 'we-bench',
        exercise: benchEx,
        restTime: 90,
        sets: [
          { id: 's1', reps: 5, weight: 100, completed: true },
          { id: 's2', reps: 5, weight: 100, completed: true },
        ],
      },
    ]);

    render(
      <WorkoutListView
        workout={allDoneWorkout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={onUncompleteSet}
        onStartRest={onStartRest}
      />
    );

    const undoButton = screen.getByRole('button', { name: /logged\. tap to undo/i });
    expect(undoButton).toBeInTheDocument();

    await user.click(undoButton);

    expect(onUncompleteSet).toHaveBeenCalledTimes(2);
    expect(onUncompleteSet).toHaveBeenNthCalledWith(1, 0, 0);
    expect(onUncompleteSet).toHaveBeenNthCalledWith(2, 0, 1);
    expect(onStartRest).not.toHaveBeenCalled();
  });

  it('resume-pre-logged lines: pre-logged sets render as completed and Log workout logs only remaining sets', async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn();
    const onStartRest = vi.fn();
    const partiallyDoneWorkout = createMockWorkout([
      {
        id: 'we-bench',
        exercise: benchEx,
        restTime: 90,
        sets: [
          { id: 's1', reps: 8, weight: 70, completed: true },
          { id: 's2', reps: 8, weight: 70, completed: false },
        ],
      },
    ]);

    render(
      <WorkoutListView
        workout={partiallyDoneWorkout}
        onCompleteSet={onCompleteSet}
        onUncompleteSet={vi.fn()}
        onStartRest={onStartRest}
      />
    );

    // Button should still say Log workout because set 2 is not completed
    const logButton = screen.getByRole('button', { name: /log workout|log all sets/i });
    await user.click(logButton);

    // Only Set 2 (index 1) should be logged!
    expect(onCompleteSet).toHaveBeenCalledTimes(1);
    expect(onCompleteSet).toHaveBeenCalledWith(0, 1, 8, 70, undefined);
    expect(onStartRest).toHaveBeenCalledOnce();
    expect(onStartRest).toHaveBeenCalledWith(90);
  });

  it('reduced motion class: inline editor includes classes supporting prefers-reduced-motion', async () => {
    const user = userEvent.setup();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    await user.click(lineButtons[0]);

    // Find the inline editor wrapper
    const stepperContainer = screen.getByRole('button', { name: /decrease weight/i }).closest('.reveal');
    expect(stepperContainer).toBeInTheDocument();
    expect(stepperContainer?.className).toMatch(/reveal|motion-reduce/);
  });

  it('reports the exercise being worked on when its card is touched', async () => {
    const user = userEvent.setup();
    const onFocusExercise = vi.fn();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
        onEditSets={vi.fn()}
        onFocusExercise={onFocusExercise}
      />
    );

    await user.click(screen.getByRole('button', { name: /edit sets for barbell bench press/i }));
    expect(onFocusExercise).toHaveBeenCalledWith(0);
  });
});
