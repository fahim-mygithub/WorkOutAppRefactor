import { describe, it, expect } from 'vitest';
import { orderForWorkout, pairSuperset, removeExercise, unpairSuperset } from '@/lib/builderSupersets';

const list = () => [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }] as { name: string; supersetGroup?: number }[];
const groups = (xs: { supersetGroup?: number }[]) => xs.map((x) => x.supersetGroup ?? null);

describe('builder supersets', () => {
  it('pairs two exercises into a new group, and a third joins it', () => {
    let xs = pairSuperset(list(), 0, 2);
    expect(groups(xs)).toEqual([1, null, 1, null]);
    xs = pairSuperset(xs, 0, 3);
    expect(groups(xs)).toEqual([1, null, 1, 1]);
    xs = pairSuperset(xs, 1, 2); // C moves to a new group with B; A + D stay paired
    expect(groups(xs)).toEqual([1, 2, 2, 1]);
  });

  it('unpairing or deleting a partner frees the one left alone', () => {
    const xs = pairSuperset(list(), 0, 1);
    expect(groups(unpairSuperset(xs, 1))).toEqual([null, null, null, null]);
    expect(groups(removeExercise(xs, 0))).toEqual([null, null, null]);
  });

  it('pulls partners together at the first member for the workout', () => {
    const xs = pairSuperset(list(), 0, 2);
    const units = orderForWorkout(xs);
    expect(units.map((u) => (Array.isArray(u) ? u.map((e) => e.name).join('+') : u.name))).toEqual([
      'A+C',
      'B',
      'D',
    ]);
  });
});
