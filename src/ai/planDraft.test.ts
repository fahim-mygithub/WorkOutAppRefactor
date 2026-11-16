import { describe, it, expect } from 'vitest';
import { toDateKey } from '../lib/dateKey';
import type { Exercise, WorkoutExercise } from '../types/exercise';
import {
  addPlanDraftExercise,
  buildUpdatedPlanExercise,
  editPlanDraftExercise,
  findPlanDraftExercise,
  planEditorScreen,
  removePlanDraftExercise,
  toPlanDraftExercises,
} from './planDraft';

const makeEx = (id: string, name: string): Exercise => ({
  id,
  name,
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Dumbbells',
  videoLinks: [],
  instructions: [],
  difficulty: 'Intermediate',
  force: 'Push',
  grips: null,
  mechanic: 'Compound',
  searchKeywords: [],
  createdAt: '',
  updatedAt: '',
});

describe('planDraft helpers', () => {
  it('converts exercises to draft and rebuilds updated sets, preserving metadata and unit changes', () => {
    const workoutEx: WorkoutExercise = {
      id: 'we-1',
      exercise: makeEx('db-incline', 'Incline Dumbbell Press'),
      sets: [
        {
          id: 'set-1',
          reps: 8,
          repMin: 8,
          repMax: 12,
          weight: 60,
          unit: 'lbs',
          completed: false,
          rpe: 8,
          rir: 2,
          time: 30,
          distance: 10,
        },
      ],
      restTime: 90,
    };

    const drafts = toPlanDraftExercises([workoutEx], 'lbs');
    expect(drafts[0]).toMatchObject({ setsCount: '1', reps: '8', weight: '60', unit: 'lbs' });

    // Keep reps unchanged -> repMin/repMax survive; expand sets to 2 and switch unit to kg.
    const unchangedReps = buildUpdatedPlanExercise({
      ...drafts[0],
      setsCount: '2',
      weight: '27.5',
      unit: 'kg',
    });
    expect(unchangedReps.sets).toHaveLength(2);
    expect(unchangedReps.sets[0]).toMatchObject({
      id: 'set-1',
      reps: 8,
      repMin: 8,
      repMax: 12,
      weight: 27.5,
      unit: 'kg',
      rpe: 8,
      rir: 2,
      time: 30,
      distance: 10,
    });
    expect(unchangedReps.sets[1].unit).toBe('kg');

    // Change reps -> repMin/repMax cleared; clear weight -> weight omitted.
    const changedReps = buildUpdatedPlanExercise({
      ...drafts[0],
      reps: '10',
      weight: '',
    });
    expect(changedReps.sets[0].reps).toBe(10);
    expect(changedReps.sets[0].repMin).toBeUndefined();
    expect(changedReps.sets[0].repMax).toBeUndefined();
    expect(changedReps.sets[0].weight).toBeUndefined();

    // Invalid setsCount / reps fall back cleanly.
    const fallback = buildUpdatedPlanExercise({
      ...drafts[0],
      setsCount: 'abc',
      reps: '0',
    });
    expect(fallback.sets).toHaveLength(1);
    expect(fallback.sets[0].reps).toBe(8);
  });

  it('formats unnamed and empty planEditorScreen snapshots cleanly and slices exercises at 25', () => {
    const today = toDateKey(new Date());
    const emptySnap = planEditorScreen({ planId: 'p0', date: today, name: '   ', exercises: [] });
    expect(emptySnap.summary).toBe(`Unnamed plan, for ${today}, empty`);

    const thirty = toPlanDraftExercises(
      Array.from({ length: 30 }, (_, k) => ({
        id: `we-${k}`,
        exercise: makeEx(`ex-${k}`, `Move ${k}`),
        sets: [{ id: `s-${k}`, reps: 10, unit: 'lbs' as const, completed: false }],
      })),
      'lbs',
    );
    const fullSnap = planEditorScreen({ planId: 'p1', date: today, name: 'Big Day', exercises: thirty });
    expect(fullSnap.summary).toBe(`Plan "Big Day", for ${today}, 30 exercises`);
    expect((fullSnap.data as { exercises: unknown[] }).exercises).toHaveLength(25);
  });

  it('refuses ambiguous partial exercise matches in find, edit, and remove', () => {
    const drafts = toPlanDraftExercises(
      [
        {
          id: 'we-1',
          exercise: makeEx('incline', 'Incline Dumbbell Press'),
          sets: [{ id: 's1', reps: 10, weight: 60, unit: 'lbs', completed: false }],
        },
        {
          id: 'we-2',
          exercise: makeEx('flat', 'Flat Dumbbell Press'),
          sets: [{ id: 's2', reps: 10, weight: 70, unit: 'lbs', completed: false }],
        },
      ],
      'lbs',
    );

    expect(findPlanDraftExercise(drafts, 'Dumbbell Press')).toBe(
      '"Dumbbell Press" matches more than one exercise in this planned workout.',
    );
    expect(editPlanDraftExercise(drafts, 'Dumbbell Press', { sets: 4 })).toEqual({
      ok: false,
      reason: '"Dumbbell Press" matches more than one exercise in this planned workout.',
    });
    expect(removePlanDraftExercise(drafts, 'Dumbbell Press')).toEqual({
      ok: false,
      reason: '"Dumbbell Press" matches more than one exercise in this planned workout.',
    });

    const added = addPlanDraftExercise(drafts, 'c1', makeEx('fly', 'Cable Fly'), {});
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.line).toBe('3x10 Cable Fly');
    }
  });
});
