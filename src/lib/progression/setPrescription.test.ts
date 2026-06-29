import { describe, it, expect } from 'vitest';
import { prescribedFloor, formatRepRange } from './setPrescription';

describe('prescribedFloor', () => {
  it('uses repMin when a range is prescribed', () => {
    expect(prescribedFloor({ reps: 13, repMin: 10 })).toBe(10);
  });

  it('falls back to the single configured reps when repMin is absent', () => {
    expect(prescribedFloor({ reps: 8 })).toBe(8);
  });

  it('uses repMin even when it equals the single rep count', () => {
    expect(prescribedFloor({ reps: 8, repMin: 8 })).toBe(8);
  });
});

describe('formatRepRange', () => {
  it('renders the en-dash range when floor and ceiling differ', () => {
    expect(formatRepRange({ repMin: 10, repMax: 15 })).toBe('10–15');
  });

  it('returns null when the bounds are equal (single target)', () => {
    expect(formatRepRange({ repMin: 8, repMax: 8 })).toBeNull();
  });

  it('returns null when either bound is absent', () => {
    expect(formatRepRange({ repMin: 10 })).toBeNull();
    expect(formatRepRange({ repMax: 15 })).toBeNull();
    expect(formatRepRange({})).toBeNull();
  });
});
