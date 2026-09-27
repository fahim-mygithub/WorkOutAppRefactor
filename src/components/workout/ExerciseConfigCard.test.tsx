import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import user from '../../store/slices/userSlice';
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
