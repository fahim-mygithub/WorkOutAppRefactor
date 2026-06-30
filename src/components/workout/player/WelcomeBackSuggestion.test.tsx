import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeBackSuggestion } from './WelcomeBackSuggestion';
import type { LayoffSuggestion } from '@/lib/progression';

// The percentage MUST come from the suggestion (the old modal hardcoded −15%).
const tenPct: LayoffSuggestion = {
  suggestedWeight: 90,
  reductionPct: 10,
  optional: true,
  message: '~3 weeks off — optional 10% lighter to ease back in',
};

const twentyPct: LayoffSuggestion = {
  suggestedWeight: 80,
  reductionPct: 20,
  optional: true,
  message: '~6 weeks off — optional 20% lighter to ease back in',
};

describe('WelcomeBackSuggestion', () => {
  it('renders the REAL percentage (10%, never the old hardcoded 15%) and the suggested weight', async () => {
    render(
      <WelcomeBackSuggestion
        suggestion={tenPct}
        previousWeight={100}
        exerciseName="Bench Press"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await screen.findByRole('dialog'); // wait for the portal/sheet to mount

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    // The message and the badge both carry "10%"; the point is the dynamic value
    // is present and the stale hardcoded 15% is NOT.
    expect(screen.getAllByText(/10%/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/15%/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use 90 lb/i })).toBeInTheDocument();
  });

  it('shows the REAL previous weight passed in (no inverse reconstruction)', async () => {
    render(
      <WelcomeBackSuggestion
        suggestion={tenPct}
        previousWeight={100}
        exerciseName="Bench Press"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await screen.findByRole('dialog');
    expect(screen.getByText(/100 lb/i)).toBeInTheDocument();
  });

  it('renders an off-grid previous weight verbatim (e.g. 52.5, not double-rounded to 50)', async () => {
    // round5(suggestedWeight/(1−pct/100)) used to drift this; the prop is shown as-is.
    const offGrid: LayoffSuggestion = {
      suggestedWeight: 47.5,
      reductionPct: 10,
      optional: true,
      message: '~3 weeks off — optional 10% lighter to ease back in',
    };
    render(
      <WelcomeBackSuggestion
        suggestion={offGrid}
        previousWeight={52.5}
        exerciseName="Lateral Raise"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await screen.findByRole('dialog');
    expect(screen.getByText(/52\.5 lb/i)).toBeInTheDocument();
    expect(screen.queryByText(/50 lb/i)).not.toBeInTheDocument();
  });

  it('applies the suggested (lighter) load when "Use" is tapped', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <WelcomeBackSuggestion
        suggestion={tenPct}
        previousWeight={100}
        exerciseName="Bench Press"
        onApply={onApply}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /use 90 lb/i }));
    expect(onApply).toHaveBeenCalledWith(90);
  });

  it('keeps the full load (dismisses without applying) via "Keep full load"', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(
      <WelcomeBackSuggestion
        suggestion={tenPct}
        previousWeight={100}
        exerciseName="Bench Press"
        onApply={onApply}
        onDismiss={onDismiss}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /keep full load/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('dismisses when the sheet is closed via Escape (backdrop/Escape path)', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <WelcomeBackSuggestion
        suggestion={tenPct}
        previousWeight={100}
        exerciseName="Bench Press"
        onApply={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders a 20% suggestion dynamically — the percentage is never hardcoded', async () => {
    render(
      <WelcomeBackSuggestion
        suggestion={twentyPct}
        previousWeight={100}
        exerciseName="Back Squat"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await screen.findByRole('dialog');

    expect(screen.getAllByText(/20%/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/10%/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use 80 lb/i })).toBeInTheDocument();
  });
});
