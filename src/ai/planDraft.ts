/**
 * The Planned Workout edit sheet's draft as the assistant reads and edits it.
 *
 * PlanEditSheet holds its local draft (`name` and `PlanDraftExercise[]`) until
 * the lifter taps Save (`updatePlanned`) or Cancel. Pure helpers here convert
 * between `WorkoutExercise[]` and the sheet's draft, build the capped screen
 * snapshot sent with chat turns, and compute one-exercise edits for the four
 * plan-editor AI tools (`setPlanName`, `editPlanExercise`, `addPlanExercise`,
 * `removePlanExercise`).
 */
import type { Exercise, WorkoutExercise, WorkoutSet } from '../types/exercise';
import { normalName } from './buildDraft';
import type { ScreenSnapshot } from './screenSnapshot';

/** Maximum exercises listed in the screen snapshot's data block (before capScreen). */
const MAX_PLAN_EXERCISES = 25;

export interface PlanDraftExercise {
  key: string;
  base: WorkoutExercise;
  setsCount: string;
  reps: string;
  weight: string;
  unit: 'lbs' | 'kg';
}

/** Held in `ai.planDraft` for planning edit tools while the sheet is open. Never sent as-is. */
export interface PlanDraftState {
  planId: string;
  date: string;
  name: string;
  exercises: PlanDraftExercise[];
}

/** One exercise in the plan-editor screen snapshot (`screen.data.exercises`). */
export interface PlanSnapshotExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  unit: 'lbs' | 'kg';
}

/** What the assistant may change on one planned exercise. */
export interface PlanChange {
  sets?: number;
  reps?: number;
  /** Load per set; 0 clears it. */
  weight?: number;
  unit?: 'lbs' | 'kg';
}

export type PlanDraftEdit =
  | { ok: true; exercises: PlanDraftExercise[]; name: string; line: string }
  | { ok: false; reason: string };

const fail = (reason: string): PlanDraftEdit => ({ ok: false, reason });

export function toPlanDraftExercises(
  exercises: WorkoutExercise[],
  defaultUnit: 'lbs' | 'kg',
): PlanDraftExercise[] {
  return exercises.map((ex, idx) => {
    const firstSet = ex.sets[0];
    const unit = firstSet?.unit ?? defaultUnit;
    return {
      key: `${ex.id}-${idx}`,
      base: {
        ...ex,
        sets: ex.sets.map((s) => ({ ...s })),
      },
      setsCount: String(ex.sets.length),
      reps: String(firstSet?.reps ?? 10),
      weight: firstSet?.weight !== undefined && firstSet.weight > 0 ? String(firstSet.weight) : '',
      unit,
    };
  });
}

export function buildUpdatedPlanExercise(draft: PlanDraftExercise): WorkoutExercise {
  const parsedSets = parseInt(draft.setsCount, 10);
  const targetCount = Number.isNaN(parsedSets)
    ? draft.base.sets.length
    : Math.max(0, Math.min(30, parsedSets));

  const parsedReps = parseInt(draft.reps, 10);
  const targetReps =
    Number.isNaN(parsedReps) || parsedReps < 1 ? (draft.base.sets[0]?.reps ?? 10) : parsedReps;

  const trimmedWeight = draft.weight.trim();
  const parsedWeight = trimmedWeight === '' ? undefined : Number(trimmedWeight);
  const targetWeight =
    parsedWeight !== undefined && Number.isFinite(parsedWeight) && parsedWeight > 0
      ? parsedWeight
      : undefined;

  const existingSets = draft.base.sets;
  const originalFirstReps = existingSets[0]?.reps;
  const repsChanged = originalFirstReps !== targetReps;

  const nextSets: WorkoutSet[] = [];
  for (let i = 0; i < targetCount; i++) {
    const prev = existingSets[i] ?? existingSets[existingSets.length - 1];
    const nextSet: WorkoutSet = {
      id:
        existingSets[i]?.id ??
        `plan-set-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      reps: targetReps,
      ...(targetWeight !== undefined ? { weight: targetWeight } : {}),
      unit: draft.unit,
      completed: false,
      ...(!repsChanged && prev?.repMin !== undefined ? { repMin: prev.repMin } : {}),
      ...(!repsChanged && prev?.repMax !== undefined ? { repMax: prev.repMax } : {}),
      ...(prev?.time !== undefined ? { time: prev.time } : {}),
      ...(prev?.distance !== undefined ? { distance: prev.distance } : {}),
      ...(prev?.rpe !== undefined ? { rpe: prev.rpe } : {}),
      ...(prev?.rir !== undefined ? { rir: prev.rir } : {}),
    };
    nextSets.push(nextSet);
  }

  return {
    ...draft.base,
    sets: nextSets,
  };
}

export function planSnapshotExercises(
  exercises: readonly PlanDraftExercise[],
): PlanSnapshotExercise[] {
  return exercises.map((draft) => {
    const parsedSets = parseInt(draft.setsCount, 10);
    const sets = Number.isNaN(parsedSets)
      ? draft.base.sets.length
      : Math.max(0, Math.min(30, parsedSets));
    const parsedReps = parseInt(draft.reps, 10);
    const reps =
      Number.isNaN(parsedReps) || parsedReps < 1 ? (draft.base.sets[0]?.reps ?? 10) : parsedReps;
    const trimmedWeight = draft.weight.trim();
    const parsedWeight = trimmedWeight === '' ? undefined : Number(trimmedWeight);
    const weight =
      parsedWeight !== undefined && Number.isFinite(parsedWeight) && parsedWeight > 0
        ? parsedWeight
        : undefined;
    return {
      name: draft.base.exercise.name,
      sets,
      reps,
      ...(weight !== undefined ? { weight } : {}),
      unit: draft.unit,
    };
  });
}

export function planEditorScreen(
  draft: PlanDraftState,
): ScreenSnapshot & { planDraft: PlanDraftState } {
  const trimmed = draft.name.trim();
  const allExercises = planSnapshotExercises(draft.exercises);
  return {
    tab: 'plan-edit',
    title: 'Plan editor',
    summary: [
      trimmed ? `Plan "${trimmed.slice(0, 60)}"` : 'Unnamed plan',
      `for ${draft.date}`,
      allExercises.length
        ? `${allExercises.length} exercise${allExercises.length === 1 ? '' : 's'}`
        : 'empty',
    ].join(', '),
    data: {
      planId: draft.planId,
      name: draft.name,
      date: draft.date,
      exercises: allExercises.slice(0, MAX_PLAN_EXERCISES),
    },
    planDraft: draft,
  };
}

const formatPlanLine = (item: PlanDraftExercise): string => {
  const load = item.weight.trim() ? ` @${item.weight.trim()}${item.unit}` : '';
  return `${item.setsCount}x${item.reps} ${item.base.exercise.name}${load}`;
};

export function findPlanDraftExercise(
  exercises: readonly PlanDraftExercise[],
  asked: string,
  same: (a: string, b: string) => boolean = () => false,
): PlanDraftExercise | string {
  const key = normalName(asked);
  if (!key) return 'No exercise was named.';
  const exact = exercises.filter(
    (d) => normalName(d.base.exercise.name) === key || same(d.base.exercise.name, asked),
  );
  const words = key.split(' ').filter(Boolean);
  const loose = exact.length
    ? exact
    : exercises.filter((d) => {
        const own = new Set(normalName(d.base.exercise.name).split(' '));
        return words.every((w) => own.has(w));
      });
  if (loose.length === 0) return `"${asked}" is not in this planned workout.`;
  if (loose.length > 1) return `"${asked}" matches more than one exercise in this planned workout.`;
  return loose[0];
}

export function editPlanDraftExercise(
  exercises: readonly PlanDraftExercise[],
  asked: string,
  change: PlanChange,
  opts: { same?: (a: string, b: string) => boolean } = {},
): PlanDraftEdit {
  const found = findPlanDraftExercise(exercises, asked, opts.same ?? (() => false));
  if (typeof found === 'string') return fail(found);
  const nextItem: PlanDraftExercise = {
    ...found,
    setsCount: change.sets !== undefined ? String(change.sets) : found.setsCount,
    reps: change.reps !== undefined ? String(change.reps) : found.reps,
    weight:
      change.weight !== undefined
        ? change.weight > 0
          ? String(change.weight)
          : ''
        : found.weight,
    unit: change.unit ?? found.unit,
  };
  if (
    nextItem.setsCount === found.setsCount &&
    nextItem.reps === found.reps &&
    nextItem.weight === found.weight &&
    nextItem.unit === found.unit
  ) {
    return fail(`${found.base.exercise.name} is already like that.`);
  }
  const next = exercises.map((d) => (d.key === found.key ? nextItem : d));
  return { ok: true, exercises: next, name: found.base.exercise.name, line: formatPlanLine(nextItem) };
}

export function addPlanDraftExercise(
  exercises: readonly PlanDraftExercise[],
  callId: string,
  exercise: Exercise,
  change: PlanChange,
  opts: { same?: (a: string, b: string) => boolean; defaultUnit?: 'lbs' | 'kg' } = {},
): PlanDraftEdit {
  const same = opts.same ?? (() => false);
  const key = normalName(exercise.name);
  const present = exercises.some(
    (d) => normalName(d.base.exercise.name) === key || same(d.base.exercise.name, exercise.name),
  );
  if (present) {
    return fail(`${exercise.name} is already in this planned workout; change it instead.`);
  }
  const sets = change.sets ?? 3;
  const reps = change.reps ?? 10;
  const unit = change.unit ?? opts.defaultUnit ?? 'lbs';
  const weight = change.weight !== undefined && change.weight > 0 ? change.weight : undefined;
  const newId = `plan-ex-${callId}`;
  const base: WorkoutExercise = {
    id: newId,
    exercise,
    sets: Array.from({ length: sets }, (_, idx) => ({
      id: `plan-set-${callId}-${idx}`,
      reps,
      ...(weight !== undefined ? { weight } : {}),
      unit,
      completed: false,
    })),
    restTime: 120,
  };
  const added: PlanDraftExercise = {
    key: `${newId}-${exercises.length}`,
    base,
    setsCount: String(sets),
    reps: String(reps),
    weight: weight !== undefined ? String(weight) : '',
    unit,
  };
  return {
    ok: true,
    exercises: [...exercises, added],
    name: exercise.name,
    line: formatPlanLine(added),
  };
}

export function removePlanDraftExercise(
  exercises: readonly PlanDraftExercise[],
  asked: string,
  opts: { same?: (a: string, b: string) => boolean } = {},
): PlanDraftEdit {
  const found = findPlanDraftExercise(exercises, asked, opts.same ?? (() => false));
  if (typeof found === 'string') return fail(found);
  const next = exercises.filter((d) => d.key !== found.key);
  return {
    ok: true,
    exercises: next,
    name: found.base.exercise.name,
    line: formatPlanLine(found),
  };
}
