import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import user from '../../store/slices/userSlice';
import trackedLifts, { trackedLiftsHydrated } from '../../store/slices/trackedLiftsSlice';
import type { TrackedLift } from '../../types/trackedLifts';
import { prescribe } from '../../lib/trackedLiftProgression';
import { ExerciseConfigCard, parseReps } from './ExerciseConfigCard';

/** Holds the exercise in state the way the configurator does. */
function Harness({ initial, onChange }: { initial: any; onChange: (ex: any) => void }) {
  const [exercise, setExercise] = useState(initial);
  return (
    <DndContext>
      <SortableContext items={['ex-0']}>
        <ul>
          <ExerciseConfigCard
            id="ex-0"
            exercise={exercise}
            onUpdate={(ex) => {
              setExercise(ex);
              onChange(ex);
            }}
            onDelete={() => {}}
            onReplaceExercise={() => {}}
            onToggleSuperset={() => {}}
            isInSuperset={false}
            exerciseDatabase={[]}
          />
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function renderCard() {
  const store = configureStore({ reducer: { user } });
  let latest: any = null;
  render(
    <Provider store={store}>
      <Harness
        initial={{
          name: 'Bench Press',
          restTime: 90,
          sets: [
            { reps: { min: 8, max: 12 }, weight: 180, unit: 'lbs' },
            { reps: { min: 8, max: 12 }, weight: 180, unit: 'lbs' },
          ],
        }}
        onChange={(ex) => (latest = ex)}
      />
    </Provider>,
  );
  return () => latest;
}

describe('ExerciseConfigCard set editing', () => {
  it('changes a set weight (and keeps it)', async () => {
    const u = userEvent.setup();
    const latest = renderCard();
    await u.click(screen.getByRole('button', { name: 'Expand' }));
    const weight = screen.getByLabelText('Set 1 weight');
    await u.clear(weight);
    await u.type(weight, '185');
    expect(latest().sets[0]).toMatchObject({ weight: 185, unit: 'lbs' });
    expect(latest().sets[1].weight).toBe(180);
    await u.tab();
    expect(weight).toHaveValue('185');
  });

  it('lets a rep range be retyped without snapping mid-edit', async () => {
    const u = userEvent.setup();
    const latest = renderCard();
    await u.click(screen.getByRole('button', { name: 'Expand' }));
    const reps = screen.getByLabelText('Set 2 reps');
    await u.clear(reps);
    expect(reps).toHaveValue('');
    await u.type(reps, '6-');
    expect(reps).toHaveValue('6-');
    await u.type(reps, '8');
    expect(latest().sets[1].reps).toEqual({ min: 6, max: 8 });
    await u.clear(reps);
    await u.type(reps, '5');
    await u.tab();
    expect(latest().sets[1].reps).toBe(5);
    expect(reps).toHaveValue('5');
  });

  it('shows and edits the exercise rest time', async () => {
    renderCard();
    expect(screen.getByText(/1\.5/)).toBeInTheDocument(); // 90 s → 1.5 min rest
  });
});

describe('parseReps', () => {
  it('parses counts, ranges and AMRAP; incomplete text is null', () => {
    expect(parseReps('10')).toBe(10);
    expect(parseReps('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseReps('8 – 12')).toEqual({ min: 8, max: 12 });
    expect(parseReps('amrap')).toBe('AMRAP');
    expect(parseReps('8-')).toBeNull();
    expect(parseReps('')).toBeNull();
    expect(parseReps('12-8')).toBeNull();
  });
});

describe('ExerciseConfigCard Volume | Strength segmented control', () => {
  it('defaults unset, sets and clears emphasis via click and keyboard on a plain exercise without changing sets', async () => {
    const u = userEvent.setup();
    const store = configureStore({ reducer: { user, trackedLifts } });
    let latest: any = null;
    const initialSets = [
      { reps: 10, weight: 35, unit: 'lbs' },
      { reps: 10, weight: 35, unit: 'lbs' },
    ];
    render(
      <Provider store={store}>
        <Harness
          initial={{ name: 'Dumbbell Curl', restTime: 90, sets: initialSets, supersetGroup: 1 }}
          onChange={(ex) => (latest = ex)}
        />
      </Provider>,
    );

    const group = screen.getByRole('group', { name: 'Dumbbell Curl emphasis' });
    const volumeBtn = within(group).getByRole('button', { name: 'Volume' });
    const strengthBtn = within(group).getByRole('button', { name: 'Strength' });

    // Unset by default, 44px touch targets
    expect(volumeBtn).toHaveAttribute('aria-pressed', 'false');
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'false');
    expect(volumeBtn.className).toContain('min-h-touch-min');
    expect(strengthBtn.className).toContain('min-h-touch-min');
    expect(screen.queryByTestId('emphasis-chip')).not.toBeInTheDocument();

    // Click Volume -> sets emphasis: 'volume', leaves sets untouched, shows chip
    await u.click(volumeBtn);
    expect(volumeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'false');
    expect(latest.emphasis).toBe('volume');
    expect(latest.sets).toEqual(initialSets);
    expect(latest.supersetGroup).toBe(1);
    expect(screen.getByTestId('emphasis-chip')).toHaveTextContent('Volume');

    // Keyboard activation on Strength -> flips to 'strength'
    strengthBtn.focus();
    await u.keyboard('{Enter}');
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'true');
    expect(volumeBtn).toHaveAttribute('aria-pressed', 'false');
    expect(latest.emphasis).toBe('strength');
    expect(latest.sets).toEqual(initialSets);
    expect(screen.getByTestId('emphasis-chip')).toHaveTextContent('Strength');

    // Tapping the selected one clears it
    await u.click(strengthBtn);
    expect(volumeBtn).toHaveAttribute('aria-pressed', 'false');
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'false');
    expect(latest.emphasis).toBeUndefined();
    expect(screen.queryByTestId('emphasis-chip')).not.toBeInTheDocument();
  });

  it('re-derives sets via prescribe when flipping emphasis on a tracked lift and stays in sync with tracked.goal', async () => {
    const u = userEvent.setup();
    const benchLift: TrackedLift = {
      id: 'lift-bench',
      name: 'Barbell Bench Press',
      category: 'Push',
      load: { kind: 'weight', value: 225, unit: 'lb' },
      target: { kind: 'reps', min: 5 },
      progression: true,
    };
    const store = configureStore({ reducer: { user, trackedLifts } });
    store.dispatch(trackedLiftsHydrated({ categories: ['Push'], lifts: [benchLift] }));

    let latest: any = null;
    const initial = { ...prescribe(benchLift, 'volume'), supersetGroup: 2 };
    render(
      <Provider store={store}>
        <Harness initial={initial} onChange={(ex) => (latest = ex)} />
      </Provider>,
    );

    const group = screen.getByRole('group', { name: 'Barbell Bench Press emphasis' });
    const volumeBtn = within(group).getByRole('button', { name: 'Volume' });
    const strengthBtn = within(group).getByRole('button', { name: 'Strength' });

    expect(volumeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'false');

    // Flip to Strength -> re-derives sets to heavy strength ramp and syncs tracked.goal
    await u.click(strengthBtn);
    const expectedStrength = prescribe(benchLift, 'strength');
    expect(latest.emphasis).toBe('strength');
    expect(latest.tracked).toEqual({ liftId: 'lift-bench', goal: 'strength' });
    expect(latest.sets).toEqual(expectedStrength.sets);
    expect(latest.supersetGroup).toBe(2);

    // Tapping Strength again clears both emphasis and tracked goal while keeping supersetGroup
    await u.click(strengthBtn);
    expect(latest.emphasis).toBeUndefined();
    expect(latest.tracked).toBeUndefined();
    expect(latest.supersetGroup).toBe(2);
  });

  it('clears stale auto-generated prescription notes when flipping a bodyweight tracked lift from Strength to Volume', async () => {
    const u = userEvent.setup();
    const pullLift: TrackedLift = {
      id: 'lift-pull',
      name: 'Pull Ups',
      category: 'Pull',
      load: { kind: 'bodyweight' },
      target: { kind: 'reps', min: 10 },
      progression: true,
    };
    const store = configureStore({ reducer: { user, trackedLifts } });
    store.dispatch(trackedLiftsHydrated({ categories: ['Pull'], lifts: [pullLift] }));

    let latest: any = null;
    const initial = prescribe(pullLift, 'strength');
    expect(initial.notes).toBe('Add load or slow the tempo');

    render(
      <Provider store={store}>
        <Harness initial={initial} onChange={(ex) => (latest = ex)} />
      </Provider>,
    );

    const group = screen.getByRole('group', { name: 'Pull Ups emphasis' });
    await u.click(within(group).getByRole('button', { name: 'Volume' }));
    expect(latest.emphasis).toBe('volume');
    expect(latest.tracked).toEqual({ liftId: 'lift-pull', goal: 'volume' });
    expect(latest.notes).toBeUndefined();
  });
});
