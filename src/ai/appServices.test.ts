import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appServices } from './appServices';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import type { Exercise } from '../types/exercise';
import type { ExerciseHistory, WorkoutSummary } from '../types/exerciseHistory';

describe('appServices — savePastWorkout', () => {
  const library: Exercise[] = [
    {
      id: 'ex-bench',
      name: 'Barbell Bench Press',
      muscleGroup: 'Chest',
      muscleGroups: ['Chest', 'Triceps'],
      equipment: 'Barbell',
      difficulty: 'Intermediate',
      instructions: [],
      videoLinks: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      force: null,
      grips: null,
      mechanic: null,
      searchKeywords: [],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses WorkoutStorageService.saveCompletedWorkout and takes muscle groups/equipment from the library', async () => {
    const saveCompletedSpy = vi.spyOn(WorkoutStorageService, 'saveCompletedWorkout').mockResolvedValue({
      workoutId: 'w-summary-123',
      exerciseIds: ['ex-hist-1'],
    });

    const res = await appServices.savePastWorkout!(
      'user-1',
      {
        name: 'Chest Day',
        date: '2026-10-15',
        durationMinutes: 45,
        exercises: [
          {
            name: 'Barbell Bench Press',
            sets: [{ reps: 8, weight: 225, unit: 'lbs' }],
            notes: 'Felt solid',
          },
        ],
      },
      library,
    );

    expect(saveCompletedSpy).toHaveBeenCalledTimes(1);
    const [userId, activeWorkout, _templateId, endTime] = saveCompletedSpy.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(activeWorkout.name).toBe('Chest Day');
    expect(activeWorkout.id).toContain('past-20261015');
    // Muscle groups and equipment MUST come from the library, not 'Unknown'
    const we = activeWorkout.exercises[0];
    expect(we.exercise.name).toBe('Barbell Bench Press');
    expect(we.exercise.muscleGroups).toEqual(['Chest', 'Triceps']);
    expect(we.exercise.equipment).toBe('Barbell');
    expect(endTime?.toISOString()).toContain('2026-10-15');

    expect(res).toEqual({
      workoutId: 'w-summary-123',
      exerciseIds: ['ex-hist-1'],
    });
  });

  it('uses fallback exercise with deterministic id for unknown exercises not in library', async () => {
    const saveCompletedSpy = vi.spyOn(WorkoutStorageService, 'saveCompletedWorkout').mockResolvedValue({
      workoutId: 'w-summary-456',
      exerciseIds: ['ex-hist-2'],
    });

    await appServices.savePastWorkout!(
      'user-1',
      {
        name: 'Experimental Day',
        date: '2026-10-18',
        exercises: [
          {
            name: 'Unheard-Of Exercise',
            sets: [{ reps: 10, weight: 50 }],
          },
        ],
      },
      library,
    );

    const activeWorkout = saveCompletedSpy.mock.calls[0][1];
    const we = activeWorkout.exercises[0];
    expect(we.exercise.id).toMatch(/^fallback-/);
    expect(we.exercise.name).toBe('Unheard-Of Exercise');
  });
});

describe('appServices — updatePastWorkout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('updates exercise using provided id', async () => {
    const updateWorkoutSpy = vi.spyOn(ExerciseHistoryService, 'updateWorkoutHistory').mockResolvedValue();
    const updateExerciseSpy = vi.spyOn(ExerciseHistoryService, 'updateExerciseHistory').mockResolvedValue();

    await appServices.updatePastWorkout!('user-1', 'w-100', {
      name: 'Updated Name',
      exercises: [
        {
          id: 'ex-hist-99',
          name: 'Barbell Bench Press',
          sets: [{ reps: 6, weight: 235 }],
        },
      ],
    });

    expect(updateWorkoutSpy).toHaveBeenCalledWith('user-1', 'w-100', { name: 'Updated Name' });
    expect(updateExerciseSpy).toHaveBeenCalledWith('user-1', 'ex-hist-99', expect.objectContaining({
      exerciseName: 'Barbell Bench Press',
      sets: [expect.objectContaining({ actualReps: 6, weight: 235 })],
    }));
  });

  it('does not skip exercises without an id: matches existing workout exercise by name', async () => {
    vi.spyOn(ExerciseHistoryService, 'updateWorkoutHistory').mockResolvedValue();
    const updateExerciseSpy = vi.spyOn(ExerciseHistoryService, 'updateExerciseHistory').mockResolvedValue();

    // Mock existing workout exercises returned from DB
    vi.spyOn(ExerciseHistoryService, 'getExerciseHistoryByWorkoutId').mockResolvedValue([
      {
        id: 'matched-ex-id-7',
        exerciseName: 'Barbell Bench Press',
        sets: [],
      } as unknown as ExerciseHistory,
    ]);

    await appServices.updatePastWorkout!('user-1', 'w-100', {
      exercises: [
        {
          // id is omitted by model
          name: 'Barbell Bench Press',
          sets: [{ reps: 8, weight: 225 }],
        },
      ],
    });

    expect(updateExerciseSpy).toHaveBeenCalledWith('user-1', 'matched-ex-id-7', expect.objectContaining({
      exerciseName: 'Barbell Bench Press',
      sets: [expect.objectContaining({ actualReps: 8, weight: 225 })],
    }));
  });

  it('does not skip un-matched exercises without an id: saves as new exercise performance', async () => {
    vi.spyOn(ExerciseHistoryService, 'updateWorkoutHistory').mockResolvedValue();
    vi.spyOn(ExerciseHistoryService, 'getExerciseHistoryByWorkoutId').mockResolvedValue([]);
    const savePerfSpy = vi.spyOn(ExerciseHistoryService, 'saveExercisePerformance').mockResolvedValue('new-ex-id');

    await appServices.updatePastWorkout!('user-1', 'w-100', {
      exercises: [
        {
          name: 'Brand New Exercise',
          sets: [{ reps: 12, weight: 30 }],
        },
      ],
    });

    expect(savePerfSpy).toHaveBeenCalledWith('user-1', expect.objectContaining({
      workoutId: 'w-100',
      exerciseName: 'Brand New Exercise',
      sets: [expect.objectContaining({ actualReps: 12, weight: 30 })],
    }));
  });
});

describe('appServices — getPastWorkout', () => {
  it('reads workout summary and exercise history', async () => {
    const summary = { id: 'w1', name: 'Past Session' } as unknown as WorkoutSummary;
    const exercises = [{ id: 'e1', exerciseName: 'Squat' }] as unknown as ExerciseHistory[];

    vi.spyOn(ExerciseHistoryService, 'getWorkoutSummaryById').mockResolvedValue(summary);
    vi.spyOn(ExerciseHistoryService, 'getExerciseHistoryByWorkoutId').mockResolvedValue(exercises);

    const res = await appServices.getPastWorkout?.('user-1', 'w1');
    expect(res).toEqual({ summary, exercises });
  });

  it('returns null when workout summary not found', async () => {
    vi.spyOn(ExerciseHistoryService, 'getWorkoutSummaryById').mockResolvedValue(null);
    const res = await appServices.getPastWorkout?.('user-1', 'w-nonexistent');
    expect(res).toBeNull();
  });
});
