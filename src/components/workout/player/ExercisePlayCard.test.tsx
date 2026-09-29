import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Exercise, WorkoutExercise } from '../../../types/exercise';
import { ExercisePlayCard } from './ExercisePlayCard';

const ex = {
  id: 'e1',
  exercise: { id: 'x-bench', name: 'Bench Press' } as Exercise,
  sets: [0, 1, 2].map((k) => ({ id: `s${k}`, reps: 5, weight: 225, unit: 'lbs', completed: false })),
} as WorkoutExercise;

function renderCard(extra: Partial<React.ComponentProps<typeof ExercisePlayCard>> = {}) {
  return render(
    <ExercisePlayCard
      exercise={ex}
      currentSetIndex={0}
      currentSet={ex.sets[0]}
      supersetPartners={[]}
      previousPerformance={null}
      onEditSets={vi.fn()}
      onCompleteSet={vi.fn()}
      onUncompleteSet={vi.fn()}
      onJumpToSet={vi.fn()}
      {...extra}
    />,
  );
}

describe('ExercisePlayCard Ask coach link', () => {
  it('shows an Ask coach link under the set input when wired', async () => {
    const onAskCoachGeneral = vi.fn();
    renderCard({ onAskCoachGeneral });
    await userEvent.setup().click(screen.getByRole('button', { name: /ask coach/i }));
    expect(onAskCoachGeneral).toHaveBeenCalledOnce();
  });

  it('pads the link hit area to the 44px touch minimum without changing layout', () => {
    renderCard({ onAskCoachGeneral: vi.fn() });
    const link = screen.getByRole('button', { name: /ask coach/i });
    // 12px × 1.4 caption + py-1 ≈ 24.8px; a 10px pseudo-element above and below → ≈ 44.8px.
    expect(link).toHaveClass('relative', 'after:absolute', 'after:-inset-y-2.5', "after:content-['']");
  });

  it('has no Ask coach link without the handler', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /ask coach/i })).not.toBeInTheDocument();
  });

  it('threads onAskCoach into the in-session suggestion', async () => {
    const onAskCoach = vi.fn();
    renderCard({
      suggestion: { action: 'reduce', suggestedWeight: 205, message: 'Missed by 2' },
      onApplySuggestion: vi.fn(),
      onKeepSuggestion: vi.fn(),
      onAskCoach,
    });
    await userEvent.setup().click(screen.getByRole('button', { name: /ask coach/i }));
    expect(onAskCoach).toHaveBeenCalledOnce();
  });

  it('shows one Ask coach (the suggestion chip) while a suggestion is up', () => {
    renderCard({
      suggestion: { action: 'reduce', suggestedWeight: 205, message: 'Missed by 2' },
      onApplySuggestion: vi.fn(),
      onKeepSuggestion: vi.fn(),
      onAskCoach: vi.fn(),
      onAskCoachGeneral: vi.fn(),
    });
    expect(screen.getAllByRole('button', { name: /ask coach/i })).toHaveLength(1);
  });
});
