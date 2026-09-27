import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import type { Exercise } from '../../types/exercise';
import { ExerciseQuickAdd } from './ExerciseQuickAdd';

const lib = [
  { id: 'bb-bench', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'db-bench', name: 'Dumbbell Bench Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'squat', name: 'Barbell Back Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
] as Exercise[];

function renderWith(ui: React.ReactElement) {
  const store = configureStore({ reducer: { exercise } });
  store.dispatch(setExercises(lib));
  return render(<Provider store={store}>{ui}</Provider>);
}

function NameField({ onPick }: { onPick: (e: Exercise) => void }) {
  const [name, setName] = useState('');
  return (
    <ExerciseQuickAdd
      id="lift-name"
      label="Lift"
      value={name}
      onValueChange={setName}
      onAdd={(e) => {
        onPick(e);
        setName(e.name);
      }}
    />
  );
}

describe('ExerciseQuickAdd as a name field', () => {
  it('suggests library matches while typing and fills the name on pick', async () => {
    const u = userEvent.setup();
    const onPick = vi.fn();
    renderWith(<NameField onPick={onPick} />);

    const input = screen.getByLabelText('Lift');
    await u.type(input, 'bench');
    expect(screen.getByRole('button', { name: /Barbell Bench Press/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Squat/ })).toBeNull();

    await u.click(screen.getByRole('button', { name: /Dumbbell Bench Press/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'db-bench' }));
    expect(input).toHaveValue('Dumbbell Bench Press');
    expect(screen.queryByRole('button', { name: /Barbell Bench Press/ })).toBeNull();
  });

  it('ranks closer names first and matches words in any order', async () => {
    const u = userEvent.setup();
    renderWith(<NameField onPick={() => {}} />);
    await u.type(screen.getByLabelText('Lift'), 'press bench');
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names[0]).toMatch(/^Barbell Bench Press/);
    expect(names).toHaveLength(2);
  });

  it('keeps a free-typed name that matches nothing', async () => {
    const u = userEvent.setup();
    renderWith(<NameField onPick={() => {}} />);
    const input = screen.getByLabelText('Lift');
    await u.type(input, 'Med ball chest pass');
    expect(input).toHaveValue('Med ball chest pass');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('clears after adding when uncontrolled', async () => {
    const u = userEvent.setup();
    const onAdd = vi.fn();
    renderWith(<ExerciseQuickAdd label="Add an exercise" onAdd={onAdd} />);
    const input = screen.getByLabelText('Add an exercise');
    await u.type(input, 'squat');
    await u.click(screen.getByRole('button', { name: /Back Squat/ }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'squat' }));
    expect(input).toHaveValue('');
  });
});
