import { describe, it, expect } from 'vitest';
import { welcomeBackSuggestion } from './welcomeBack';
import type { WelcomeBackRecommendation } from './welcomeBack';

const recA: WelcomeBackRecommendation = {
  exerciseId: 'A',
  daysSinceLastWorkout: 25, // ~3.5 weeks → optional 10%
  previousWeight: 100,
};

describe('welcomeBackSuggestion', () => {
  it('offers the suggestion (real % + passed-through previous load) for a matching, unanswered rec', () => {
    const view = welcomeBackSuggestion(recA, 'A', new Set());
    expect(view).not.toBeNull();
    expect(view!.suggestion.reductionPct).toBe(10);
    expect(view!.suggestion.suggestedWeight).toBe(90); // round5(100 * 0.9)
    expect(view!.previousWeight).toBe(100); // verbatim base, no inverse arithmetic
  });

  it('returns null for a null/undefined recommendation', () => {
    expect(welcomeBackSuggestion(null, 'A', new Set())).toBeNull();
    expect(welcomeBackSuggestion(undefined, 'A', new Set())).toBeNull();
  });

  it('ignores a STALE rec belonging to a different exercise (guards the name/number flash)', () => {
    // The async hook still holds exercise A's rec while we've navigated to B.
    expect(welcomeBackSuggestion(recA, 'B', new Set())).toBeNull();
  });

  it('PIN C1: an answered exercise stays suppressed across navigation (superset rounds / back-nav)', () => {
    // First arrival at A shows the prompt.
    expect(welcomeBackSuggestion(recA, 'A', new Set())).not.toBeNull();

    // Lifter answers A (applied or kept) → A is now in the answered set.
    const answered = new Set<string>(['A']);

    // Superset cycles A→B→A or the lifter taps back: same rec, same id — must
    // stay hidden (the old index-keyed flag re-popped here).
    expect(welcomeBackSuggestion(recA, 'A', answered)).toBeNull();

    // A different exercise B (its own layoff rec) is unaffected by A's answer.
    const recB: WelcomeBackRecommendation = { exerciseId: 'B', daysSinceLastWorkout: 40, previousWeight: 80 };
    expect(welcomeBackSuggestion(recB, 'B', answered)).not.toBeNull();
  });

  it('returns null for a normal cadence (gap under 3 weeks → delegate yields nothing)', () => {
    const recent: WelcomeBackRecommendation = { exerciseId: 'A', daysSinceLastWorkout: 10, previousWeight: 100 };
    expect(welcomeBackSuggestion(recent, 'A', new Set())).toBeNull();
  });

  it('returns null when there is no daysSinceLastWorkout (no prior history to gauge a gap)', () => {
    const noGap: WelcomeBackRecommendation = { exerciseId: 'A', previousWeight: 100 };
    expect(welcomeBackSuggestion(noGap, 'A', new Set())).toBeNull();
  });

  it('falls back to recommendedWeight when previousWeight is absent', () => {
    const rec: WelcomeBackRecommendation = { exerciseId: 'A', daysSinceLastWorkout: 25, recommendedWeight: 100 };
    const view = welcomeBackSuggestion(rec, 'A', new Set());
    expect(view!.previousWeight).toBe(100);
    expect(view!.suggestion.suggestedWeight).toBe(90);
  });

  it('returns null when there is no last load to act on', () => {
    const noWeight: WelcomeBackRecommendation = { exerciseId: 'A', daysSinceLastWorkout: 25 };
    expect(welcomeBackSuggestion(noWeight, 'A', new Set())).toBeNull();
  });
});
