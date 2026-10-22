import type { WorkoutExercise, WorkoutSet, Exercise } from '../types/exercise';
import type { TrackedLift, SessionGoal } from '../types/trackedLifts';
import type { ExerciseHistory, WorkoutSummary } from '../types/exerciseHistory';
import { prescribe } from './trackedLiftProgression';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';

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

    return {
      id: `exercise-reuse-${Date.now()}-${hIdx}`,
      exercise: dbExercise,
      sets,
      restTime: 120,
      notes: history.customTitle || history.notes || undefined,
      ...(matchedLift && {
        tracked: { liftId: matchedLift.id, goal: 'volume' as SessionGoal },
      }),
    };
  });
}

/**
 * Prepares planned workout exercises for live execution:
 * For tracked lifts with progression, progression is freshly computed/prescribed.
 * For other exercises, the copied weights, reps, and set counts are preserved.
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
      const goal = ex.tracked?.goal ?? defaultGoal;
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

      return {
        ...ex,
        sets,
        restTime: prescribed.restTime || ex.restTime || 120,
        notes: prescribed.notes || ex.notes,
        tracked: { liftId: lift.id, goal },
      };
    }

    // Non-progression lift or accessory: keep exact sets/weights/reps as planned
    return {
      ...ex,
      ...(lift && !ex.tracked && {
        tracked: { liftId: lift.id, goal: defaultGoal },
      }),
    };
  });
}
