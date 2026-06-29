import { describe, it, expect } from 'vitest';
import { effortAdjustedE1RM } from './e1rm';

describe('effortAdjustedE1RM', () => {
  it('equals a plain Epley estimate at 0 RIR (taken to failure)', () => {
    expect(effortAdjustedE1RM(100, 10, 0)).toBeCloseTo(133.3, 1);
  });
  it('treats reps-in-reserve as additional effective reps', () => {
    expect(effortAdjustedE1RM(100, 8, 2)).toBeCloseTo(effortAdjustedE1RM(100, 10, 0), 5);
  });
  it('defaults to failure (rir=0) when rir is undefined', () => {
    expect(effortAdjustedE1RM(100, 10)).toBeCloseTo(effortAdjustedE1RM(100, 10, 0), 5);
  });
  it('returns the load itself for a 1-rep max effort', () => {
    expect(effortAdjustedE1RM(200, 1, 0)).toBeCloseTo(200, 1);
  });
});
