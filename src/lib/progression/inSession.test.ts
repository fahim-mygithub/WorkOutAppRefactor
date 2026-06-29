import { describe, it, expect } from 'vitest';
import { decideInSession, inSessionSuggestion } from './inSession';
import { round5 } from './round';

// Three working sets, currently on set 1 of 3 (more remain) so an in-session
// change is still actionable.
const SET_INDEX = 0;
const TOTAL_SETS = 3;

describe('decideInSession — player wiring', () => {
  it('surfaces a ~10% reduce off the LOGGED weight on a slight miss of the range floor', () => {
    const prescribed = { reps: 10, repMin: 10, repMax: 15 };
    const d = decideInSession(prescribed, { reps: 8, weight: 95 }, SET_INDEX, TOTAL_SETS);
    expect(d.action).toBe('reduce');
    expect(d.suggestedWeight).toBe(round5(95 * 0.9)); // 85, off the lifted load
  });

  it('surfaces no cut when the lifter hits the range', () => {
    const prescribed = { reps: 10, repMin: 10, repMax: 15 };
    const d = decideInSession(prescribed, { reps: 12, weight: 95, rir: 2 }, SET_INDEX, TOTAL_SETS);
    expect(d.action).toBe('continue');
    expect(d.suggestedWeight).toBeUndefined();
  });

  it('falls back to the single configured reps when no explicit range is set', () => {
    // repMin/repMax absent -> floor is `reps` (8). Logging 5 is a miss.
    const prescribed = { reps: 8 };
    const d = decideInSession(prescribed, { reps: 5, weight: 100 }, SET_INDEX, TOTAL_SETS);
    expect(d.action).toBe('reduce');
    expect(d.suggestedWeight).toBe(round5(100 * 0.85)); // 6+ under floor -> bigger reset
  });

  it('is reachable without any account/uid — the decision is pure and reads only the set', () => {
    // No user id is threaded anywhere here; an anonymous/demo lifter gets the same cue.
    const prescribed = { reps: 10, repMin: 10, repMax: 15 };
    const d = decideInSession(prescribed, { reps: 9, weight: 60 }, SET_INDEX, TOTAL_SETS);
    expect(d.action).toBe('reduce');
    expect(d.suggestedWeight).toBe(round5(60 * 0.9)); // 55
    expect(d.message).toBeTruthy();
  });
});

describe('inSessionSuggestion — card gating', () => {
  const ranged = { reps: 10, repMin: 10, repMax: 15 };

  it('returns the decision when it is an actionable reduce', () => {
    const s = inSessionSuggestion(ranged, { reps: 8, weight: 95 }, SET_INDEX, TOTAL_SETS);
    expect(s?.action).toBe('reduce');
    expect(s?.suggestedWeight).toBe(round5(95 * 0.9));
  });

  it('returns null on a good set (continue stays silent)', () => {
    const s = inSessionSuggestion(ranged, { reps: 12, weight: 95, rir: 2 }, SET_INDEX, TOTAL_SETS);
    expect(s).toBeNull();
  });

  it('returns null on the last set (end stays silent)', () => {
    const s = inSessionSuggestion(ranged, { reps: 8, weight: 95 }, 2, 3);
    expect(s).toBeNull();
  });
});
