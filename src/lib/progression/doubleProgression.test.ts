import { describe, it, expect } from 'vitest';
import { nextDoubleProgression } from './doubleProgression';

const p = { repMin: 8, repMax: 12, sets: 3 };

describe('nextDoubleProgression', () => {
  it('starts at the range floor with weight 0 on the first session (caller supplies seed)', () => {
    const next = nextDoubleProgression(p, null, 5);
    expect(next.weight).toBe(0);
    expect(next.repTarget).toBe(8);
    expect(next.repMin).toBe(8);
    expect(next.repMax).toBe(12);
    expect(next.advanced).toBe(false);
    expect(next.reason).toMatch(/first session/i);
  });

  it('adds load and resets to the floor when every set hits the top (rir absent)', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [12, 12, 12] }, 5);
    expect(next.weight).toBe(105);
    expect(next.repTarget).toBe(8);
    expect(next.advanced).toBe(true);
    expect(next.reason).toMatch(/added|load|5/i);
  });

  it('advances when every set hits the top and effort is sufficient (rir <= 1)', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [12, 12, 12], rir: [1, 0, 1] }, 5);
    expect(next.weight).toBe(105);
    expect(next.advanced).toBe(true);
  });

  it('does NOT advance when the top was hit but effort was too easy (rir > 1)', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [12, 12, 12], rir: [3, 3, 3] }, 5);
    expect(next.weight).toBe(100);
    expect(next.advanced).toBe(false);
    expect(next.repTarget).toBe(12);
  });

  it('holds the weight and nudges the rep target up when the floor was hit but not the top', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [10, 9, 8] }, 5);
    expect(next.weight).toBe(100);
    expect(next.repTarget).toBe(11); // max(10,9,8) + 1
    expect(next.advanced).toBe(false);
    expect(next.reason).toMatch(/re-earn the top of the range/i);
  });

  it('caps the nudged rep target at repMax', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [12, 11, 10] }, 5);
    expect(next.weight).toBe(100);
    expect(next.repTarget).toBe(12); // min(repMax, 12 + 1)
    expect(next.advanced).toBe(false);
  });

  it('rebuilds to the range floor after a missed session (top set below repMin)', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [6, 5, 5] }, 5);
    expect(next.weight).toBe(100);
    expect(next.repTarget).toBe(8);
    expect(next.advanced).toBe(false);
    expect(next.reason).toMatch(/rebuild to range floor/i);
  });

  it('never advances on an empty session (no logged sets is not a PR)', () => {
    const next = nextDoubleProgression(p, { weight: 100, reps: [] }, 5);
    expect(next.advanced).toBe(false);
    expect(next.weight).not.toBe(105);
  });

  it('holds (does not advance) when fewer sets than prescribed were logged, even at the top', () => {
    // 2 logged sets against a 3-set prescription — incomplete, so no load jump.
    const next = nextDoubleProgression(p, { weight: 100, reps: [12, 12] }, 5);
    expect(next.advanced).toBe(false);
    expect(next.weight).toBe(100);
  });
});
