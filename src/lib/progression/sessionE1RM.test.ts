import { describe, it, expect } from 'vitest';
import { bestSetE1RM, smoothedSessionE1RM } from './sessionE1RM';
import { effortAdjustedE1RM } from './e1rm';

describe('bestSetE1RM', () => {
  it('is 0 for an empty session', () => {
    expect(bestSetE1RM([])).toBe(0);
  });
  it('returns the max effort-adjusted e1RM across the sets', () => {
    const sets = [
      { weight: 100, reps: 1 },
      { weight: 120, reps: 1 },
      { weight: 90, reps: 1 },
    ];
    expect(bestSetE1RM(sets)).toBeCloseTo(120, 5);
  });
  it('accounts for reps-in-reserve when picking the best set', () => {
    const sets = [{ weight: 100, reps: 8, rir: 2 }];
    expect(bestSetE1RM(sets)).toBeCloseTo(effortAdjustedE1RM(100, 8, 2), 5);
  });
});

describe('smoothedSessionE1RM', () => {
  it('returns null when there is no history', () => {
    expect(smoothedSessionE1RM([])).toBeNull();
  });
  it('returns the single session best when there is one session', () => {
    expect(smoothedSessionE1RM([[{ weight: 150, reps: 1 }]])).toBeCloseTo(150, 5);
  });
  it('averages the two middle bests for an even number of sessions', () => {
    const sessions = [[{ weight: 100, reps: 1 }], [{ weight: 200, reps: 1 }]];
    expect(smoothedSessionE1RM(sessions)).toBeCloseTo(150, 5);
  });
  it('takes the median of the per-session bests', () => {
    const sessions = [
      [{ weight: 100, reps: 1 }],
      [{ weight: 200, reps: 1 }],
      [{ weight: 150, reps: 1 }],
    ];
    // median of [100, 200, 150] = 150 (a single PR set does not jump the program)
    expect(smoothedSessionE1RM(sessions)).toBeCloseTo(150, 5);
  });
  it('caps to the last `window` sessions', () => {
    const sessions = [
      [{ weight: 50, reps: 1 }],
      [{ weight: 60, reps: 1 }],
      [{ weight: 70, reps: 1 }],
      [{ weight: 80, reps: 1 }],
      [{ weight: 90, reps: 1 }],
    ];
    // last 3 bests = [70, 80, 90] -> median 80; the first two are ignored
    expect(smoothedSessionE1RM(sessions, 3)).toBeCloseTo(80, 5);
  });
  it('returns null when every session is empty (no usable load data)', () => {
    expect(smoothedSessionE1RM([[]])).toBeNull();
  });
  it('ignores empty sessions instead of letting their 0 poison the median', () => {
    expect(smoothedSessionE1RM([[], [{ weight: 150, reps: 1 }]])).toBeCloseTo(150, 5);
  });
});
