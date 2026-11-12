import { describe, it, expect } from 'vitest';
import type { ActiveWorkout, WorkoutExercise } from '../types/exercise';
import type { TrackedLift } from '../types/trackedLifts';
import type { Exercise } from '../types/exercise';
import { buildAiContext, CONTEXT_BUDGET } from './context';
import type { AiChatContext } from './types';

const bench: TrackedLift = {
  id: 'l1', name: 'Bench Press', category: 'Push', progression: true,
  load: { kind: 'weight', value: 265, unit: 'lb' }, target: { kind: 'repMax', reps: 1 },
};

const workout = {
  id: 'w', name: 'Push', currentExerciseIndex: 0, currentSetIndex: 0,
  exercises: [{
    id: 'e1',
    exercise: { id: 'x', name: 'Bench', videoLinks: ['u'], instructions: ['long'] },
    sets: [
      { id: 's', reps: 3, weight: 225, unit: 'lbs', completed: true, rir: 1 },
      { id: 's2', reps: 10, repMin: 8, repMax: 12, weight: 185, unit: 'lbs', completed: false },
    ],
    tracked: { liftId: 'l1', goal: 'strength' },
  }],
} as unknown as ActiveWorkout;

describe('buildAiContext', () => {
  it('sends compact workout and lifts with next prescriptions', () => {
    const ctx = buildAiContext({ screen: 'workout', units: 'lbs', focusExerciseId: 'e1', activeWorkout: workout, trackedLifts: [bench] });
    const json = JSON.stringify(ctx);
    expect(json).not.toContain('videoLinks');
    expect(json).not.toContain('instructions');
    expect(ctx.trackedLifts[0]).toMatchObject({
      id: 'l1', next: { volume: expect.any(String), strength: expect.any(String), checkpoint: expect.any(String) },
    });
  });

  it('is assignable to the chat context the client sends', () => {
    const ctx: AiChatContext = buildAiContext({ screen: 'other', units: 'kg', activeWorkout: null, trackedLifts: [] });
    expect(ctx.activeWorkout).toBeUndefined();
  });

  it('exposes the ids and indexes the tool planner expects', () => {
    const ctx = buildAiContext({ screen: 'workout', units: 'lbs', activeWorkout: workout, trackedLifts: [bench] });
    const ex = ctx.activeWorkout!.exercises[0];
    expect(ex).toMatchObject({ id: 'e1', name: 'Bench', trackedLiftId: 'l1', goal: 'strength', unit: 'lbs' });
    expect(ex.sets.map((s) => s.index)).toEqual([0, 1]);
    expect(ex.sets[0]).toEqual({ index: 0, reps: 3, weight: 225, rir: 1, completed: true });
    expect(ex.sets[1]).toMatchObject({ index: 1, repMin: 8, repMax: 12, completed: false });
    expect(ctx.trackedLifts[0].id).toBe('l1');
  });

  it('describes prescriptions, with rep ranges as min-max', () => {
    const ctx = buildAiContext({ screen: 'workout', units: 'lbs', activeWorkout: null, trackedLifts: [bench] });
    expect(ctx.trackedLifts[0].next!.volume).toMatch(/^8-12@\d+/);
    expect(ctx.trackedLifts[0].next!.strength).toMatch(/^3@\d+/);
  });

  it('includes step and unit, and rounds the estimate to a loadable number', () => {
    const lift: TrackedLift = {
      ...bench, step: 2.5,
      sessions: [{ date: '2026-09-01', goal: 'volume', sets: [{ reps: 9, weight: 187.5, rir: 2 }] }],
    };
    const [l] = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [lift] }).trackedLifts;
    expect(l).toMatchObject({ step: 2.5, unit: 'lb', benchmark: expect.stringContaining('265') });
    expect(l.estimate! % 2.5).toBe(0);
  });

  it('keeps only date, goal and compact sets in recent sessions (last 3)', () => {
    const sessions = Array.from({ length: 5 }, (_, k) => ({
      date: `2026-09-0${k + 1}`, goal: 'strength' as const,
      sets: [{ reps: 3, weight: 225, rir: 1, extra: 'x' }],
      junk: 'nope',
    }));
    const lift = { ...bench, sessions } as unknown as TrackedLift;
    const [l] = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [lift] }).trackedLifts;
    expect(l.recentSessions).toHaveLength(3);
    expect(l.recentSessions![0]).toEqual({ date: '2026-09-03', goal: 'strength', sets: [{ reps: 3, weight: 225, rir: 1 }] });
  });

  it('leaves out next and status for non-progression lifts', () => {
    const [l] = buildAiContext({
      screen: 'build', units: 'lbs', activeWorkout: null,
      trackedLifts: [{ ...bench, progression: false }],
    }).trackedLifts;
    expect(l.next).toBeUndefined();
    expect(l.status).toBeUndefined();
  });

  it('stays well under the Worker size cap for a realistic day', () => {
    const exercises: WorkoutExercise[] = Array.from({ length: 8 }, (_, e) => ({
      id: `exercise-${e}-abcdef123456`,
      exercise: { id: `lib-${e}`, name: `Exercise number ${e}`, videoLinks: ['https://x/y.mp4'], instructions: ['a '.repeat(200)] } as never,
      tracked: { liftId: `lift-${e}-abcdef123456`, goal: 'volume' },
      sets: Array.from({ length: 5 }, (_, s) => ({
        id: `set-${e}-${s}`, reps: 10, repMin: 8, repMax: 12, weight: 137.5, unit: 'lbs' as const, rir: 2, completed: s < 2,
      })),
    }));
    const lifts: TrackedLift[] = Array.from({ length: 12 }, (_, k) => ({
      id: `lift-${k}-abcdef123456`, name: `Tracked lift number ${k}`, category: 'Push',
      progression: true, step: 2.5, equipment: 'barbell',
      cycle: { volume: 1, strength: 1 },
      load: { kind: 'weight', value: 200 + k, unit: 'lb' }, target: { kind: 'reps', min: 5, max: 8 },
      sessions: Array.from({ length: 6 }, (_, s) => ({
        date: `2026-09-${String(s + 10)}T18:30:00.000Z`, goal: s % 2 ? 'strength' : 'volume',
        sets: Array.from({ length: 4 }, () => ({ reps: 9, weight: 142.5, rir: 2 })),
      })),
    }));
    const ctx = buildAiContext({
      screen: 'workout', units: 'lbs', focusExerciseId: 'exercise-0-abcdef123456',
      activeWorkout: { id: 'w', name: 'Upper', exercises, currentExerciseIndex: 0, currentSetIndex: 0, startTime: '', duration: 0, isActive: true },
      trackedLifts: lifts,
    });
    expect(JSON.stringify(ctx).length).toBeLessThan(20_000);
  });

  it('sends session dates as the date only, and the equipment when set', () => {
    const lift: TrackedLift = {
      ...bench, equipment: 'barbell',
      sessions: [{ date: '2026-09-01T18:30:00.000Z', goal: 'volume', sets: [{ reps: 9, weight: 185 }] }],
    };
    const [l] = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [lift] }).trackedLifts;
    expect(l.equipment).toBe('barbell');
    expect(l.recentSessions![0].date).toBe('2026-09-01');
    const [plain] = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [bench] }).trackedLifts;
    expect(plain).not.toHaveProperty('equipment');
  });

  it('trims lifts outside the workout to stay under budget, never the ones in it', () => {
    const lifts: TrackedLift[] = Array.from({ length: 40 }, (_, k) => ({
      id: `lift-${k}-abcdef123456`, name: `Tracked lift number ${k}`, category: 'Push',
      progression: true, step: 2.5, equipment: 'barbell', cycle: { volume: 1, strength: 1 },
      load: { kind: 'weight', value: 200 + k, unit: 'lb' }, target: { kind: 'reps', min: 5, max: 8 },
      sessions: Array.from({ length: 6 }, (_, s) => ({
        date: `2026-09-${String(s + 10)}T18:30:00.000Z`, goal: s % 2 ? 'strength' : 'volume',
        sets: Array.from({ length: 6 }, () => ({ reps: 9, weight: 142.5, rir: 2 })),
      })),
    }));
    const exercises: WorkoutExercise[] = Array.from({ length: 8 }, (_, e) => ({
      id: `exercise-${e}`, exercise: { id: `lib-${e}`, name: `Exercise ${e}` } as never,
      // The last lifts are the ones in today's workout.
      tracked: { liftId: `lift-${32 + e}-abcdef123456`, goal: 'volume' },
      sets: Array.from({ length: 5 }, (_, s) => ({ id: `set-${e}-${s}`, reps: 10, weight: 137.5, unit: 'lbs' as const, completed: false })),
    }));
    const ctx = buildAiContext({
      screen: 'workout', units: 'lbs', focusExerciseId: 'exercise-7',
      activeWorkout: { id: 'w', name: 'Upper', exercises, currentExerciseIndex: 0, currentSetIndex: 0, startTime: '', duration: 0, isActive: true },
      trackedLifts: lifts,
    });
    expect(JSON.stringify(ctx).length).toBeLessThan(40_000);
    expect(ctx.trackedLifts).toHaveLength(40);
    for (const e of exercises) {
      const l = ctx.trackedLifts.find((x) => x.id === e.tracked!.liftId)!;
      expect(l.next).toBeDefined();
      expect(l.recentSessions).toHaveLength(3);
    }
    // Other lifts keep at least their id, name and benchmark.
    expect(ctx.trackedLifts[0]).toMatchObject({ id: 'lift-0-abcdef123456', name: 'Tracked lift number 0', benchmark: expect.any(String) });
    expect(ctx.trackedLifts[0].recentSessions).toBeUndefined();
  });

  it('offers library alternatives per workout exercise, including custom ones', () => {
    const rdl = { id: 'x-rdl', name: 'Barbell Romanian Deadlift', equipment: 'Barbell', muscleGroups: ['Glutes', 'Hamstrings'] } as Exercise;
    const library = [
      rdl,
      { id: 'x-db', name: 'Dumbbell Romanian Deadlift', equipment: 'Dumbbells', muscleGroups: ['Glutes', 'Hamstrings'] },
      { id: 'x-bp', name: 'Barbell Bench Press', equipment: 'Barbell', muscleGroups: ['Chest'] },
      { id: 'c1', name: 'My Band Hinge', equipment: 'Band', muscleGroups: ['Hamstrings'] },
    ] as Exercise[];
    const hinge = { ...workout, exercises: [{ ...workout.exercises[0], exercise: rdl }] } as ActiveWorkout;
    const ctx = buildAiContext({ screen: 'workout', units: 'lbs', activeWorkout: hinge, trackedLifts: [bench], library });
    expect(ctx.activeWorkout!.exercises[0].alternatives).toEqual(['Dumbbell Romanian Deadlift', 'My Band Hinge']);
    // No muscle groups or movement words to match on → no key at all.
    const mystery = { ...workout, exercises: [{ ...workout.exercises[0], exercise: { id: 'x-m', name: 'Mystery' } }] } as ActiveWorkout;
    const plain = buildAiContext({ screen: 'workout', units: 'lbs', activeWorkout: mystery, trackedLifts: [bench], library });
    expect(plain.activeWorkout!.exercises[0]).not.toHaveProperty('alternatives');
  });

  it('drops alternatives from non-focus exercises first when over budget', () => {
    const library = Array.from({ length: 12 }, (_, k) => ({
      id: `lib-${k}`, name: `A rather long library exercise name number ${k} with extra words to fill`,
      equipment: `Kit ${k}`, muscleGroups: ['Chest'],
    })) as Exercise[];
    const lifts: TrackedLift[] = Array.from({ length: 40 }, (_, k) => ({
      id: `lift-${k}-abcdef123456`, name: `Tracked lift number ${k}`, category: 'Push',
      load: { kind: 'weight', value: 200 + k, unit: 'lb' }, target: { kind: 'reps', min: 5, max: 8 },
    }));
    // Many tracked exercises in today's workout, so lift trimming alone cannot fit the budget.
    const exercises: WorkoutExercise[] = Array.from({ length: 40 }, (_, e) => ({
      id: `exercise-${e}`, exercise: { id: `own-${e}`, name: `Exercise ${e}`, equipment: 'Barbell', muscleGroups: ['Chest'] } as never,
      tracked: { liftId: `lift-${e}-abcdef123456`, goal: 'volume' },
      sets: Array.from({ length: 5 }, (_, s) => ({ id: `set-${e}-${s}`, reps: 10, weight: 137.5, unit: 'lbs' as const, completed: false })),
    }));
    const activeWorkout = { id: 'w', name: 'Upper', exercises, currentExerciseIndex: 0, currentSetIndex: 0, startTime: '', duration: 0, isActive: true };
    const full = buildAiContext({ screen: 'workout', units: 'lbs', activeWorkout, trackedLifts: lifts });
    const withAlts = buildAiContext({ screen: 'workout', units: 'lbs', focusExerciseId: 'exercise-3', activeWorkout, trackedLifts: lifts, library });
    // Alternatives would push it over; the focus exercise keeps its own.
    expect(JSON.stringify(full).length).toBeLessThan(CONTEXT_BUDGET);
    expect(JSON.stringify(withAlts).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    const focus = withAlts.activeWorkout!.exercises.find((e) => e.id === 'exercise-3')!;
    expect(focus.alternatives).toHaveLength(8);
    expect(JSON.stringify(full).length + 40 * JSON.stringify(focus.alternatives).length).toBeGreaterThan(CONTEXT_BUDGET);
    expect(withAlts.activeWorkout!.exercises.filter((e) => e.alternatives)).toHaveLength(1);
  });

  it('leaves a context under budget untrimmed', () => {
    const lift: TrackedLift = { ...bench, sessions: [{ date: '2026-09-01', goal: 'volume', sets: [{ reps: 9, weight: 185 }] }] };
    const [l] = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [lift] }).trackedLifts;
    expect(l.recentSessions).toHaveLength(1);
    expect(l.next).toBeDefined();
  });
});

describe('buildAiContext — profile and today', () => {
  const preferences = {
    theme: 'system', unitSystem: 'imperial', weightUnit: 'lbs', defaultRestTime: 120, autoStartTimer: true,
    defaultProgressionRate: 'intermediate', keyboardShortcuts: { enabled: true, showInWorkout: true },
    notifications: { workoutReminders: true, restTimerAlerts: true, achievements: true },
  } as const;

  it('does not send saved workouts in client context (now read tools)', () => {
    const ctx = buildAiContext({
      screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [],
    });
    expect('savedWorkouts' in ctx).toBe(false);
  });

  it('sends only display and training profile fields, plus today', () => {
    const ctx = buildAiContext({
      screen: 'other', units: 'lbs', activeWorkout: null, trackedLifts: [],
      profile: { displayName: 'Alex', preferences: { ...preferences } }, today: '2026-10-30',
    });
    expect(ctx.profile).toEqual({
      displayName: 'Alex', weightUnit: 'lbs', unitSystem: 'imperial', defaultRestTime: 120,
      defaultProgressionRate: 'intermediate', autoStartTimer: true,
    });
    expect(ctx.today).toBe('2026-10-30');
  });
});

describe('buildAiContext — tab and today plans', () => {
  it('sends the tab and at most three of today plans, id and name only', () => {
    const plans = [1, 2, 3, 4].map((k) => ({ id: `p${k}`, name: `Plan ${k}`, exercises: ['big'], status: 'planned' }));
    const ctx = buildAiContext({ screen: 'other', units: 'lbs', activeWorkout: null, trackedLifts: [], tab: 'build', todayPlans: plans });
    expect(ctx.tab).toBe('build');
    expect(ctx.todayPlans).toEqual([{ id: 'p1', name: 'Plan 1' }, { id: 'p2', name: 'Plan 2' }, { id: 'p3', name: 'Plan 3' }]);
  });
  it('leaves them out when there are none', () => {
    const ctx = buildAiContext({ screen: 'other', units: 'lbs', activeWorkout: null, trackedLifts: [], todayPlans: [] });
    expect(ctx).not.toHaveProperty('tab');
    expect(ctx).not.toHaveProperty('todayPlans');
  });
});

describe('buildAiContext screen block', () => {
  const snapshot = {
    tab: 'build' as const,
    title: 'Build workout',
    summary: 'Draft "Push", 2 exercises, text tab',
    data: { name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: '8' }] },
  };

  it('sends the published screen as screen {tab, title, summary, data}', () => {
    const ctx = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: [], tab: 'build', screenSnapshot: snapshot });
    expect(ctx.screen).toEqual(snapshot);
    expect(ctx.tab).toBe('build');
  });

  it('falls back to the bare word when no screen published', () => {
    const ctx = buildAiContext({ screen: 'other', units: 'lbs', activeWorkout: null, trackedLifts: [] });
    expect(ctx.screen).toBe('other');
  });

  it('keeps the screen block even when other lifts are trimmed to fit the budget', () => {
    const lifts = Array.from({ length: 120 }, (_, k): TrackedLift => ({
      id: `l${k}`, name: `Lift number ${k}`, category: 'Push', progression: true,
      load: { kind: 'weight', value: 100 + k, unit: 'lb' }, target: { kind: 'reps', min: 5 },
      sessions: Array.from({ length: 6 }, (_, n) => ({
        date: `2026-0${(n % 9) + 1}-10`, goal: 'volume' as const,
        sets: [{ reps: 5, weight: 100 + k }, { reps: 5, weight: 100 + k }, { reps: 5, weight: 100 + k }],
      })),
    }) as TrackedLift);
    const ctx = buildAiContext({ screen: 'build', units: 'lbs', activeWorkout: null, trackedLifts: lifts, screenSnapshot: snapshot });
    expect(JSON.stringify(ctx).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(ctx.screen).toEqual(snapshot);
  });
});
