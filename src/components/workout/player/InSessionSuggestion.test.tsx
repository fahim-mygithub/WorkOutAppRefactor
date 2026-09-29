import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InSessionSuggestion } from './InSessionSuggestion';
import type { InSessionDecision } from '@/types/progression';

// The card is pure presentation — it renders with no auth context, store, or uid,
// which is exactly why the in-session cue is reachable for anonymous/demo users.

const reduce: InSessionDecision = {
  action: 'reduce',
  suggestedWeight: 85,
  message: 'A touch short of the range — drop ~10% to finish the working sets in range.',
};

describe('InSessionSuggestion', () => {
  it('renders the message and the suggested weight as an Apply action', () => {
    render(<InSessionSuggestion decision={reduce} onApply={vi.fn()} onKeep={vi.fn()} />);
    expect(screen.getByText(/touch short of the range/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use 85 lb/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep/i })).toBeInTheDocument();
  });

  it('applies the suggested weight (off the lifted load) when Use is tapped', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<InSessionSuggestion decision={reduce} onApply={onApply} onKeep={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /use 85 lb/i }));
    expect(onApply).toHaveBeenCalledWith(85);
  });

  it('dismisses via Keep without applying', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onKeep = vi.fn();
    render(<InSessionSuggestion decision={reduce} onApply={onApply} onKeep={onKeep} />);
    await user.click(screen.getByRole('button', { name: /keep/i }));
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('offers only Keep when there is no numeric weight to apply (e.g. bodyweight)', () => {
    const noWeight: InSessionDecision = { action: 'repeat', message: 'Switch to an easier variation.' };
    render(<InSessionSuggestion decision={noWeight} onApply={vi.fn()} onKeep={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /use/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep/i })).toBeInTheDocument();
  });

  it('offers Ask coach when wired', async () => {
    const user = userEvent.setup();
    const onAskCoach = vi.fn();
    const onApply = vi.fn();
    render(<InSessionSuggestion decision={reduce} onApply={onApply} onKeep={vi.fn()} onAskCoach={onAskCoach} />);
    await user.click(screen.getByRole('button', { name: /ask coach/i }));
    expect(onAskCoach).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('has no Ask coach without the handler', () => {
    render(<InSessionSuggestion decision={reduce} onApply={vi.fn()} onKeep={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /ask coach/i })).not.toBeInTheDocument();
  });
});
