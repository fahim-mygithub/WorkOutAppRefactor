import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkoutParser } from './workoutParser';
import { exerciseLine, supersetLine, workoutText } from '../ai/workoutText';

/**
 * Emphasis text syntax contract:
 * Each exercise segment in Builder text may end with an optional `[volume]` or
 * `[strength]` tag (case-insensitive on input, serialized lowercase `[volume]`
 * or `[strength]`), e.g.:
 *   - `Bench Press 4x6 @185 [strength]`
 *   - `3x10 Barbell Bench Press @135lbs [volume]`
 *   - `3x12 Dumbbell Curl @30lbs [volume] ss 3x8 Skullcrusher @75lbs [strength]`
 */
describe('WorkoutParser emphasis tag ([volume] / [strength])', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('parses trailing [strength] and [volume] tags across exercise line patterns', () => {
    const parser = new WorkoutParser();
    const res = parser.parse(
      [
        'Bench Press 4x6 @185 [strength]',
        '3x10-12 Incline Dumbbell Press @65lbs [volume]',
        '4x12 Pull Ups [VOLUME]',
        'Face Pulls [volume]',
      ].join('\n'),
    );

    expect(res.success).toBe(true);
    expect(res.workout?.exercises).toEqual([
      {
        name: 'Bench Press',
        sets: Array.from({ length: 4 }, () => ({ reps: 6, weight: 185, unit: 'lbs' })),
        emphasis: 'strength',
      },
      {
        name: 'Incline Dumbbell Press',
        sets: Array.from({ length: 3 }, () => ({ reps: { min: 10, max: 12 }, weight: 65, unit: 'lbs' })),
        emphasis: 'volume',
      },
      {
        name: 'Pull Ups',
        sets: Array.from({ length: 4 }, () => ({ reps: 12 })),
        emphasis: 'volume',
      },
      {
        name: 'Face Pulls',
        sets: [{ reps: 10 }],
        emphasis: 'volume',
      },
    ]);
  });

  it('leaves untagged lines completely undisturbed (emphasis undefined)', () => {
    const parser = new WorkoutParser();
    const res = parser.parse('3x8 Barbell Bench Press (Paused) @155lbs\n4x10 Chin-Ups');

    expect(res.success).toBe(true);
    expect(res.workout?.exercises[0]).toEqual({
      name: 'Barbell Bench Press (Paused)',
      sets: Array.from({ length: 3 }, () => ({ reps: 8, weight: 155, unit: 'lbs' })),
    });
    expect(res.workout?.exercises[0].emphasis).toBeUndefined();
    expect(res.workout?.exercises[1]).toEqual({
      name: 'Chin-Ups',
      sets: Array.from({ length: 4 }, () => ({ reps: 10 })),
    });
  });

  it('supports different emphasis flags per superset partner and round-trips cleanly', () => {
    const parser = new WorkoutParser();
    const line = '3x12 Dumbbell Curl @30lbs [volume] ss 3x6 Close Grip Bench Press @165lbs [strength]';
    const res = parser.parse(line);

    expect(res.success).toBe(true);
    expect(res.workout?.exercises).toEqual([]);
    expect(res.workout?.supersets).toHaveLength(1);
    const [curl, cgbp] = res.workout!.supersets[0];
    expect(curl).toMatchObject({ name: 'Dumbbell Curl', emphasis: 'volume' });
    expect(cgbp).toMatchObject({ name: 'Close Grip Bench Press', emphasis: 'strength' });

    // Round-trip back to text and parse again
    expect(supersetLine([curl, cgbp])).toBe(line);
    const fullText = workoutText({
      exercises: [
        {
          name: 'Barbell Squat',
          sets: Array.from({ length: 4 }, () => ({ reps: 5, weight: 225, unit: 'lbs' as const })),
          emphasis: 'strength',
        },
        {
          name: 'Plank',
          sets: Array.from({ length: 3 }, () => ({ reps: 1 })),
        },
      ],
      supersets: [[curl, cgbp]],
    });
    expect(fullText).toBe(
      [
        '4x5 Barbell Squat @225lbs [strength]',
        '3x1 Plank',
        '3x12 Dumbbell Curl @30lbs [volume] ss 3x6 Close Grip Bench Press @165lbs [strength]',
      ].join('\n'),
    );

    const reparsed = parser.parse(fullText);
    expect(reparsed.success).toBe(true);
    expect(reparsed.workout?.exercises[0].emphasis).toBe('strength');
    expect(reparsed.workout?.exercises[1].emphasis).toBeUndefined();
    expect(reparsed.workout?.supersets[0].map((e) => e.emphasis)).toEqual(['volume', 'strength']);
    expect(exerciseLine({ name: 'Stretch', sets: [], emphasis: 'volume' })).toBe('Stretch [volume]');
  });
});
