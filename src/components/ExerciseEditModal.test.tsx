import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkoutExercise } from '../types/exercise';
import { ExerciseEditModal } from './ExerciseEditModal';

const exercise = {
  id: 'we-bench',
  exercise: { id: 'x-bench', name: 'Barbell Bench Press' },
  restTime: 90,
  sets: [
    { id: 's1', reps: 8, weight: 100, completed: false },
    { id: 's2', reps: 8, weight: 100, completed: false },
  ],
} as unknown as WorkoutExercise;

function renderModal(onSave = vi.fn()) {
  render(
    <ExerciseEditModal
      isOpen
      exercise={exercise}
      onClose={vi.fn()}
      onSave={onSave}
    />,
  );
  return { onSave };
}

describe('ExerciseEditModal number fields', () => {
  it('clearing the weight and typing 25 gives 25, not 025', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    const weight = screen.getByLabelText('Set 1 weight in pounds');

    await user.clear(weight);
    expect(weight).toHaveValue('');
    await user.type(weight, '25');
    expect(weight).toHaveValue('25');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][1][0]).toMatchObject({ weight: 25 });
  });

  it('clearing the reps and typing 10 gives 10, not 010', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    const reps = screen.getByLabelText('Set 1 reps');

    await user.clear(reps);
    await user.type(reps, '10');
    expect(reps).toHaveValue('10');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onSave.mock.calls[0][1][0]).toMatchObject({ reps: 10 });
  });

  it('accepts decimal weights such as 22.5', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    const weight = screen.getByLabelText('Set 2 weight in pounds');

    await user.clear(weight);
    await user.type(weight, '22.5');
    expect(weight).toHaveValue('22.5');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onSave.mock.calls[0][1][1]).toMatchObject({ weight: 22.5 });
  });

  it('clearing the rest time and typing 120 gives 120 with no leading zero', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    const rest = screen.getByLabelText('Rest between sets (seconds)');

    await user.clear(rest);
    await user.type(rest, '120');
    expect(rest).toHaveValue('120');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onSave.mock.calls[0][2]).toBe(120);
  });

  it('a field left blank keeps its previous value on blur and on save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    const weight = screen.getByLabelText('Set 1 weight in pounds');

    await user.clear(weight);
    await user.tab();
    expect(weight).toHaveValue('100');
    // Nothing changed after the revert, so there is nothing to save.
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects non-numeric keystrokes in the weight field', async () => {
    const user = userEvent.setup();
    renderModal();
    const weight = screen.getByLabelText('Set 1 weight in pounds');

    await user.clear(weight);
    await user.type(weight, '1a2');
    expect(weight).toHaveValue('12');
  });
});
