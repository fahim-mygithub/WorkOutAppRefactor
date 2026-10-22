import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActiveWorkout, Exercise, WorkoutExercise } from '../../../types/exercise';
import { WorkoutListView } from './WorkoutListView';
import { WEIGHT_STEP } from './workoutCardUtils';

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

const shoulderPressEx = {
  id: 'x-shoulder-press',
  name: 'Dumbbell Shoulder Press',
  muscleGroup: 'Shoulders',
  equipment: 'Dumbbells',
  instructions: ['Sit up', 'Press dumbbells overhead'],
  difficulty: 'Intermediate',
} as unknown as Exercise;

const plankEx = {
  id: 'x-plank',
  name: 'Plank Hold',
  muscleGroup: 'Core',
  equipment: 'Bodyweight',
  instructions: ['Hold plank position'],
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

    // Superset tags are A and B, and accessible names include tag and full exercise name
    expect(lineButtons[0]).toHaveAccessibleName(/^a \(incline dumbbell press\): set 1: 10 reps, 40 lbs?/i);
    expect(lineButtons[1]).toHaveAccessibleName(/^b \(dumbbell lateral raise\): set 1: 12 reps, 20 lbs?/i);
    expect(lineButtons[2]).toHaveAccessibleName(/^a \(incline dumbbell press\): set 2: 10 reps, 40 lbs?/i);
    expect(lineButtons[3]).toHaveAccessibleName(/^b \(dumbbell lateral raise\): set 2: 12 reps, 20 lbs?/i);
    expect(lineButtons[4]).toHaveAccessibleName(/^a \(incline dumbbell press\): set 3: 10 reps, 40 lbs?/i);
  });

  it('superset partners sharing first word get unambiguous A and B tags and labels', () => {
    // Both start with "Dumbbell" and end with "Press"
    const partnerWorkout = createMockWorkout([
      {
        id: 'we-inc-press',
        exercise: inclineEx, // Incline Dumbbell Press
        restTime: 90,
        isSuperset: true,
        supersetId: 'ss-presses',
        sets: [{ id: 'p1', reps: 8, weight: 50, completed: false }],
      },
      {
        id: 'we-sh-press',
        exercise: shoulderPressEx, // Dumbbell Shoulder Press
        restTime: 90,
        isSuperset: true,
        supersetId: 'ss-presses',
        sets: [{ id: 'p2', reps: 8, weight: 45, completed: false }],
      },
    ]);

    render(
      <WorkoutListView
        workout={partnerWorkout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    expect(lineButtons).toHaveLength(2);
    expect(lineButtons[0]).toHaveAccessibleName(/^a \(incline dumbbell press\): set 1: 8 reps, 50 lbs?/i);
    expect(lineButtons[1]).toHaveAccessibleName(/^b \(dumbbell shoulder press\): set 1: 8 reps, 45 lbs?/i);
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

    // Each displays 5 Reps and 100 lbs
    lineButtons.forEach((btn, idx) => {
      expect(btn).toHaveAccessibleName(new RegExp(`^set ${idx + 1}: 5 reps, 100 lbs?`, 'i'));
    });
  });

  it('line edit affects only that line and calls onUpdateSet', async () => {
    const user = userEvent.setup();
    const onUpdateSet = vi.fn();
    const workout = createMockWorkout();

    render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
        onUpdateSet={onUpdateSet}
      />
    );

    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    // Tap the 3rd line (Set 3)
    await user.click(lineButtons[2]);

    // Inline stepper should appear
    const increaseWeight = screen.getByRole('button', { name: /increase weight/i });
    await user.click(increaseWeight); // 100 -> 100 + WEIGHT_STEP (105)

    expect(onUpdateSet).toHaveBeenCalledWith(0, 2, 5, 100 + WEIGHT_STEP, undefined);

    const increaseReps = screen.getByRole('button', { name: /increase reps/i });
    await user.click(increaseReps); // 5 -> 6

    expect(onUpdateSet).toHaveBeenCalledWith(0, 2, 6, 105, undefined);

    // Line 3 now reflects 6 reps and 105 lbs
    expect(screen.getAllByRole('button', { name: /set \d/i })[2]).toHaveAccessibleName(
      /set 3: 6 reps, 105 lbs?/i
    );

    // Lines 1, 2, 4 remain unchanged (5 reps, 100 lbs)
    const updatedButtons = screen.getAllByRole('button', { name: /set \d/i });
    expect(updatedButtons[0]).toHaveAccessibleName(/set 1: 5 reps, 100 lbs?/i);
    expect(updatedButtons[1]).toHaveAccessibleName(/set 2: 5 reps, 100 lbs?/i);
    expect(updatedButtons[3]).toHaveAccessibleName(/set 4: 5 reps, 100 lbs?/i);
  });

  it('Log workout button accessible name matches visible text exactly, logs all sets and starts exactly one rest', async () => {
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

    // Button accessible name is exactly "Log workout" (not overridden by aria-label)
    const logButton = screen.getByRole('button', { name: /^log workout$/i });
    expect(logButton).toBeInTheDocument();
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

  it('card with no sets disables Log workout and starts no rest timer on click', async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn();
    const onStartRest = vi.fn();
    const noSetsWorkout = createMockWorkout([
      {
        id: 'we-empty',
        exercise: benchEx,
        restTime: 90,
        sets: [],
      },
    ]);

    render(
      <WorkoutListView
        workout={noSetsWorkout}
        onCompleteSet={onCompleteSet}
        onUncompleteSet={vi.fn()}
        onStartRest={onStartRest}
      />
    );

    const logButton = screen.getByRole('button', { name: /^log workout$/i });
    expect(logButton).toBeDisabled();

    await user.click(logButton);

    expect(onCompleteSet).not.toHaveBeenCalled();
    expect(onStartRest).not.toHaveBeenCalled();
  });

  it('undo: when all sets are logged, button displays Logged. Tap to undo and does not start rest', async () => {
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

    const undoButton = screen.getByRole('button', { name: /^logged\. tap to undo$/i });
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
    const logButton = screen.getByRole('button', { name: /^log workout$/i });
    await user.click(logButton);

    // Only Set 2 (index 1) should be logged!
    expect(onCompleteSet).toHaveBeenCalledTimes(1);
    expect(onCompleteSet).toHaveBeenCalledWith(0, 1, 8, 70, undefined);
    expect(onStartRest).toHaveBeenCalledOnce();
    expect(onStartRest).toHaveBeenCalledWith(90);
  });

  it('reduced motion class: inline editor includes classes supporting prefers-reduced-motion without inline style tags', async () => {
    const user = userEvent.setup();
    const workout = createMockWorkout();

    const { container } = render(
      <WorkoutListView
        workout={workout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
      />
    );

    // Keyframes moved out: no inline <style> element rendered by component
    expect(container.querySelector('style')).toBeNull();

    const lineButtons = screen.getAllByRole('button', { name: /set \d/i });
    await user.click(lineButtons[0]);

    // Find the inline editor wrapper
    const stepperContainer = screen.getByRole('button', { name: /decrease weight/i }).closest('.ledger-reveal');
    expect(stepperContainer).toBeInTheDocument();
    // Specifically asserts on reduced-motion utility class
    expect(stepperContainer?.className).toContain('motion-reduce:animate-none');
    expect(stepperContainer?.className).toContain('ledger-reveal');
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

  it('timed set: logs own reps value (0, not 8) and displays time in seconds', async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn();
    const onStartRest = vi.fn();
    const timedWorkout = createMockWorkout([
      {
        id: 'we-plank',
        exercise: plankEx,
        restTime: 60,
        sets: [
          { id: 'plank-1', reps: 0, time: 45, completed: false },
        ],
      },
    ]);

    render(
      <WorkoutListView
        workout={timedWorkout}
        onCompleteSet={onCompleteSet}
        onUncompleteSet={vi.fn()}
        onStartRest={onStartRest}
      />
    );

    const lineBtn = screen.getByRole('button', { name: /set 1: 45 seconds/i });
    expect(lineBtn).toBeInTheDocument();

    const logBtn = screen.getByRole('button', { name: /^log workout$/i });
    await user.click(logBtn);

    // Must log reps: 0 (its own reps), NOT 8!
    expect(onCompleteSet).toHaveBeenCalledTimes(1);
    expect(onCompleteSet).toHaveBeenCalledWith(0, 0, 0, 0, undefined);
  });

  it('timed set editor: shows ONLY time stepper (no weight or reps steppers)', async () => {
    const user = userEvent.setup();
    const onUpdateSet = vi.fn();
    const timedWorkout = createMockWorkout([
      {
        id: 'we-plank',
        exercise: plankEx,
        restTime: 60,
        sets: [
          { id: 'plank-1', reps: 0, time: 45, completed: false },
        ],
      },
    ]);

    render(
      <WorkoutListView
        workout={timedWorkout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
        onUpdateSet={onUpdateSet}
      />
    );

    const lineBtn = screen.getByRole('button', { name: /set 1: 45 seconds/i });
    await user.click(lineBtn);

    // Only time steppers should be visible
    expect(screen.getByRole('button', { name: /decrease time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase time/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decrease weight/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /increase weight/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decrease reps/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /increase reps/i })).not.toBeInTheDocument();

    // Step time up: 45 -> 50
    await user.click(screen.getByRole('button', { name: /increase time/i }));
    expect(onUpdateSet).toHaveBeenCalledWith(0, 0, 0, 0, 50);

    // Accessible name updates to 50 seconds
    expect(screen.getByRole('button', { name: /set 1: 50 seconds/i })).toBeInTheDocument();
  });

  it('superset card headers allow multi-line wrapping (line-clamp-2) and contain no truncate in header', () => {
    const supersetWorkout = createMockWorkout([
      {
        id: 'we-incline',
        exercise: inclineEx,
        isSuperset: true,
        supersetId: 'ss-wrap',
        sets: [{ id: 's1', reps: 10, weight: 50, completed: false }],
      },
      {
        id: 'we-raise',
        exercise: lateralRaiseEx,
        isSuperset: true,
        supersetId: 'ss-wrap',
        sets: [{ id: 's2', reps: 12, weight: 20, completed: false }],
      },
    ]);

    render(
      <WorkoutListView
        workout={supersetWorkout}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
        onUpdateSet={vi.fn()}
      />
    );

    const headingA = screen.getByRole('heading', { level: 2, name: 'Incline Dumbbell Press' });
    const headingB = screen.getByRole('heading', { level: 2, name: 'Dumbbell Lateral Raise' });

    expect(headingA).toBeInTheDocument();
    expect(headingB).toBeInTheDocument();

    // The header heading should not have `truncate` and should have `line-clamp-2`
    expect(headingA.className).not.toContain('truncate');
    expect(headingA.className).toContain('line-clamp-2');
    expect(headingB.className).not.toContain('truncate');
    expect(headingB.className).toContain('line-clamp-2');
  });
});
