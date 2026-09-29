import { describe, it, expect } from 'vitest';
import type { Exercise } from '../types/exercise';
import { swapAlternatives } from './alternatives';

const ex = (name: string, equipment: string, muscleGroups: string[], id = name): Exercise =>
  ({ id, name, equipment, muscleGroups, muscleGroup: muscleGroups.join(',') }) as Exercise;

const rdl = ex('Barbell Romanian Deadlift', 'Barbell', ['Barbell', 'Glutes', 'Hamstrings', 'Lower back']);
const library: Exercise[] = [
  rdl,
  ex('Dumbbell Romanian Deadlift', 'Dumbbells', ['Glutes', 'Hamstrings', 'Lower back']),
  ex('Barbell Good Morning', 'Barbell', ['Barbell', 'Glutes', 'Hamstrings', 'Lower back']),
  ex('Machine Leg Curl', 'Machine', ['Hamstrings']),
  ex('Barbell Hip Thrust', 'Barbell', ['Barbell', 'Glutes']),
  ex('Barbell Bench Press', 'Barbell', ['Barbell', 'Chest', 'Triceps']),
  ex('Cable Pull Through', 'Cables', ['Cables', 'Glutes', 'Hamstrings']),
];

describe('swapAlternatives', () => {
  it('lists exercises sharing a muscle, most overlap first, other equipment before same, then by name', () => {
    expect(swapAlternatives(rdl, library)).toEqual([
      'Dumbbell Romanian Deadlift', // 3 shared, other equipment
      'Barbell Good Morning', // 3 shared, same equipment
      'Cable Pull Through', // 2 shared ('Cables' is an equipment tag, not a muscle)
      'Machine Leg Curl', // 1 shared, other equipment
      'Barbell Hip Thrust', // 1 shared, same equipment
    ]);
  });

  it('never lists the exercise itself or ones sharing only an equipment tag', () => {
    const out = swapAlternatives(rdl, library);
    expect(out).not.toContain('Barbell Romanian Deadlift');
    expect(out).not.toContain('Barbell Bench Press');
  });

  it('respects the limit and is deterministic regardless of library order', () => {
    expect(swapAlternatives(rdl, library, 2)).toEqual(['Dumbbell Romanian Deadlift', 'Barbell Good Morning']);
    expect(swapAlternatives(rdl, [...library].reverse())).toEqual(swapAlternatives(rdl, library));
  });

  it('caps at 8 by default', () => {
    const many = Array.from({ length: 20 }, (_, k) => ex(`Curl ${String(k).padStart(2, '0')}`, 'Machine', ['Hamstrings']));
    expect(swapAlternatives(rdl, many)).toHaveLength(8);
  });

  it('falls back to the comma-separated muscle group and skips a same-named copy', () => {
    const custom = { id: 'c1', name: 'My Hinge', equipment: 'Barbell', muscleGroup: 'Hamstrings, Glutes' } as Exercise;
    const out = swapAlternatives(custom, [...library, { ...custom, id: 'c2', name: 'my hinge' }]);
    // Hamstrings + Glutes: every hinge ties on overlap, so other equipment first, then by name.
    expect(out.slice(0, 3)).toEqual(['Cable Pull Through', 'Dumbbell Romanian Deadlift', 'Barbell Good Morning']);
    expect(out).not.toContain('my hinge');
  });

  it('is empty when the exercise has no muscle groups', () => {
    expect(swapAlternatives({ id: 'x', name: 'Mystery' } as Exercise, library)).toEqual([]);
  });

  it('at equal overlap, ranks common kit first (other equipment before the same), then shorter names; bands and bodyweight last', () => {
    const cableRow = ex('Cable Row', 'Cables', ['Lats', 'Upper back']);
    const rows = [
      ex('Band Row', 'Band', ['Lats', 'Upper back']),
      ex('Bodyweight Inverted Row', 'Bodyweight', ['Bodyweight', 'Lats', 'Upper back']),
      ex('Barbell Bent Over Row', 'Barbell', ['Barbell', 'Lats', 'Upper back']),
      ex('Machine Row', 'Machine', ['Lats', 'Upper back']),
      ex('Dumbbell Row', 'Dumbbells', ['Lats', 'Upper back']),
      ex('Cable Seated Row', 'Cables', ['Lats', 'Upper back']),
    ];
    expect(swapAlternatives(cableRow, rows)).toEqual([
      'Machine Row', 'Dumbbell Row', 'Barbell Bent Over Row', // common kit, other equipment, shortest first
      'Cable Seated Row', // common kit, same equipment
      'Band Row', 'Bodyweight Inverted Row', // niche kit
    ]);
  });

  describe('same movement first', () => {
    const dbBench = ex('Dumbbell Bench Press', 'Dumbbells', ['Chest', 'Mid and Lower Chest', 'Triceps']);

    it('ranks shared movement words above muscle overlap', () => {
      const lib = [
        ex('Machine Dips', 'Machine', ['Chest', 'Mid and Lower Chest', 'Triceps']),
        ex('Band Pushup', 'Band', ['Band', 'Chest', 'Mid and Lower Chest', 'Triceps']),
        ex('Machine Chest Press', 'Machine', ['Chest', 'Triceps']),
        ex('Barbell Bench Press', 'Barbell', ['Barbell', 'Chest', 'Mid and Lower Chest']),
      ];
      expect(swapAlternatives(dbBench, lib)).toEqual([
        'Barbell Bench Press', // bench + press
        'Machine Chest Press', // press
        'Machine Dips', // 3 muscles, common kit
        'Band Pushup', // 3 muscles, niche kit
      ]);
    });

    it('lets a shared movement word qualify a candidate with no shared muscle', () => {
      expect(swapAlternatives(dbBench, [ex('Barbell Bench Press', 'Barbell', [])])).toEqual(['Barbell Bench Press']);
    });

    it('does not count equipment words, short words or single-arm/leg modifiers as movement', () => {
      const row = ex('Dumbbell Single Arm Row', 'Dumbbells', ['Lats']);
      const squat = ex('Smith Machine Squat', 'Smith-Machine', ['Quads']);
      const lib = [
        ex('Cable Single Arm Curl', 'Cables', ['Biceps']),
        ex('Smith Machine Calf Raise', 'Smith-Machine', ['Calves']),
        ex('EZ Bar Curl', 'EZ Bar', ['Biceps']),
      ];
      expect(swapAlternatives(row, lib)).toEqual([]);
      expect(swapAlternatives(squat, lib)).toEqual([]);
    });

    it('does not count grip or stance descriptors as movement', () => {
      const pulldown = ex('Neutral Pulldown', 'Machine', ['Lats']);
      const lib = [
        ex('Cable Neutral Grip Row', 'Cables', ['Mid back']),
        ex('Barbell Close Grip Bench Press', 'Barbell', ['Triceps']),
        ex('Narrow Pulldown', 'Machine', ['Biceps']),
      ];
      expect(swapAlternatives(pulldown, lib)).toEqual(['Narrow Pulldown']);
    });

    it('keeps hammer as a movement word', () => {
      const hammer = ex('Dumbbell Hammer Curl', 'Dumbbells', ['Biceps']);
      const lib = [ex('Barbell Curl', 'Barbell', ['Biceps']), ex('Cable Rope Hammer Curl', 'Cables', ['Biceps'])];
      expect(swapAlternatives(hammer, lib)).toEqual(['Cable Rope Hammer Curl', 'Barbell Curl']);
    });

    it('counts leg or arm when it is the movement', () => {
      const press = ex('Machine Leg Press', 'Machine', ['Quads']);
      expect(swapAlternatives(press, [ex('Machine Leg Curl', 'Machine', ['Hamstrings'])])).toEqual(['Machine Leg Curl']);
    });
  });
});
