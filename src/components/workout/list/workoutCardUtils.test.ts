import { describe, it, expect } from 'vitest';
import { groupWorkoutCards, getExerciseTag } from './workoutCardUtils';
import type { WorkoutExercise, Exercise } from '../../../types/exercise';

const dummyExercise = {
  id: 'ex-1',
  name: 'Bench Press',
} as unknown as Exercise;

describe('workoutCardUtils', () => {
  it('groups regular exercises into individual cards', () => {
    const exercises: WorkoutExercise[] = [
      { id: 'we-1', exercise: dummyExercise, sets: [] },
      { id: 'we-2', exercise: dummyExercise, sets: [] },
    ];
    const cards = groupWorkoutCards(exercises);
    expect(cards).toHaveLength(2);
    expect(cards[0].isSuperset).toBe(false);
    expect(cards[1].isSuperset).toBe(false);
  });

  it('groups supersets into a single card', () => {
    const exercises: WorkoutExercise[] = [
      { id: 'we-1', exercise: dummyExercise, sets: [], isSuperset: true, supersetId: 'ss-1' },
      { id: 'we-2', exercise: dummyExercise, sets: [], isSuperset: true, supersetId: 'ss-1' },
    ];
    const cards = groupWorkoutCards(exercises);
    expect(cards).toHaveLength(1);
    expect(cards[0].isSuperset).toBe(true);
    expect(cards[0].exercises).toHaveLength(2);
  });

  it('generates unambiguous exercise tags A, B, C based on index in card', () => {
    const exA = { id: 'we-1', exercise: { ...dummyExercise, name: 'Dumbbell Bench Press' }, sets: [] };
    const exB = { id: 'we-2', exercise: { ...dummyExercise, name: 'Incline Dumbbell Bench Press' }, sets: [] };

    expect(getExerciseTag(exA, 0)).toBe('A');
    expect(getExerciseTag(exB, 1)).toBe('B');
    expect(getExerciseTag(exA, 2)).toBe('C');
  });
});
