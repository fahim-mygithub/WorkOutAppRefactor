// worker/src/tools.test.ts
import { describe, it, expect } from 'vitest';
import { buildToolDefs, toolValidators } from './tools';

describe('tool catalog', () => {
  it('exposes exactly the applied tools', () => {
    expect(buildToolDefs().map((t) => t.name).sort()).toEqual([
      'addBuildExercise', 'addExercise', 'addExerciseToWorkout', 'addSets', 'addTrackedLift', 'adjustSet',
      'createWorkout', 'editBuildExercise', 'editPastWorkout', 'loadIntoBuild', 'logPastWorkout', 'logSet', 'openTab', 'planWorkout',
      'removeBuildExercise', 'removeExerciseFromWorkout', 'removeOpenSets', 'removeTrackedLift', 'setBuildName', 'setExerciseNote',
      'startWorkout', 'swapExercise', 'updateBenchmark', 'updateProfile', 'updateWorkout',
    ]);
  });
  it('validates adjustSet', () => {
    expect(toolValidators.adjustSet.safeParse({ exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'missed' }).success).toBe(true);
    expect(toolValidators.adjustSet.safeParse({ exerciseId: 'e1', fromSetIndex: -1 }).success).toBe(false);
  });
  it('validates a flat benchmark', () => {
    expect(toolValidators.updateBenchmark.safeParse({
      liftId: 'l1', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 3, reason: 'rep PR',
    }).success).toBe(true);
  });
  it('emits JSON schemas with required fields', () => {
    const logSet = buildToolDefs().find((t) => t.name === 'logSet')!;
    expect(logSet.input_schema.required).toEqual(expect.arrayContaining(['exerciseId', 'reps']));
  });
  it('emits numeric bounds from Zod checks', () => {
    const props = (name: string) =>
      buildToolDefs().find((t) => t.name === name)!.input_schema.properties as Record<string, Record<string, unknown>>;
    expect(props('logSet').rir).toMatchObject({ type: 'integer', minimum: 0, maximum: 5 });
    expect(props('logSet').weight).toMatchObject({ minimum: 0 });
    expect(props('adjustSet').weight).toMatchObject({ exclusiveMinimum: 0 });
    expect(props('adjustSet').weight).not.toHaveProperty('minimum');
  });
  it('says weights are in the workout unit', () => {
    const props = (name: string) =>
      buildToolDefs().find((t) => t.name === name)!.input_schema.properties as Record<string, { description?: string }>;
    expect(props('adjustSet').weight.description).toContain('in the workout unit');
    expect(props('swapExercise').weight.description).toContain('in the workout unit');
  });

  describe('live workout editing tools validation', () => {
    it('validates addSets', () => {
      expect(toolValidators.addSets.safeParse({ exerciseId: 'e1', count: 2, reps: 8, weight: 185 }).success).toBe(true);
      expect(toolValidators.addSets.safeParse({ exerciseId: 'e1' }).success).toBe(true);
      expect(toolValidators.addSets.safeParse({ exerciseId: 'e1', count: 0 }).success).toBe(false);
      expect(toolValidators.addSets.safeParse({ exerciseId: 'e1', count: 11 }).success).toBe(false);
    });

    it('validates removeOpenSets', () => {
      expect(toolValidators.removeOpenSets.safeParse({ exerciseId: 'e1', count: 2 }).success).toBe(true);
      expect(toolValidators.removeOpenSets.safeParse({ exerciseId: 'e1' }).success).toBe(true);
      expect(toolValidators.removeOpenSets.safeParse({ exerciseId: 'e1', count: 0 }).success).toBe(false);
    });

    it('validates addExerciseToWorkout', () => {
      expect(
        toolValidators.addExerciseToWorkout.safeParse({
          exerciseName: 'Incline Dumbbell Press',
          sets: 3,
          reps: 10,
          weight: 60,
          afterExerciseId: 'e1',
        }).success,
      ).toBe(true);
      expect(
        toolValidators.addExerciseToWorkout.safeParse({
          exerciseName: 'Incline Dumbbell Press',
        }).success,
      ).toBe(true);
      expect(
        toolValidators.addExerciseToWorkout.safeParse({
          sets: 3,
        }).success,
      ).toBe(false);
    });

    it('validates removeExerciseFromWorkout', () => {
      expect(toolValidators.removeExerciseFromWorkout.safeParse({ exerciseId: 'e1' }).success).toBe(true);
      expect(toolValidators.removeExerciseFromWorkout.safeParse({}).success).toBe(false);
    });

    it('validates setExerciseNote', () => {
      expect(toolValidators.setExerciseNote.safeParse({ exerciseId: 'e1', note: 'paused reps' }).success).toBe(true);
      expect(toolValidators.setExerciseNote.safeParse({ exerciseId: 'e1' }).success).toBe(false);
    });
  });
});

const bench = { name: 'Bench Press', sets: 3, reps: 8, weight: 135, unit: 'lbs' };

describe('workout tools', () => {
  it('createWorkout takes one or many workouts', () => {
    const one = { workouts: [{ name: 'Push', exercises: [bench] }] };
    const two = { workouts: [{ name: 'Push', exercises: [bench] }, { name: 'Pull', exercises: [{ name: 'Row', sets: 4, reps: 10 }] }] };
    expect(toolValidators.createWorkout.safeParse(one).success).toBe(true);
    expect(toolValidators.createWorkout.safeParse(two).success).toBe(true);
    expect(toolValidators.createWorkout.safeParse({ workouts: [] }).success).toBe(false);
    expect(toolValidators.createWorkout.safeParse({ workouts: [{ name: 'Empty', exercises: [] }] }).success).toBe(false);
    expect(toolValidators.createWorkout.safeParse({ workouts: [{ name: 'X', exercises: [{ ...bench, sets: 0 }] }] }).success).toBe(false);
  });
  it('updateWorkout needs the saved workout id', () => {
    expect(toolValidators.updateWorkout.safeParse({ workoutId: 'w1', name: 'Push A', reason: 'rename' }).success).toBe(true);
    expect(toolValidators.updateWorkout.safeParse({ name: 'Push A' }).success).toBe(false);
  });
  it('planWorkout takes a YYYY-MM-DD dateKey and a workout', () => {
    const plan = { dateKey: '2026-11-02', name: 'Legs', exercises: [{ name: 'Squat', sets: 5, reps: 5 }] };
    expect(toolValidators.planWorkout.safeParse(plan).success).toBe(true);
    expect(toolValidators.planWorkout.safeParse({ ...plan, dateKey: 'next monday' }).success).toBe(false);
  });
  it('emits nested array/object schemas for the workout tools', () => {
    const create = buildToolDefs().find((t) => t.name === 'createWorkout')!;
    const workouts = (create.input_schema.properties as Record<string, Record<string, unknown>>).workouts;
    expect(workouts).toMatchObject({ type: 'array', minItems: 1 });
    const item = workouts.items as { type: string; required: string[]; properties: Record<string, Record<string, unknown>> };
    expect(item.type).toBe('object');
    expect(item.required).toEqual(expect.arrayContaining(['name', 'exercises']));
    expect((item.properties.exercises.items as { required: string[] }).required).toEqual(expect.arrayContaining(['name', 'sets', 'reps']));
  });
});

describe('past workout tools', () => {
  it('validates logPastWorkout requires valid date and at least one exercise with sets', () => {
    const valid = {
      date: '2026-10-25',
      name: 'Push Day',
      exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 185, unit: 'lbs' }] }],
    };
    expect(toolValidators.logPastWorkout.safeParse(valid).success).toBe(true);
    expect(toolValidators.logPastWorkout.safeParse({ ...valid, date: 'yesterday' }).success).toBe(false);
    expect(toolValidators.logPastWorkout.safeParse({ ...valid, exercises: [] }).success).toBe(false);
    expect(
      toolValidators.logPastWorkout.safeParse({
        ...valid,
        exercises: [{ name: 'Bench Press', sets: [] }],
      }).success,
    ).toBe(false);
  });

  it('validates editPastWorkout requires workoutId and optional updates', () => {
    expect(toolValidators.editPastWorkout.safeParse({ workoutId: 'w1', name: 'Updated Push' }).success).toBe(true);
    expect(toolValidators.editPastWorkout.safeParse({ name: 'No ID' }).success).toBe(false);
    expect(
      toolValidators.editPastWorkout.safeParse({
        workoutId: 'w1',
        date: '2026-10-26',
        exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 225 }] }],
      }).success,
    ).toBe(true);
  });
});

describe('updateProfile', () => {
  it('offers only display and training fields', () => {
    const props = Object.keys(buildToolDefs().find((t) => t.name === 'updateProfile')!.input_schema.properties as object).sort();
    expect(props).toEqual(['autoStartTimer', 'defaultProgressionRate', 'defaultRestTime', 'displayName', 'reason', 'unitSystem', 'weightUnit']);
  });
  it('drops account fields and bounds rest time', () => {
    const r = toolValidators.updateProfile.safeParse({ weightUnit: 'kg', email: 'x@y.z', uid: 'other' });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toEqual({ weightUnit: 'kg' });
    expect(toolValidators.updateProfile.safeParse({ defaultRestTime: 5000 }).success).toBe(false);
  });
});

describe('addExercise', () => {
  it('takes name, muscle groups, equipment, setup cues and default sets', () => {
    const ok = {
      name: 'Hammer Strength Chest Press', muscleGroups: ['Chest', 'Triceps'], equipment: 'Machine',
      setupCues: ['Seat so handles are mid-chest.'], defaultSets: { sets: 3, reps: 10 },
    };
    expect(toolValidators.addExercise.safeParse(ok).success).toBe(true);
    expect(toolValidators.addExercise.safeParse({ ...ok, muscleGroups: [] }).success).toBe(false);
    expect(toolValidators.addExercise.safeParse({ ...ok, defaultSets: { sets: 30, reps: 10 } }).success).toBe(false);
  });
});

describe('app-control tools', () => {
  const props = (name: string) =>
    buildToolDefs().find((t) => t.name === name)!.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      required?: string[];
      additionalProperties?: boolean;
    };

  it('openTab takes one of the five tabs and nothing else', () => {
    const v = toolValidators.openTab;
    for (const tab of ['today', 'workout', 'build', 'library', 'profile']) {
      expect(v.safeParse({ tab }).success).toBe(true);
    }
    expect(v.safeParse({ tab: 'settings' }).success).toBe(false);
    expect(v.safeParse({}).success).toBe(false);
    expect(v.safeParse({ tab: 'build', selector: '#start' }).success).toBe(false);
    expect(props('openTab').properties.tab).toMatchObject({ enum: ['today', 'workout', 'build', 'library', 'profile'] });
    expect(props('openTab').required).toEqual(['tab']);
  });

  it('startWorkout needs exactly one of workoutId, planId or today', () => {
    const v = toolValidators.startWorkout;
    expect(v.safeParse({ workoutId: 'w1' }).success).toBe(true);
    expect(v.safeParse({ planId: 'p1' }).success).toBe(true);
    expect(v.safeParse({ today: true }).success).toBe(true);
    expect(v.safeParse({}).success).toBe(false);
    expect(v.safeParse({ today: false }).success).toBe(false);
    expect(v.safeParse({ workoutId: 'w1', planId: 'p1' }).success).toBe(false);
    expect(v.safeParse({ workoutId: 'w1', script: 'click()' }).success).toBe(false);
  });

  it('startWorkout overrides name one exercise and change something, within bounds', () => {
    const v = toolValidators.startWorkout;
    const ok = (o: Record<string, unknown>) => v.safeParse({ workoutId: 'w1', overrides: [o] }).success;
    expect(ok({ exerciseName: 'Bench Press', weight: 185 })).toBe(true);
    expect(ok({ index: 0, sets: 4, reps: 6 })).toBe(true);
    expect(ok({ weight: 185 })).toBe(false); // which exercise?
    expect(ok({ exerciseName: 'Bench Press', index: 0, weight: 185 })).toBe(false);
    expect(ok({ exerciseName: 'Bench Press' })).toBe(false); // nothing to change
    expect(ok({ index: 0, sets: 11 })).toBe(false);
    expect(ok({ index: 0, weight: -5 })).toBe(false);
    expect(ok({ index: 0, reps: 2.5 })).toBe(false);
    expect(ok({ index: 0, weight: 100, rpe: 8 })).toBe(false);
  });

  it('emits the refined schemas as plain objects for the model', () => {
    const start = props('startWorkout');
    expect(start.additionalProperties).toBe(false);
    expect(Object.keys(start.properties).sort()).toEqual(['overrides', 'planId', 'reason', 'today', 'workoutId']);
    const item = (start.properties.overrides as { items: { type: string; properties: Record<string, unknown> } }).items;
    expect(item.type).toBe('object');
    expect(Object.keys(item.properties).sort()).toEqual(['exerciseName', 'index', 'reps', 'sets', 'weight']);
    expect(Object.keys(props('loadIntoBuild').properties).sort()).toEqual(['exercises', 'name', 'reason', 'workoutId']);
  });

  it('loadIntoBuild takes a saved workout or an exercise list, not both', () => {
    const v = toolValidators.loadIntoBuild;
    const list = [{ name: 'Barbell Bench Press', sets: 3, reps: 8, repsMax: 12, weight: 135, unit: 'lbs' }];
    expect(v.safeParse({ workoutId: 'w1' }).success).toBe(true);
    expect(v.safeParse({ name: 'Push', exercises: list }).success).toBe(true);
    expect(v.safeParse({ workoutId: 'w1', exercises: list }).success).toBe(false);
    expect(v.safeParse({ name: 'Push' }).success).toBe(false);
    expect(v.safeParse({ exercises: [] }).success).toBe(false);
    expect(v.safeParse({ exercises: [{ name: 'Bench', sets: 0, reps: 8 }] }).success).toBe(false);
  });
});

describe('Build screen edit tools', () => {
  it('setBuildName takes one name and nothing else', () => {
    const v = toolValidators.setBuildName;
    expect(v.safeParse({ name: 'Push day' }).success).toBe(true);
    expect(v.safeParse({}).success).toBe(false);
    expect(v.safeParse({ name: '' }).success).toBe(false);
    expect(v.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
    expect(v.safeParse({ name: 'Push', selector: '#name' }).success).toBe(false);
  });

  it('editBuildExercise names an exercise and changes at least one thing, within bounds', () => {
    const v = toolValidators.editBuildExercise;
    expect(v.safeParse({ exerciseName: 'Bench Press', sets: 4 }).success).toBe(true);
    expect(v.safeParse({ exerciseName: 'Bench Press', reps: 8, repsMax: 12, weight: 135, unit: 'lbs' }).success).toBe(true);
    expect(v.safeParse({ exerciseName: 'Bench Press', weight: 0 }).success).toBe(true); // clears the load
    expect(v.safeParse({ exerciseName: 'Bench Press' }).success).toBe(false); // nothing to change
    expect(v.safeParse({ sets: 4 }).success).toBe(false); // which exercise?
    expect(v.safeParse({ exerciseName: 'Bench Press', sets: 11 }).success).toBe(false);
    expect(v.safeParse({ exerciseName: 'Bench Press', weight: -5 }).success).toBe(false);
    expect(v.safeParse({ exerciseName: 'Bench Press', repsMax: 12 }).success).toBe(false); // a range needs reps
    expect(v.safeParse({ exerciseName: 'Bench Press', reps: 12, repsMax: 8 }).success).toBe(false);
    expect(v.safeParse({ exerciseName: 'Bench Press', unit: 'stone' }).success).toBe(false);
    expect(v.safeParse({ exerciseName: 'Bench Press', sets: 3, script: 'x' }).success).toBe(false);
  });

  it('addBuildExercise and removeBuildExercise take a name', () => {
    expect(toolValidators.addBuildExercise.safeParse({ exerciseName: 'Barbell Row' }).success).toBe(true);
    expect(toolValidators.addBuildExercise.safeParse({ exerciseName: 'Barbell Row', sets: 3, reps: 10, weight: 95 }).success).toBe(true);
    expect(toolValidators.addBuildExercise.safeParse({}).success).toBe(false);
    expect(toolValidators.removeBuildExercise.safeParse({ exerciseName: 'Barbell Row' }).success).toBe(true);
    expect(toolValidators.removeBuildExercise.safeParse({ exerciseName: 'Barbell Row', sets: 3 }).success).toBe(false);
  });

  it('emits plain object schemas with the name required', () => {
    const def = (n: string) => buildToolDefs().find((t) => t.name === n)!.input_schema;
    expect(def('editBuildExercise').required).toEqual(['exerciseName']);
    expect(Object.keys(def('editBuildExercise').properties as object).sort()).toEqual(
      ['exerciseName', 'reps', 'repsMax', 'sets', 'unit', 'weight'],
    );
    expect(def('setBuildName').required).toEqual(['name']);
  });
});
