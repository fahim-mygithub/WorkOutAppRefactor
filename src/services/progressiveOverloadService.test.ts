import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the history service so no Firebase loads and we control the "first time"
// (no prior history) branch deterministically.
vi.mock('@/services/exerciseHistoryService', () => ({
  ExerciseHistoryService: {
    getExerciseHistory: vi.fn().mockResolvedValue([]),
  },
}));

import { ProgressiveOverloadService } from '@/services/progressiveOverloadService';
import { ExerciseHistoryService } from '@/services/exerciseHistoryService';
import type { Exercise } from '@/types/exercise';
import type { ExerciseHistory, PerformedSet } from '@/types/exerciseHistory';

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Build a minimal valid ExerciseHistory for the dumbbell-bench fixture below. */
function makeHistory(opts: {
  weight: number;
  actualReps: number[];
  targetReps: number;
  workoutDate?: Date;
  rir?: number[];
}): ExerciseHistory {
  const { weight, actualReps, targetReps, workoutDate = daysAgo(3), rir } = opts;
  const sets: PerformedSet[] = actualReps.map((reps, i) => ({
    setNumber: i + 1,
    targetReps,
    actualReps: reps,
    weight,
    unit: 'lbs',
    completed: reps >= targetReps,
    ...(rir ? { rir: rir[i] } : {}),
  }));
  return {
    id: 'hist-1',
    userId: 'user-1',
    exerciseId: 'db-bench',
    exerciseName: 'Dumbbell Bench Press',
    workoutDate,
    sets,
    configuration: `${sets.length}x${targetReps}`,
    muscleGroups: ['Chest'],
    equipment: 'Dumbbells',
    totalVolume: sets.reduce((v, s) => v + s.weight * s.actualReps, 0),
  };
}

/** Point the mocked history service at a single prior session (or none). */
function mockHistory(history: ExerciseHistory | null): void {
  (ExerciseHistoryService.getExerciseHistory as ReturnType<typeof vi.fn>).mockResolvedValue(
    history ? [history] : [],
  );
}

const dumbbellBench: Exercise = {
  id: 'db-bench',
  name: 'Dumbbell Bench Press',
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Dumbbells',
  videoLinks: [],
  instructions: [],
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  searchKeywords: ['dumbbell bench press'],
  createdAt: '',
  updatedAt: '',
};

describe('ProgressiveOverloadService.getRecommendation — first session', () => {
  beforeEach(() => {
    (ExerciseHistoryService.getExerciseHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('seeds the recommended weight from the prescribed set weight when there is no history', async () => {
    // Workout prescribes "12 × 60" for this exercise.
    const rec = await ProgressiveOverloadService.getRecommendation(
      'user-1',
      dumbbellBench,
      3,
      'standard',
      12, // configuredReps
      60, // configuredWeight (the prescribed load)
    );

    expect(rec.recommendedWeight).toBe(60);
    expect(rec.recommendedReps).toBe(12);
  });

  it('falls back to the conservative equipment default when no weight is prescribed', async () => {
    const rec = await ProgressiveOverloadService.getRecommendation(
      'user-1',
      dumbbellBench,
      3,
      'standard',
      12, // configuredReps
      // no configuredWeight
    );

    // Light dumbbells default — NOT the prescribed-weight path.
    expect(rec.recommendedWeight).toBe(10);
  });

  it('ignores a non-positive prescribed weight and uses the conservative default', async () => {
    const rec = await ProgressiveOverloadService.getRecommendation(
      'user-1',
      dumbbellBench,
      3,
      'standard',
      12,
      0, // bodyweight / unset
    );

    expect(rec.recommendedWeight).toBe(10);
  });
});

describe('ProgressiveOverloadService.getRecommendation — delegates the next-session calc to the pure core', () => {
  // dumbbell + 3 sets (strength) + 'standard' → increment of 5 lb.
  it('adds the increment when every set hit the top of the range with effort, and resets to the floor', async () => {
    mockHistory(makeHistory({ weight: 60, actualReps: [10, 10, 10], targetReps: 10, rir: [1, 1, 1] }));

    const rec = await ProgressiveOverloadService.getRecommendation('user-1', dumbbellBench, 3, 'standard', 10);

    expect(rec.action).toBe('increase');
    expect(rec.recommendedWeight).toBe(65); // 60 + 5
    expect(rec.recommendedReps).toBe(10); // reset to the range floor
    expect(rec.recommendedRepMin).toBe(10);
    expect(rec.recommendedRepMax).toBe(10);
    expect(rec.source).toBe('double-progression');
    expect(rec.deloadApplied).toBe(false);
  });

  it('holds the load when the range was not fully earned (partial session)', async () => {
    mockHistory(makeHistory({ weight: 60, actualReps: [10, 9, 8], targetReps: 10 }));

    const rec = await ProgressiveOverloadService.getRecommendation('user-1', dumbbellBench, 3, 'standard', 10);

    expect(rec.action).toBe('maintain');
    expect(rec.recommendedWeight).toBe(60); // unchanged
    expect(rec.reasoning).toMatch(/hold/i);
  });

  it('rebuilds at the same load when the floor was missed', async () => {
    mockHistory(makeHistory({ weight: 60, actualReps: [8, 7, 7], targetReps: 10 }));

    const rec = await ProgressiveOverloadService.getRecommendation('user-1', dumbbellBench, 3, 'standard', 10);

    expect(rec.action).toBe('maintain');
    expect(rec.recommendedWeight).toBe(60); // never auto-cuts
    expect(rec.reasoning).toMatch(/rebuild/i);
  });
});

describe('ProgressiveOverloadService.getInSessionDecision — cut is based on the weight actually lifted', () => {
  it('reduces off the logged weight, not the prescribed/history weight', () => {
    const decision = ProgressiveOverloadService.getInSessionDecision(
      { repMin: 10, repMax: 12, weight: 100, setIndex: 0, totalSets: 3 }, // prescribed/history load = 100
      { weight: 80, reps: 9 }, // a touch short of the floor at the lifted 80
    );

    expect(decision.action).toBe('reduce');
    // round5(80 * 0.9) = 70 — derived from the lifted 80, NOT the prescribed 100.
    expect(decision.suggestedWeight).toBe(70);
    expect(decision.suggestedWeight).not.toBe(90); // 100 * 0.9 rounded — the old, wrong basis
  });
});
