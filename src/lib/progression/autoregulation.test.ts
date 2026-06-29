import { describe, it, expect } from 'vitest';
import { inSessionDecision } from './autoregulation';

// repMin 8, repMax 12, three working sets, currently on set 1 of 3 (more remain).
const mid = { repMin: 8, repMax: 12, weight: 100, setIndex: 0, totalSets: 3 };

describe('inSessionDecision', () => {
  it('continues with encouragement when the range is hit with reps in reserve', () => {
    const d = inSessionDecision(mid, { reps: 10, weight: 100, rir: 2 });
    expect(d.action).toBe('continue');
    expect(d.suggestedWeight).toBeUndefined();
    expect(d.message).toBeTruthy();
  });

  it('treats a missing rir as reps-in-reserve (continue, no cut)', () => {
    const d = inSessionDecision(mid, { reps: 10, weight: 100 });
    expect(d.action).toBe('continue');
    expect(d.suggestedWeight).toBeUndefined();
  });

  it('does NOT cut after hitting the range to failure when sets remain — fine to hold', () => {
    const d = inSessionDecision(mid, { reps: 10, weight: 100, rir: 0 });
    expect(d.action).toBe('continue');
    expect(d.suggestedWeight).toBeUndefined();
    expect(d.message).toMatch(/failure|hold/i);
  });

  it('reduces ~10% (off the weight actually lifted) on a slight miss with sets remaining', () => {
    const d = inSessionDecision(mid, { reps: 7, weight: 100 }); // repMin-2 <= 7 < repMin
    expect(d.action).toBe('reduce');
    expect(d.suggestedWeight).toBe(90);
  });

  it('derives the cut from the logged weight, never a historical target', () => {
    // target says 100 but the lifter actually used 95 — cut must come off 95.
    const d = inSessionDecision(mid, { reps: 7, weight: 95 });
    expect(d.action).toBe('reduce');
    expect(d.suggestedWeight).toBe(85); // round5(95 * 0.9) = round5(85.5) = 85
  });

  it('reduces ~15% with a reset message on a bad miss with sets remaining', () => {
    const d = inSessionDecision(mid, { reps: 4, weight: 100 }); // reps < repMin-2
    expect(d.action).toBe('reduce');
    expect(d.suggestedWeight).toBe(85); // round5(100 * 0.85)
    expect(d.message).toMatch(/reset/i);
  });

  it('ends with a next-session note on the last set, regardless of performance', () => {
    const last = { repMin: 8, repMax: 12, weight: 100, setIndex: 2, totalSets: 3 };
    const d = inSessionDecision(last, { reps: 4, weight: 100 });
    expect(d.action).toBe('end');
    expect(d.suggestedWeight).toBeUndefined();
    expect(d.message).toMatch(/next session/i);
  });

  it('ends a single-set exercise (no in-session change possible)', () => {
    const single = { repMin: 8, repMax: 12, weight: 100, setIndex: 0, totalSets: 1 };
    const d = inSessionDecision(single, { reps: 10, weight: 100 });
    expect(d.action).toBe('end');
  });

  it('never returns a numeric cut for a bodyweight set with sets remaining', () => {
    const bw = { repMin: 5, repMax: 10, weight: 0, setIndex: 0, totalSets: 3 };
    const d = inSessionDecision(bw, { reps: 3, weight: 0 });
    expect(d.action).toBe('continue');
    expect(d.suggestedWeight).toBeUndefined();
    expect(d.message).toMatch(/variation|form/i);
  });

  it('ends a bodyweight set on the last set with a variation note (no cut)', () => {
    const bw = { repMin: 5, repMax: 10, weight: 0, setIndex: 2, totalSets: 3 };
    const d = inSessionDecision(bw, { reps: 3, weight: 0 });
    expect(d.action).toBe('end');
    expect(d.suggestedWeight).toBeUndefined();
    expect(d.message).toMatch(/variation|form/i);
  });
});
