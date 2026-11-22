import { describe, it, expect } from 'vitest';
import type { ExerciseHistory } from '../types/exerciseHistory';
import { estimateOneRepMax, loadForReps } from './oneRepMax';
import {
  computeStrengthMarkers,
  computeWorkingWeights,
  exerciseMarkerKey,
  formatWeightRange,
  roundMarkerWeight,
} from './strengthMarkers';

function makeEntry(
  overrides: Partial<ExerciseHistory> & {
    sets: ExerciseHistory['sets'];
  },
): ExerciseHistory {
  return {
    id: overrides.id ?? 'hist-1',
    userId: overrides.userId ?? 'user-1',
    exerciseId: overrides.exerciseId ?? 'bench-press',
    exerciseName: overrides.exerciseName ?? 'Barbell Bench Press',
    workoutDate: overrides.workoutDate ?? new Date('2026-11-10T10:00:00Z'),
    configuration: overrides.configuration ?? '3x8',
    muscleGroups: overrides.muscleGroups ?? ['Chest'],
    equipment: overrides.equipment ?? 'Barbell',
    totalVolume: overrides.totalVolume ?? 0,
    ...overrides,
  };
}

describe('strengthMarkers', () => {
  it('computes Epley e1RM for 185 x 8 (~234) and labels source as estimate', () => {
    const history = [
      makeEntry({
        sets: [
          { setNumber: 1, targetReps: 8, actualReps: 8, weight: 185, unit: 'lbs', completed: true },
        ],
      }),
    ];

    const markers = computeStrengthMarkers(history);
    expect(markers).toHaveLength(1);
    const [bench] = markers;

    expect(bench.exerciseName).toBe('Barbell Bench Press');
    expect(bench.bestSet).toMatchObject({ weight: 185, reps: 8, unit: 'lbs' });
    expect(bench.formulaE1RM).toBe(Math.round(estimateOneRepMax(185, 8))); // 234
    expect(bench.e1RM).toBe(234);
    expect(bench.source).toBe('estimate');
  });

  it('applies RIR effort adjustment via effortAdjustedE1RM', () => {
    const history = [
      makeEntry({
        sets: [
          {
            setNumber: 1,
            targetReps: 8,
            actualReps: 8,
            weight: 185,
            unit: 'lbs',
            completed: true,
            rir: 2,
          },
        ],
      }),
    ];

    const [bench] = computeStrengthMarkers(history);
    // 185 x (8 + 2) = 185 * (1 + 10/30) = 246.67 -> 247
    expect(bench.formulaE1RM).toBe(247);
    expect(bench.bestSet.rir).toBe(2);
  });

  it('smooths over the most recent 3 sessions using median regardless of input order', () => {
    // Provide 4 sessions in newest-first order (as Firestore returns them)
    // Oldest (Nov 1): 135 x 5 -> 157.5
    // Nov 5: 185 x 8 -> 234.33
    // Nov 10: 225 x 5 -> 262.5 (PR spike)
    // Nov 15: 195 x 6 -> 234.0
    // Last 3 sessions (Nov 5, 10, 15) have bests [234.33, 262.5, 234.0] -> median is 234.33 -> 234
    const history = [
      makeEntry({
        id: 's4',
        workoutDate: new Date('2026-11-15T10:00:00Z'),
        sets: [{ setNumber: 1, targetReps: 6, actualReps: 6, weight: 195, unit: 'lbs', completed: true }],
      }),
      makeEntry({
        id: 's3',
        workoutDate: new Date('2026-11-10T10:00:00Z'),
        sets: [{ setNumber: 1, targetReps: 5, actualReps: 5, weight: 225, unit: 'lbs', completed: true }],
      }),
      makeEntry({
        id: 's2',
        workoutDate: new Date('2026-11-05T10:00:00Z'),
        sets: [{ setNumber: 1, targetReps: 8, actualReps: 8, weight: 185, unit: 'lbs', completed: true }],
      }),
      makeEntry({
        id: 's1',
        workoutDate: new Date('2026-11-01T10:00:00Z'),
        sets: [{ setNumber: 1, targetReps: 5, actualReps: 5, weight: 135, unit: 'lbs', completed: true }],
      }),
    ];

    const [bench] = computeStrengthMarkers(history);
    expect(bench.sessionCount).toBe(4);
    expect(bench.bestE1RM).toBe(263); // 225 x 5 = 262.5 -> 263
    expect(bench.bestSet).toMatchObject({ weight: 225, reps: 5 });
    expect(bench.formulaE1RM).toBe(234);
  });

  it('computes heavy (5-6), moderate (8-10), and volume (12-15) working weights that round-trip with loadForReps', () => {
    const e1RM = estimateOneRepMax(185, 8); // 234.333...
    const weights = computeWorkingWeights(e1RM, 'Unknown', 'lbs');

    expect(weights.heavy.repRange).toBe('5-6');
    expect(weights.moderate.repRange).toBe('8-10');
    expect(weights.volume.repRange).toBe('12-15');

    // Heavy: loadForReps(234.33, 6) = 195.28 -> 195; loadForReps(234.33, 5) = 200.86 -> 200
    expect(weights.heavy.minWeight).toBe(roundMarkerWeight(loadForReps(e1RM, 6), 'Unknown', 'lbs'));
    expect(weights.heavy.maxWeight).toBe(roundMarkerWeight(loadForReps(e1RM, 5), 'Unknown', 'lbs'));
    expect(weights.heavy.minWeight).toBe(195);
    expect(weights.heavy.maxWeight).toBe(200);

    // Moderate: 8 reps round-trips directly to 185
    expect(weights.moderate.maxWeight).toBe(185);
    expect(weights.moderate.minWeight).toBe(175);

    // Volume: 12-15 reps
    expect(weights.volume.minWeight).toBe(155);
    expect(weights.volume.maxWeight).toBe(165);

    // Round-trip check: estimateOneRepMax(weight, midpointReps) stays within one plate step of e1RM
    for (const zone of [weights.heavy, weights.moderate, weights.volume]) {
      const midReps = (zone.minReps + zone.maxReps) / 2;
      const backTo1RM = estimateOneRepMax(zone.weight, midReps);
      expect(Math.abs(backTo1RM - e1RM)).toBeLessThanOrEqual(10);
      expect(zone.minWeight).toBeLessThanOrEqual(zone.weight);
      expect(zone.weight).toBeLessThanOrEqual(zone.maxWeight);
    }

    expect(formatWeightRange(weights.heavy)).toBe('195–200');
  });

  it('uses equipment-aware rounding from oneRepMax and falls back to WEIGHT_STEP', () => {
    // Barbell uses 2.5 lb step in oneRepMax
    expect(roundMarkerWeight(167.3, 'Barbell', 'lbs')).toBe(167.5);
    // Machine uses 10 lb step in oneRepMax
    expect(roundMarkerWeight(164, 'Machine', 'lbs')).toBe(160);
    // Unknown falls back to WEIGHT_STEP (5 lbs)
    expect(roundMarkerWeight(167.3, 'Unknown', 'lbs')).toBe(165);
  });

  it('skips bodyweight, timed, incomplete, and zero-weight lifts', () => {
    const history = [
      makeEntry({
        id: 'bw',
        exerciseId: 'push-up',
        exerciseName: 'Push-Up',
        equipment: 'Bodyweight',
        sets: [
          { setNumber: 1, targetReps: 20, actualReps: 20, weight: 0, unit: 'lbs', completed: true },
        ],
      }),
      makeEntry({
        id: 'plank',
        exerciseId: 'plank',
        exerciseName: 'Plank',
        equipment: 'Bodyweight',
        sets: [
          { setNumber: 1, targetReps: 60, actualReps: 0, weight: 0, unit: 'lbs', completed: true },
        ],
      }),
      makeEntry({
        id: 'incomplete',
        exerciseId: 'squat',
        exerciseName: 'Back Squat',
        equipment: 'Barbell',
        sets: [
          { setNumber: 1, targetReps: 5, actualReps: 5, weight: 315, unit: 'lbs', completed: false },
        ],
      }),
    ];

    expect(computeStrengthMarkers(history)).toEqual([]);
  });

  it('stated max wins over both formula estimate and Claude-reviewed estimate', () => {
    const history = [
      makeEntry({
        exerciseId: 'bench-press',
        exerciseName: 'Barbell Bench Press',
        sets: [{ setNumber: 1, targetReps: 8, actualReps: 8, weight: 185, unit: 'lbs', completed: true }],
      }),
    ];
    const key = exerciseMarkerKey({ exerciseId: 'bench-press', exerciseName: 'Barbell Bench Press' });

    const withAiOnly = computeStrengthMarkers(history, {
      aiReviews: {
        [key]: {
          exerciseKey: key,
          e1RM: 242,
          note: 'Strong 8-rep set suggests ~242.',
          reviewedAt: '2026-11-22T00:00:00Z',
          formulaE1RM: 234,
        },
      },
    });
    expect(withAiOnly[0].e1RM).toBe(242);
    expect(withAiOnly[0].source).toBe('Claude-reviewed');
    expect(withAiOnly[0].note).toBe('Strong 8-rep set suggests ~242.');

    const withStated = computeStrengthMarkers(history, {
      statedMaxes: {
        [key]: {
          exerciseKey: key,
          exerciseName: 'Barbell Bench Press',
          weight: 265,
          unit: 'lbs',
          updatedAt: '2026-11-22T00:00:00Z',
        },
      },
      aiReviews: {
        [key]: {
          exerciseKey: key,
          e1RM: 242,
          note: 'Strong 8-rep set suggests ~242.',
          reviewedAt: '2026-11-22T00:00:00Z',
          formulaE1RM: 234,
        },
      },
    });

    expect(withStated[0].e1RM).toBe(265);
    expect(withStated[0].formulaE1RM).toBe(234);
    expect(withStated[0].source).toBe('stated');
    // Working weights reflect the 265 stated max
    expect(withStated[0].workingWeights.moderate.maxWeight).toBe(210); // loadForReps(265, 8) = 209.2 -> 210
  });
});
