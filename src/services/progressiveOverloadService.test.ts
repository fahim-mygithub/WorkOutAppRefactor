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
