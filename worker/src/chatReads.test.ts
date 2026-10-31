import { describe, it, expect, beforeEach } from 'vitest';
import { executeChatRead, isReadTool, listHistorySchema } from './chatReads';
import { FakeFirestore } from './data/testing/fakeFirestore';
import { UserData } from './data/userData';

describe('chatReads', () => {
  const UID = 'user-test-123';
  let fs: FakeFirestore;
  let data: UserData;

  beforeEach(() => {
    fs = new FakeFirestore();
    data = new UserData(fs.client(), UID);
  });

  it('recognizes read tools', () => {
    expect(isReadTool('list_history')).toBe(true);
    expect(isReadTool('listHistory')).toBe(true);
    expect(isReadTool('get_history_entry')).toBe(true);
    expect(isReadTool('list_workouts')).toBe(true);
    expect(isReadTool('get_workout')).toBe(true);
    expect(isReadTool('logSet')).toBe(false);
    expect(isReadTool('logPastWorkout')).toBe(false);
  });

  it('fails soft when service account is missing', async () => {
    const res = await executeChatRead('list_history', {}, {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain('history is unavailable');
  });

  it('enforces uid from context, never the model input', async () => {
    // Attempting to pass uid in tool input is rejected by the strict schema
    const parsed = listHistorySchema.safeParse({ uid: 'evil-user' });
    expect(parsed.success).toBe(false);

    // Queries go to the verified context uid only
    fs.put(['users', UID, 'workout_history', 'w1'], {
      name: 'Push Day',
      startTime: new Date('2026-10-25T10:00:00Z'),
      endTime: new Date('2026-10-25T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 3240,
    });
    fs.put(['users', 'other-user', 'workout_history', 'w2'], {
      name: 'Other Workout',
      startTime: new Date('2026-10-25T10:00:00Z'),
      endTime: new Date('2026-10-25T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 3240,
    });

    const res = await executeChatRead('list_history', { kind: 'workouts' }, { uid: UID, data, fs: fs.client() });
    expect(res.ok).toBe(true);
    const result = res.result as { items: { id: string; name: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('w1');
    expect(result.items[0].name).toBe('Push Day');
  });

  it('filters history by date range', async () => {
    fs.put(['users', UID, 'workout_history', 'w1'], {
      name: 'Workout Oct 10',
      startTime: new Date('2026-10-10T10:00:00Z'),
      endTime: new Date('2026-10-10T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 3000,
    });
    fs.put(['users', UID, 'workout_history', 'w2'], {
      name: 'Workout Oct 20',
      startTime: new Date('2026-10-20T10:00:00Z'),
      endTime: new Date('2026-10-20T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 3000,
    });
    fs.put(['users', UID, 'workout_history', 'w3'], {
      name: 'Workout Oct 25',
      startTime: new Date('2026-10-25T10:00:00Z'),
      endTime: new Date('2026-10-25T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 24,
      totalVolume: 3000,
    });

    const res = await executeChatRead(
      'list_history',
      { kind: 'workouts', from: '2026-10-15', to: '2026-10-22' },
      { uid: UID, data, fs: fs.client() },
    );
    expect(res.ok).toBe(true);
    const result = res.result as { items: { id: string; name: string }[] };
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('w2');
  });

  it('gets one history entry with sets', async () => {
    fs.put(['users', UID, 'workout_history', 'w1'], {
      name: 'Leg Day',
      startTime: new Date('2026-10-24T10:00:00Z'),
      endTime: new Date('2026-10-24T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 15,
      totalVolume: 3000,
      exercisesSummary: [{ exerciseId: 'squat', exerciseName: 'Barbell Squat', sets: 3, reps: 15, volume: 3000 }],
    });
    fs.put(['users', UID, 'exercise_history', 'e1'], {
      workoutId: 'w1',
      workoutName: 'Leg Day',
      workoutDate: new Date('2026-10-24T10:00:00Z'),
      exerciseName: 'Barbell Squat',
      sets: [
        { setNumber: 1, actualReps: 5, weight: 225, unit: 'lbs', completed: true },
        { setNumber: 2, actualReps: 5, weight: 225, unit: 'lbs', completed: true },
        { setNumber: 3, actualReps: 5, weight: 225, unit: 'lbs', completed: true },
      ],
      configuration: '3x5',
      totalVolume: 3375,
    });

    const res = await executeChatRead('get_history_entry', { id: 'w1' }, { uid: UID, data, fs: fs.client() });
    expect(res.ok).toBe(true);
    const result = res.result as {
      workout: { name: string };
      exercises: { exerciseName: string; sets: { actualReps: number; weight: number }[] }[];
    };
    expect(result.workout.name).toBe('Leg Day');
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].exerciseName).toBe('Barbell Squat');
    expect(result.exercises[0].sets).toHaveLength(3);
    expect(result.exercises[0].sets[0].weight).toBe(225);
  });

  it('lists saved workouts and gets one workout in full', async () => {
    fs.put(['users', UID, 'savedWorkouts', 'sw1'], {
      name: 'Upper Body A',
      workoutText: '3x8 Barbell Bench Press',
      parsedWorkout: {
        exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 8, weight: 135, unit: 'lbs' }] }],
        supersets: [],
      },
      tags: ['Upper'],
      updatedAt: new Date('2026-10-20T10:00:00Z'),
    });

    const listRes = await executeChatRead('list_workouts', {}, { uid: UID, data, fs: fs.client() });
    expect(listRes.ok).toBe(true);
    const listResult = listRes.result as { items: { id: string; name: string }[] };
    expect(listResult.items).toHaveLength(1);
    expect(listResult.items[0].name).toBe('Upper Body A');

    const getRes = await executeChatRead('get_workout', { workoutId: 'sw1' }, { uid: UID, data, fs: fs.client() });
    expect(getRes.ok).toBe(true);
    const getResult = getRes.result as { name: string; exercises: { name: string }[] };
    expect(getResult.name).toBe('Upper Body A');
    expect(getResult.exercises[0].name).toBe('Barbell Bench Press');
  });
});
