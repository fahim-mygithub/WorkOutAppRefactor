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
});
