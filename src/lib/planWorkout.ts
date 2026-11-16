import {
  effectiveEmphasis,
  emphasisOfGoal,
  syncExerciseEmphasis,
  type WorkoutExercise,
  type WorkoutSet,
  type Exercise,
} from '../types/exercise';
import type { TrackedLift, SessionGoal } from '../types/trackedLifts';
import type { ExerciseHistory } from '../types/exerciseHistory';
import type { ParsedExercise, ParsedSet, ParsedWorkout } from '../parser/types';
import { prescribe, type TrackedParsedExercise } from './trackedLiftProgression';
import { orderForWorkout } from './builderSupersets';
import { workoutText as formatWorkoutText } from '../ai/workoutText';
import type { DateKey } from './dateKey';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';

export interface PlanBuildPreset {
  id: string;
  name: string;
  workout: {
    name: string;
    workoutText: string;
    parsedWorkout: ParsedWorkout;
  };
  planEdit: {
    planId: string;
    dateKey: DateKey;
    exercises: TrackedParsedExercise[];
  };
}

/** Strips auto-generated `Superset (1/2)` prefixes added when converting to player exercises. */
export function stripAutoSupersetNote(notes?: string): string | undefined {
  if (!notes) return undefined;
  const cleaned = notes
    .replace(/^Superset(?:\s+\d+)?(?:\s*\(\d+\/\d+\))?\s*(?:·\s*)?/i, '')
    .trim();
  return cleaned || undefined;
}

/**
 * Converts a `PlannedWorkout` into a `BuildPreset` for the Builder, preserving
 * exercises, per-set weights/rep-ranges/units, supersets (`supersetGroup` +
 * `parsedWorkout.supersets`), notes, restTime, tracked metadata, and `emphasis`.
 */
export function planToBuildPreset(plan: PlannedWorkout): PlanBuildPreset {
  // Count members per supersetId so only real 2+ partner supersets get grouped.
  const supersetCounts = new Map<string, number>();
  for (const ex of plan.exercises) {
    if (ex.isSuperset && ex.supersetId) {
      supersetCounts.set(ex.supersetId, (supersetCounts.get(ex.supersetId) ?? 0) + 1);
    }
  }

  const groupIds = new Map<string, number>();
  let nextGroup = 1;

  const configuredExercises: TrackedParsedExercise[] = plan.exercises.map((ex) => {
    const emphasis = effectiveEmphasis(ex);
    const tracked = ex.tracked
      ? {
          liftId: ex.tracked.liftId,
          goal: ex.tracked.goal === 'checkpoint' ? ('checkpoint' as const) : (emphasis ?? ex.tracked.goal),
        }
      : undefined;

    let supersetGroup: number | undefined;
    if (ex.isSuperset && ex.supersetId && (supersetCounts.get(ex.supersetId) ?? 0) > 1) {
      if (!groupIds.has(ex.supersetId)) {
        groupIds.set(ex.supersetId, nextGroup++);
      }
      supersetGroup = groupIds.get(ex.supersetId);
    }

    const sets: ParsedSet[] =
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            reps:
              s.repMin !== undefined && s.repMax !== undefined && s.repMax > s.repMin
                ? { min: s.repMin, max: s.repMax }
                : s.reps,
            ...(s.weight && s.weight > 0 ? { weight: s.weight, unit: s.unit ?? 'lbs' } : {}),
            ...(s.time ? { time: s.time } : {}),
            ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
            ...(s.distance !== undefined ? { distance: s.distance } : {}),
          }))
        : [{ reps: 10 }];

    const notes = ex.isSuperset ? stripAutoSupersetNote(ex.notes) : ex.notes?.trim() || undefined;

    return {
      name: ex.customTitle || ex.exercise.name,
      sets,
      ...(ex.restTime ? { restTime: ex.restTime } : {}),
      ...(notes ? { notes } : {}),
      ...(tracked ? { tracked } : {}),
      ...(emphasis ? { emphasis } : {}),
      ...(supersetGroup !== undefined ? { supersetGroup } : {}),
    };
  });

  const stripGroup = (item: TrackedParsedExercise): ParsedExercise => {
    const { supersetGroup: _g, ...rest } = item;
    return rest;
  };

  const plain: ParsedExercise[] = [];
  const supersets: ParsedExercise[][] = [];
  for (const unit of orderForWorkout(configuredExercises)) {
    if (Array.isArray(unit) && unit.length > 1) {
      supersets.push(unit.map(stripGroup));
    } else {
      const single = Array.isArray(unit) ? unit[0] : unit;
      if (single) plain.push(stripGroup(single));
    }
  }

  const parsedWorkout: ParsedWorkout = { exercises: plain, supersets };

  return {
    id: `plan-edit-${plan.id}-${Date.now()}`,
    name: plan.name,
    workout: {
      name: plan.name,
      workoutText: formatWorkoutText(parsedWorkout),
      parsedWorkout,
    },
    planEdit: {
      planId: plan.id,
      dateKey: plan.dateKey,
      exercises: configuredExercises,
    },
  };
}

/**
 * Creates workout exercises by copying what the user actually lifted last time:
 * - Only completed sets from that history entry are copied.
 * - Set counts, logged weight, and actual reps are preserved.
 * - If an exercise matches a tracked lift, its tracked reference is attached.
 */
export function reuseWorkoutExercises(
  exerciseHistories: ExerciseHistory[],
  catalog: Exercise[],
  trackedLifts?: TrackedLift[],
): WorkoutExercise[] {
  const catalogMap = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));

  return exerciseHistories.map((history, hIdx) => {
    const dbExercise =
      catalogMap.get(history.exerciseName.toLowerCase()) ?? {
        id: `custom-${history.exerciseName.toLowerCase().replace(/\s+/g, '-')}`,
        name: history.exerciseName,
        muscleGroup: 'Other',
        muscleGroups: ['Other'],
        equipment: 'Other',
        videoLinks: [],
        instructions: [],
        difficulty: 'Intermediate' as const,
        force: null,
        grips: null,
        mechanic: null,
        searchKeywords: [history.exerciseName.toLowerCase()],
        createdAt: '',
        updatedAt: '',
      };

    // Filter for completed sets only; fall back to all sets if none marked completed
    const completedSets = history.sets.filter((s) => s.completed);
    const setsToCopy = completedSets.length > 0 ? completedSets : history.sets;

    const sets: WorkoutSet[] = setsToCopy.map((s, sIdx) => ({
      id: `set-reuse-${Date.now()}-${hIdx}-${sIdx}`,
      reps: s.actualReps !== undefined && s.actualReps > 0 ? s.actualReps : (s.targetReps || 0),
      weight: s.weight,
      unit: s.unit || 'lbs',
      completed: false,
    }));

    const matchedLift = trackedLifts?.find(
      (l) => l.name.trim().toLowerCase() === history.exerciseName.trim().toLowerCase(),
    );
    const goal: SessionGoal = history.emphasis ?? 'volume';

    return syncExerciseEmphasis({
      id: `exercise-reuse-${Date.now()}-${hIdx}`,
      exercise: dbExercise,
      sets,
      restTime: 120,
      notes: history.customTitle || history.notes || undefined,
      ...(history.emphasis ? { emphasis: history.emphasis } : {}),
      ...(matchedLift && {
        tracked: { liftId: matchedLift.id, goal },
      }),
    });
  });
}

/**
 * Prepares planned workout exercises for live execution:
 * For tracked lifts with progression, progression is freshly computed/prescribed.
 * For other exercises, the copied weights, reps, set counts, and emphasis are preserved.
 */
export function preparePlannedWorkoutForExecution(
  planned: PlannedWorkout,
  trackedLifts: TrackedLift[],
  defaultGoal: SessionGoal = 'volume',
): WorkoutExercise[] {
  return planned.exercises.map((ex, exIdx) => {
    const lift = trackedLifts.find(
      (l) =>
        l.id === ex.tracked?.liftId ||
        l.name.trim().toLowerCase() === ex.exercise.name.trim().toLowerCase(),
    );

    if (lift && lift.progression) {
      const goal: SessionGoal =
        ex.tracked?.goal === 'checkpoint'
          ? 'checkpoint'
          : (effectiveEmphasis(ex) ?? ex.tracked?.goal ?? defaultGoal);
      const prescribed = prescribe(lift, goal);
      const sets: WorkoutSet[] = prescribed.sets.map((set, sIdx) => ({
        id: `set-${planned.id}-${exIdx}-${sIdx}`,
        reps: typeof set.reps === 'number' ? set.reps : set.reps.min,
        ...(typeof set.reps === 'object' && { repMin: set.reps.min, repMax: set.reps.max }),
        weight: set.weight,
        unit: set.unit,
        ...(set.time && { time: set.time }),
        completed: false,
      }));
      const emphasis = emphasisOfGoal(goal);

      return {
        ...ex,
        sets,
        restTime: prescribed.restTime || ex.restTime || 120,
        notes: prescribed.notes || ex.notes,
        tracked: { liftId: lift.id, goal },
        ...(emphasis ? { emphasis } : { emphasis: undefined }),
      };
    }

    // Non-progression lift or accessory: keep exact sets/weights/reps/emphasis as planned
    return syncExerciseEmphasis({
      ...ex,
      ...(lift && !ex.tracked && {
        tracked: { liftId: lift.id, goal: ex.emphasis ?? defaultGoal },
      }),
    });
  });
}
