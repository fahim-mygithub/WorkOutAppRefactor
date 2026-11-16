import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkoutStorageService } from './workoutStorageService';
import { ExerciseHistoryService } from './exerciseHistoryService';
import type { ActiveWorkout, Exercise } from '../types/exercise';

const bench: Exercise = {
  id: 'ex-bench',
  name: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Barbell',
  videoLinks: [],
  instructions: [],
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  searchKeywords: [],
  createdAt: '',
  updatedAt: '',
};

const curl: Exercise = {
  ...bench,
  id: 'ex-curl',
  name: 'Dumbbell Curl',
  muscleGroup: 'Biceps',
  muscleGroups: ['Biceps'],
  equipment: 'Dumbbells',
};

describe('WorkoutStorageService.saveCompletedWorkout emphasis persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('writes each exercise emphasis (including tracked.goal fallback, excluding checkpoint) to ExerciseHistoryService', async () => {
    const savePerf = vi
      .spyOn(ExerciseHistoryService, 'saveExercisePerformance')
      .mockResolvedValue('hist-1');
    const saveSummary = vi
      .spyOn(ExerciseHistoryService, 'saveWorkoutSummary')
      .mockResolvedValue('sum-1');

    const activeWorkout: ActiveWorkout = {
      id: 'wo-1',
      name: 'Upper Session',
      startTime: new Date().toISOString(),
      duration: 45,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      isActive: true,
      exercises: [
        {
          id: 'we-1',
          exercise: bench,
          sets: [{ id: 's1', reps: 3, weight: 225, unit: 'lbs', completed: true }],
          tracked: { liftId: 'lift-bench', goal: 'strength' },
        },
        {
          id: 'we-2',
          exercise: curl,
          sets: [{ id: 's2', reps: 12, weight: 30, unit: 'lbs', completed: true }],
          emphasis: 'volume',
        },
        {
          id: 'we-3',
          exercise: { ...bench, id: 'ex-squat', name: 'Back Squat' },
          sets: [{ id: 's3', reps: 1, weight: 315, unit: 'lbs', completed: true }],
          tracked: { liftId: 'lift-squat', goal: 'checkpoint' },
        },
      ],
    };

    await WorkoutStorageService.saveCompletedWorkout('user-real-1', activeWorkout);

    expect(savePerf).toHaveBeenCalledTimes(3);
    expect(savePerf.mock.calls[0][1]).toMatchObject({
      exerciseName: 'Barbell Bench Press',
      emphasis: 'strength',
    });
    expect(savePerf.mock.calls[1][1]).toMatchObject({
      exerciseName: 'Dumbbell Curl',
      emphasis: 'volume',
    });
    expect(savePerf.mock.calls[2][1].emphasis).toBeUndefined();
    expect(saveSummary).toHaveBeenCalledTimes(1);
  });
});
