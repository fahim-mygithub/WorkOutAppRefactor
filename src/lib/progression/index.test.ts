import { describe, it, expect } from 'vitest';
import * as progression from './index';
import type {
  Prescription,
  LastSession,
  NextPrescription,
  SetTarget,
  LoggedSet,
  LayoffInput,
  LayoffSuggestion,
} from './index';

describe('progression barrel', () => {
  it('re-exports every public function from the five core modules', () => {
    expect(typeof progression.effortAdjustedE1RM).toBe('function');
    expect(typeof progression.bestSetE1RM).toBe('function');
    expect(typeof progression.smoothedSessionE1RM).toBe('function');
    expect(typeof progression.nextDoubleProgression).toBe('function');
    expect(typeof progression.inSessionDecision).toBe('function');
    expect(typeof progression.returnFromLayoffSuggestion).toBe('function');
  });

  // Compile-time contract: the strict-paths typecheck fails if any of these
  // public types are not exported by name from the barrel (Phase 3 imports them).
  it('re-exports the public contract types by name', () => {
    const prescription: Prescription = { repMin: 8, repMax: 12, sets: 3 };
    const last: LastSession = { weight: 100, reps: [12, 12, 12] };
    const set: LoggedSet = { weight: 100, reps: 10, rir: 1 };
    const target: SetTarget = { repMin: 8, repMax: 12, weight: 100, setIndex: 0, totalSets: 3 };
    const layoffIn: LayoffInput = { daysSinceLastWorkout: 30, lastWeight: 100 };
    const next: NextPrescription = progression.nextDoubleProgression(prescription, last, 5);
    const suggestion: LayoffSuggestion | null = progression.returnFromLayoffSuggestion(layoffIn);
    expect(next.repMin).toBe(8);
    expect(set.reps).toBe(10);
    expect(target.totalSets).toBe(3);
    expect(suggestion).not.toBeNull();
  });
});
