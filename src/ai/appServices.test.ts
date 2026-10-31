import { describe, it, expect, vi, beforeEach } from 'vitest';

// Past workouts reach the Worker's `history` action through runHistory; these
// tests check what the app sends (and what it reads back) at that boundary.
const runHistory = vi.hoisted(() => vi.fn());
vi.mock('./aiClient', () => ({ runHistory }));

import { appServices } from './appServices';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('appServices.history', () => {
  beforeEach(() => runHistory.mockReset());

  it('log sends the dictated workout as a log_workout input and returns the created ids', async () => {
    runHistory.mockResolvedValue({ ok: true, workoutId: 'sum1', exerciseIds: ['e1', 'e2'] });

    const res = await appServices.history!.log({
      name: 'Chest Day',
      date: '2026-10-15',
      durationMinutes: 45,
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 225, unit: 'lbs', rpe: 8 }, { reps: 8 }], notes: 'Felt solid' },
        { name: 'Hammer Strength Iso Row', sets: [{ reps: 10, weight: 90, unit: 'kg' }] },
      ],
    });

    expect(res).toEqual({ workoutId: 'sum1', exerciseIds: ['e1', 'e2'] });
    expect(runHistory).toHaveBeenCalledTimes(1);
    expect(runHistory).toHaveBeenCalledWith('log', {
      date: '2026-10-15',
      name: 'Chest Day',
      durationMinutes: 45,
      ...(tz ? { tz } : {}),
      exercises: [
        { name: 'Bench Press', sets: [{ reps: 8, weight: 225, unit: 'lbs', rpe: 8 }, { reps: 8 }], notes: 'Felt solid' },
        { name: 'Hammer Strength Iso Row', sets: [{ reps: 10, weight: 90, unit: 'kg' }] },
      ],
    });
    // Nothing that names a user ever travels in the payload.
    expect(JSON.stringify(runHistory.mock.calls)).not.toMatch(/uid|userId/i);
  });

  it('undoLog sends the workout id and the exercise ids the log returned', async () => {
    runHistory.mockResolvedValue({ ok: true, workoutId: 'sum1' });
    await appServices.history!.undoLog('sum1', ['e1', 'e2']);
    expect(runHistory).toHaveBeenCalledWith('undoLog', { workoutId: 'sum1', exerciseIds: ['e1', 'e2'] });
  });

  it('edit sends the update (with exercise history ids) and returns the Worker prior', async () => {
    const prior = { name: 'Leg Day', date: '2026-10-20', exercises: [{ id: 'e1', name: 'Squat', sets: [{ reps: 5, weight: 315 }] }] };
    runHistory.mockResolvedValue({ ok: true, workoutId: 'w1', prior });

    const res = await appServices.history!.edit('w1', {
      name: 'Leg Day Heavy',
      date: '2026-10-21',
      exercises: [{ id: 'e1', name: 'Squat', sets: [{ reps: 5, weight: 335, unit: 'lbs' }] }],
    });

    expect(res).toEqual({ prior });
    expect(runHistory).toHaveBeenCalledWith('edit', {
      workoutId: 'w1',
      update: {
        name: 'Leg Day Heavy',
        date: '2026-10-21',
        ...(tz ? { tz } : {}),
        exercises: [{ id: 'e1', name: 'Squat', sets: [{ reps: 5, weight: 335, unit: 'lbs' }] }],
      },
    });
  });

  it('an edit that only renames sends no date, time zone or exercises', async () => {
    runHistory.mockResolvedValue({ ok: true, workoutId: 'w1', prior: {} });
    await appServices.history!.edit('w1', { name: 'New name' });
    expect(runHistory).toHaveBeenCalledWith('edit', { workoutId: 'w1', update: { name: 'New name' } });
  });

  it('undoEdit hands the prior back unchanged', async () => {
    const prior = { name: 'Leg Day', date: '2026-10-20', exercises: [{ id: 'e1', name: 'Squat', sets: [{ reps: 5 }] }] };
    runHistory.mockResolvedValue({ ok: true, workoutId: 'w1' });
    await appServices.history!.undoEdit('w1', prior);
    expect(runHistory).toHaveBeenCalledWith('undoEdit', { workoutId: 'w1', prior });
  });

  it('lets a refusal from the Worker reach the caller', async () => {
    runHistory.mockRejectedValueOnce(new Error('No workout history entry with id nope.'));
    await expect(appServices.history!.edit('nope', { name: 'x' })).rejects.toThrow('No workout history entry');
  });
});
