import { describe, it, expect } from 'vitest';
import { fromFlatLift } from './liftFields';

describe('fromFlatLift', () => {
  it('reads a weighted rep max', () => {
    expect(fromFlatLift({ loadKind: 'weight', weight: 265, unit: 'lb', targetKind: 'repMax', reps: 1 }))
      .toEqual({ load: { kind: 'weight', value: 265, unit: 'lb' }, target: { kind: 'repMax', reps: 1 } });
  });
  it('reads a level with a timed hold', () => {
    expect(fromFlatLift({ loadKind: 'level', level: 'Band: red', targetKind: 'time', seconds: 45, tempo: '3-1-3' }))
      .toEqual({ load: { kind: 'level', label: 'Band: red' }, target: { kind: 'time', seconds: 45, tempo: '3-1-3' } });
  });
  it('reads bodyweight plus', () => {
    expect(fromFlatLift({ loadKind: 'bodyweight', weight: 25, unit: 'lb', targetKind: 'reps', reps: 8, repsMax: 12 }))
      .toEqual({ load: { kind: 'bodyweight', plus: { value: 25, unit: 'lb' } }, target: { kind: 'reps', min: 8, max: 12 } });
  });
  it('reads plain bodyweight, kg, and drops a range that is not a range', () => {
    expect(fromFlatLift({ loadKind: 'bodyweight', targetKind: 'reps', reps: 10, repsMax: 10 }))
      .toEqual({ load: { kind: 'bodyweight' }, target: { kind: 'reps', min: 10 } });
    expect(fromFlatLift({ loadKind: 'weight', weight: 100, unit: 'kg', targetKind: 'none' }))
      .toEqual({ load: { kind: 'weight', value: 100, unit: 'kg' }, target: { kind: 'none' } });
  });
  it('returns null when required fields are missing', () => {
    expect(fromFlatLift({ loadKind: 'weight', targetKind: 'reps', reps: 5 })).toBeNull();
    expect(fromFlatLift({ loadKind: 'level', targetKind: 'none' })).toBeNull();
    expect(fromFlatLift({ loadKind: 'weight', weight: 100, targetKind: 'repMax' })).toBeNull();
    expect(fromFlatLift({ loadKind: 'weight', weight: 100, targetKind: 'time' })).toBeNull();
  });
});
