import { describe, it, expect } from 'vitest';
import {
  addedLoadForReps,
  pullupTrainable1RM,
  smoothedPullupTrainable1RM,
} from './progression';

const BW = 180;

describe('pullupTrainable1RM', () => {
  it('nets out bodyweight (a 1-rep set ⇒ trainable max == added load)', () => {
    expect(pullupTrainable1RM(100, BW, 1)).toBeCloseTo(100, 5);
  });

  it('is RIR-aware: reserve reps count as a heavier max', () => {
    // 90×5 @ RIR 3 is estimated as a max-effort 90×8.
    expect(pullupTrainable1RM(90, BW, 5, 0)).toBeCloseTo(135, 5); // e1RM(270,5) − 180
    expect(pullupTrainable1RM(90, BW, 5, 3)).toBeCloseTo(162, 5); // e1RM(270,8) − 180
  });

  it('clamps to 0 when nothing is trainable', () => {
    expect(pullupTrainable1RM(0, BW, 0)).toBe(0);
  });
});

describe('smoothedPullupTrainable1RM', () => {
  it('takes the median across sessions — a lone heavy session does not dominate', () => {
    // 1-rep sets ⇒ per-session trainable best == added load: [100, 300, 120].
    const sessions = [
      [{ weight: 100, reps: 1 }],
      [{ weight: 300, reps: 1 }],
      [{ weight: 120, reps: 1 }],
    ];
    expect(smoothedPullupTrainable1RM(sessions, BW)).toBe(120); // median, not the 300 PR
    expect(smoothedPullupTrainable1RM(sessions, BW)!).toBeLessThan(300);
  });

  it('caps to the last `window` sessions', () => {
    const sessions = [
      [{ weight: 250, reps: 1 }],
      [{ weight: 260, reps: 1 }],
      [{ weight: 80, reps: 1 }],
      [{ weight: 90, reps: 1 }],
      [{ weight: 100, reps: 1 }],
    ];
    // default window 3 → last 3 bests [80,90,100] → median 90 (the 250/260 drop out).
    expect(smoothedPullupTrainable1RM(sessions, BW)).toBe(90);
    // window 2 → last 2 bests [90,100] → median 95.
    expect(smoothedPullupTrainable1RM(sessions, BW, 2)).toBe(95);
  });

  it('is RIR-aware: the same logged set at higher RIR yields a higher trainable max', () => {
    const base = smoothedPullupTrainable1RM([[{ weight: 90, reps: 5 }]], BW)!;
    const withRir = smoothedPullupTrainable1RM([[{ weight: 90, reps: 5, rir: 3 }]], BW)!;
    expect(base).toBeCloseTo(135, 5);
    expect(withRir).toBeCloseTo(162, 5);
    expect(withRir).toBeGreaterThan(base);
  });

  it('returns null with no usable history', () => {
    expect(smoothedPullupTrainable1RM([], BW)).toBeNull();
    expect(smoothedPullupTrainable1RM([[]], BW)).toBeNull();
  });
});

describe('addedLoadForReps', () => {
  it('inverts the trainable max to the added load for the target reps', () => {
    // trainable 135 over bodyweight 180 ⇒ +90 to net 5 reps (round-trip of the test above).
    expect(addedLoadForReps(135, BW, 5, 'bodyweight')).toBe(90);
  });

  it('clamps to 0 when the target reps exceed bodyweight strength', () => {
    expect(addedLoadForReps(5, BW, 12, 'bodyweight')).toBe(0);
  });
});
