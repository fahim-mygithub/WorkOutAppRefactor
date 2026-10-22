import { describe, it, expect } from 'vitest';
import {
  groupWorkoutCards,
  getExerciseTag,
  nudgeWeight,
  nudgeReps,
  nudgeTime,
  WEIGHT_STEP,
  TIME_STEP,
} from './workoutCardUtils';
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
    expect(getExerciseTag(0)).toBe('A');
    expect(getExerciseTag(1)).toBe('B');
    expect(getExerciseTag(2)).toBe('C');
  });

  describe('nudge helpers', () => {
    it('nudges weight by default step and never goes below zero', () => {
      expect(nudgeWeight(100, 1)).toBe(105);
      expect(nudgeWeight(100, -1)).toBe(95);
      expect(nudgeWeight(2, -1)).toBe(0);
      expect(nudgeWeight(100, 1, 2.5)).toBe(102.5);
    });

    it('nudges reps by 1 and never goes below zero', () => {
      expect(nudgeReps(8, 1)).toBe(9);
      expect(nudgeReps(8, -1)).toBe(7);
      expect(nudgeReps(0, -1)).toBe(0);
    });

    it('nudges time by 5s step and never goes below zero', () => {
      expect(nudgeTime(30, 1)).toBe(35);
      expect(nudgeTime(30, -1)).toBe(25);
      expect(nudgeTime(2, -1)).toBe(0);
      expect(nudgeTime(30, 1, 10)).toBe(40);
    });
  });
});
