/**
 * Turns one AI tool call into Redux actions, tiered per the design:
 *   auto     — only today's workout, just described → apply now, Undo restores
 *   confirm  — saved data or future numbers → Apply/Reject card
 *   rejected — unknown ids, bad shapes, loads the engine refuses
 * Pure: reads a snapshot, returns actions; the caller dispatches.
 *
 * Units: workout sets say 'lbs' | 'kg', tracked lifts and the engine say
 * 'lb' | 'kg'. Everything here (checks, summaries) uses 'lb' | 'kg'.
 *
 * The build / plan / profile tools (createWorkout, updateWorkout, planWorkout,
 * updateProfile, addExercise, logPastWorkout, editPastWorkout) are confirm-tier
 * with Undo: their saves outside the store travel as `effects` (see effects.ts),
 * run only on Apply.
 */
import type { UnknownAction } from '@reduxjs/toolkit';
import type { ActiveWorkout, Exercise, WorkoutExercise, WorkoutSet } from '../types/exercise';
import type { SessionGoal, TrackedLift, TrackedLoad, TrackedTarget, WeightUnit } from '../types/trackedLifts';
import type { ParsedExercise, ParsedSet } from '../parser/types';
import type { UserPreferences } from '../store/slices/userSlice';
import {
  addExerciseToWorkout,
  addSet,
  removeExerciseFromWorkout,
  removeOpenSets,
  replaceExerciseMovement,
  setsPatched,
  startWorkout,
  updateExerciseNotesAndTitle,
  type SetPatch,
} from '../store/slices/workoutSlice';
import { planAdded, planRemoved, type PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';
import { buildPresetSet } from '../store/slices/aiSlice';
import type { SavedWorkout } from '../services/workoutStorageService';
import type { ActivePlanContext } from '../lib/workoutSession';
import { preparePlannedWorkoutForExecution } from '../lib/planWorkout';

import { dateKeyToDate, toDateKey } from '../lib/dateKey';
import {
  convertSavedWorkoutToExercises,
  generateFallbackExerciseId,
  sanitizeWorkoutExercisesForRedux,
} from '../utils/workoutConversion';
import { prescribedFloor } from '../lib/progression/setPrescription';
import { liftAdded, liftRemoved, liftUpdated } from '../store/slices/trackedLiftsSlice';
import { checkProposedLoad } from '../lib/aiLoadCheck';
import { formatLoad, formatTarget } from '../lib/trackedLifts';
import { fromFlatLift, type FlatLift } from './liftFields';
import { swapAlternatives, usesCommonEquipment } from './alternatives';
import type {
  AiEffect,
  PastWorkoutDraft,
  PastWorkoutExercise,
  PastWorkoutSet,
  PastWorkoutUpdate,
  SavedWorkoutDraft,
} from './effects';
import { workoutText } from './workoutText';
import type { AiAppTab, AiAssistantTurn, AiToolCall } from './types';

/** Tool call shape consumed by the planner (mirrors AiToolCall with open tool names). */
export type ToolCallForPlan = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/** A saved workout the lifter has, as updateWorkout sees it. */
export interface SavedWorkoutRef extends SavedWorkoutDraft {
  id: string;
}

export interface PlanContext {
  activeWorkout: ActiveWorkout | null;
  trackedLifts: TrackedLift[];
  library: Exercise[];
  /** The lifter's weight unit, for workouts the AI writes without one. */
  units?: 'lbs' | 'kg';
  /** Today, YYYY-MM-DD local: planWorkout refuses earlier days. */
  todayKey?: string;
  /** Saved workouts (updateWorkout resolves its id here). */
  savedWorkouts?: readonly SavedWorkoutRef[];
  /** Current display name and preferences (updateProfile skips no-ops). */
  displayName?: string;
  preferences?: UserPreferences;
  /** The current route (openTab skips the tab the lifter is already on). */
  pathname?: string;
  /** The lifter's planned workouts (startWorkout planId / today). */
  plannedWorkouts?: readonly PlannedWorkout[];
  /** The session goal tracked lifts are prescribed for when a start names none. */
  defaultGoal?: SessionGoal;
  /** Whether the Build screen holds unsaved content (loadIntoBuild replaces it). */
  buildHasDraft?: boolean;
}

/** What the host does once a confirm plan is applied (outside the store). */
export interface AfterApply {
  /** Route to open. */
  navigate?: string;
  /** Close the chat so the lifter sees that screen. */
  closeChat?: boolean;
  /** The planned workout a start belongs to (completion marks it done). */
  planContext?: ActivePlanContext;
  /** The saved workout a start came from (its "performed" count goes up). */
  markPerformed?: string;
}

export type ToolPlan =
  | {
      kind: 'auto'; id: string; summary: string; apply: UnknownAction[]; undo: UnknownAction[];
      /** Route to open (openTab); no Undo when `undo` is empty. */
      navigate?: string;
    }
  | {
      kind: 'confirm'; id: string; summary: string; detail?: string; apply: UnknownAction[];
      /** The "benchmark stays" sentence inside `detail`, for the lift an ongoing swap renames. */
      benchmarkNote?: { liftId: string; text: string };
      /** Actions that take `apply` back (the build / plan / profile tools). */
      undo?: UnknownAction[];
      /** Saves outside the store, run after `apply` (see effects.ts). */
      effects?: AiEffect[];
      /** Navigation and session bookkeeping once applied (startWorkout, loadIntoBuild). */
      afterApply?: AfterApply;
    }
  | { kind: 'rejected'; id: string; reason: string };

const unitOf = (set?: WorkoutSet): WeightUnit => (set?.unit === 'kg' ? 'kg' : 'lb');
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** A non-negative integer index, else undefined. */
const index = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n >= 0 ? n : undefined;
};

function findExercise(ctx: PlanContext, id: unknown): WorkoutExercise | undefined {
  return ctx.activeWorkout?.exercises.find((e) => e.id === id);
}

/** The load the lifter is working with: next undone set, else the last set. */
function referenceLoad(ex: WorkoutExercise): number | null {
  const next = ex.sets.find((s) => !s.completed) ?? ex.sets[ex.sets.length - 1];
  return next?.weight ?? null;
}

/** The unit a lift's numbers are in, when it has any. */
function liftUnit(lift: TrackedLift): WeightUnit | undefined {
  if (lift.load.kind === 'weight') return lift.load.unit;
  if (lift.load.kind === 'bodyweight') return lift.load.plus?.unit;
  return undefined;
}

/** The tracked lift's equipment step, unless it is in the other unit. */
function stepFor(ctx: PlanContext, ex: WorkoutExercise, unit: WeightUnit): number | undefined {
  const lift = ex.tracked ? ctx.trackedLifts.find((l) => l.id === ex.tracked!.liftId) : undefined;
  if (!lift) return undefined;
  const own = liftUnit(lift);
  return own === undefined || own === unit ? lift.step : undefined;
}

/** Lower-case words with punctuation dropped: "Pull-Up " → "pull up". */
const normalName = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The library exercise a model-given name means: an exact match (ignoring
 * case, spacing and punctuation), else the best name that contains every word
 * of it (words of 2+ letters, and at least two of them), else none. The model often drops the equipment
 * prefix the library uses ("Romanian Deadlift" → "Barbell Romanian
 * Deadlift"). Word matches rank: in `replaced`'s own swap alternatives (what
 * the context offered), then the same equipment as `replaced`, then common
 * equipment, then the shortest name, then name order.
 */
function libraryMatch(ctx: PlanContext, name: string, replaced?: Exercise): Exercise | undefined {
  const key = normalName(name);
  if (!key) return undefined;
  const exact = ctx.library.find((e) => normalName(e.name) === key);
  if (exact) return exact;
  const words = key.split(' ').filter((w) => w.length >= 2);
  if (words.length < 2) return undefined;
  const candidates = ctx.library.filter((e) => {
    const own = new Set(normalName(e.name).split(' '));
    return words.every((w) => own.has(w));
  });
  if (candidates.length === 0) return undefined;

  const offered = new Set(replaced ? swapAlternatives(replaced, ctx.library) : []);
  const kit = (e: Exercise) => (e.equipment ?? '').trim().toLowerCase();
  const replacedKit = replaced ? kit(replaced) : '';
  const rank = (e: Exercise): number[] => [
    offered.has(e.name) ? 0 : 1,
    replacedKit && kit(e) === replacedKit ? 0 : 1,
    usesCommonEquipment(e) ? 0 : 1,
    e.name.length,
  ];
  const better = (a: Exercise, b: Exercise): boolean => {
    const ra = rank(a);
    const rb = rank(b);
    for (let k = 0; k < ra.length; k++) if (ra[k] !== rb[k]) return ra[k] < rb[k];
    return a.name < b.name;
  };
  return candidates.reduce((best, e) => (better(e, best) ? e : best));
}

/**
 * Whether two plans of the same call would do the same thing, so a late Apply
 * may go ahead. Ignores what legitimately differs between planning and Apply:
 * the id `liftAdded` generates each time, the timestamps `planAdded` stamps,
 * and set patches (they target whichever sets are still open, each guarded by
 * `onlyIf`).
 */
export function sameIntent(a: readonly UnknownAction[], b: readonly UnknownAction[]): boolean {
  const normal = (actions: readonly UnknownAction[]) =>
    JSON.stringify(
      actions
        .filter((x) => x.type !== setsPatched.type)
        .map((x) => {
          if (x.type === planAdded.type) {
            const payload = { ...(x.payload as Record<string, unknown>) };
            delete payload.createdAt;
            delete payload.updatedAt;
            return { ...x, payload };
          }
          if (x.type !== liftAdded.type) return x;
          const payload = { ...(x.payload as Record<string, unknown>) };
          delete payload.id;
          return { ...x, payload };
        }),
    );
  return normal(a) === normal(b);
}

/** Whether two plans would make the same saves outside the store. */
export function sameEffects(a: readonly AiEffect[] | undefined, b: readonly AiEffect[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

/**
 * A guarded edit of one set and its undo. Apply runs only while the set matches
 * `applyIf`; undo restores the prior value of each changed field, and only while
 * the set still holds exactly what we applied (plus `undoIf`). So neither ever
 * clobbers a set the lifter touched in between.
 */
function patchPair(
  set: WorkoutSet,
  changes: Partial<WorkoutSet>,
  applyIf: Partial<WorkoutSet>,
  undoIf: Partial<WorkoutSet> = {},
): { apply: SetPatch; undo: SetPatch } {
  const prior: Record<string, unknown> = {};
  for (const key of Object.keys(changes)) prior[key] = (set as unknown as Record<string, unknown>)[key];
  return {
    apply: { setId: set.id, changes, onlyIf: applyIf },
    undo: { setId: set.id, changes: prior as Partial<WorkoutSet>, onlyIf: { ...changes, ...undoIf } },
  };
}

const describeLift = (parsed: { load: TrackedLoad; target: TrackedTarget }): string =>
  [formatLoad(parsed.load), formatTarget(parsed.target)].filter(Boolean).join(', ');

// ---------------------------------------------------------------------------
// Build / plan / profile helpers
// ---------------------------------------------------------------------------

type WorkoutUnit = 'lbs' | 'kg';
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Trimmed non-empty strings of an array; [] when it is not one. */
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((x): x is string => x !== undefined) : [];

/**
 * The model's straight-set exercises as parser exercises, each name resolved
 * to the library when it matches, loads snapped to a loadable step. A reason
 * string when any exercise is malformed.
 */
function readExercises(raw: unknown, ctx: PlanContext): ParsedExercise[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'A workout needs at least one exercise.';
  if (raw.length > 20) return 'A workout can have at most 20 exercises.';
  const out: ParsedExercise[] = [];
  for (const item of raw) {
    const e = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const name = str(e.name);
    if (!name) return 'An exercise has no name.';
    const sets = index(e.sets);
    if (!sets || sets > 10) return `${name}: sets must be 1–10.`;
    const reps = index(e.reps);
    if (!reps || reps > 100) return `${name}: reps must be 1–100.`;
    let repsMax: number | undefined;
    if (e.repsMax !== undefined) {
      repsMax = index(e.repsMax);
      if (!repsMax || repsMax < reps || repsMax > 100) return `${name}: that rep range is not valid.`;
    }
    const unit: WorkoutUnit = e.unit === 'kg' || e.unit === 'lbs' ? e.unit : ctx.units ?? 'lbs';
    let weight: number | undefined;
    if (e.weight !== undefined) {
      // A new workout has no reference load: only > 0 and loadable.
      const check = checkProposedLoad(num(e.weight) ?? 0, null, unit === 'kg' ? 'kg' : 'lb');
      if (!check.ok) return `${name}: ${check.reason}`;
      weight = check.value;
    }
    let rest: number | undefined;
    if (e.restSeconds !== undefined) {
      rest = index(e.restSeconds);
      if (!rest || rest < 15 || rest > 600) return `${name}: rest must be 15–600 seconds.`;
    }
    const notes = str(e.notes);
    const set = (): ParsedSet => ({
      reps: repsMax && repsMax > reps ? { min: reps, max: repsMax } : reps,
      ...(weight !== undefined ? { weight, unit } : {}),
    });
    out.push({
      name: libraryMatch(ctx, name)?.name ?? name,
      sets: Array.from({ length: sets }, set),
      ...(rest ? { restTime: rest } : {}),
      ...(notes ? { notes } : {}),
    });
  }
  return out;
}

/** "Barbell Bench Press 3×8-12 @ 135 lb" for a card. */
function describeExercise(e: ParsedExercise): string {
  const first = e.sets[0];
  if (!first) return e.name;
  const reps = typeof first.reps === 'number' ? `${first.reps}` : `${first.reps.min}-${first.reps.max}`;
  const load = first.weight ? ` @ ${first.weight} ${first.unit === 'kg' ? 'kg' : 'lb'}` : '';
  return `${e.name} ${e.sets.length}×${reps}${load}`;
}

const describeExercises = (list: readonly ParsedExercise[]): string => list.map(describeExercise).join(', ');

/** A library-shaped exercise for a name the library lacks (stable across plans). */
function fallbackExercise(name: string): Exercise {
  return {
    id: generateFallbackExerciseId(name),
    name,
    muscleGroup: 'Unknown',
    muscleGroups: ['Unknown'],
    equipment: 'Unknown',
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: [name.toLowerCase()],
    createdAt: '',
    updatedAt: '',
  };
}

/** A library exercise with only serializable, stable fields (for the store). */
function plainExercise(e: Exercise): Exercise {
  return {
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup ?? (e.muscleGroups ?? []).join(', '),
    muscleGroups: e.muscleGroups ?? [],
    equipment: e.equipment ?? '',
    videoLinks: e.videoLinks ?? [],
    instructions: e.instructions ?? [],
    difficulty: e.difficulty ?? 'Intermediate',
    force: e.force ?? null,
    grips: e.grips ?? null,
    mechanic: e.mechanic ?? null,
    searchKeywords: e.searchKeywords ?? [],
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : '',
    updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : '',
  };
}

/** Player exercises for a plan; ids derive from the call so a re-plan matches. */
function toWorkoutExercises(callId: string, list: readonly ParsedExercise[], ctx: PlanContext): WorkoutExercise[] {
  return list.map((e, i) => {
    const lib = ctx.library.find((x) => x.name === e.name);
    return {
      id: `exercise-${callId}-${i}`,
      exercise: lib ? plainExercise(lib) : fallbackExercise(e.name),
      sets: e.sets.map((s, k): WorkoutSet => ({
        id: `set-${callId}-${i}-${k}`,
        reps: typeof s.reps === 'number' ? s.reps : s.reps.min,
        ...(typeof s.reps === 'object' ? { repMin: s.reps.min, repMax: s.reps.max } : {}),
        weight: s.weight ?? 0,
        unit: s.unit ?? ctx.units ?? 'lbs',
        completed: false,
      })),
      restTime: e.restTime ?? 120,
      ...(e.notes ? { notes: e.notes } : {}),
    };
  });
}

/** A real YYYY-MM-DD day (not 2026-02-30). */
const isDateKey = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toDateKey(dateKeyToDate(v)) === v;

const PROGRESSION_RATES = ['beginner', 'intermediate', 'advanced'] as const;

export function planToolCall(call: ToolCallForPlan | AiToolCall, ctx: PlanContext): ToolPlan {
  const { id, input } = call;
  const i = input as Record<string, unknown>;
  const reject = (reason: string): ToolPlan => ({ kind: 'rejected', id, reason });

  switch (call.name) {
    case 'adjustSet': {
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');
      const from = index(i.fromSetIndex);
      if (from === undefined) return reject('That set is not valid.');
      if (i.weight === undefined && i.reps === undefined) return reject('Nothing to change.');
      if (!ex.sets.some((s, k) => k >= from && !s.completed)) return reject('No open sets to change.');

      const unit = unitOf(ex.sets[0]);
      let weight: number | undefined;
      if (i.weight !== undefined) {
        const check = checkProposedLoad(num(i.weight) ?? 0, referenceLoad(ex), unit, stepFor(ctx, ex, unit));
        if (!check.ok) return reject(check.reason);
        weight = check.value;
      }
      let reps: number | undefined;
      if (i.reps !== undefined) {
        reps = index(i.reps);
        if (!reps) return reject('Reps must be a whole number above zero.');
      }

      const changes: Partial<WorkoutSet> = {
        ...(weight !== undefined ? { weight } : {}),
        ...(reps !== undefined ? { reps, repMin: undefined, repMax: undefined } : {}),
      };
      // Undo skips a set the lifter has logged since, even at the adjusted numbers.
      const pairs = ex.sets
        .filter((s, k) => k >= from && !s.completed)
        .map((s) => patchPair(s, changes, { completed: false }, { completed: false }));
      const what = [weight !== undefined && `${weight} ${unit}`, reps !== undefined && `${reps} reps`]
        .filter(Boolean)
        .join(' × ');
      return {
        kind: 'auto', id,
        summary: `${ex.customTitle || ex.exercise.name}: remaining sets at ${what}`,
        apply: [setsPatched({ exerciseId: ex.id, patches: pairs.map((p) => p.apply) })],
        undo: [setsPatched({ exerciseId: ex.id, patches: pairs.map((p) => p.undo) })],
      };
    }

    case 'logSet': {
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');
      const reps = index(i.reps);
      if (reps === undefined) return reject('Reps must be a whole number.');
      const idx = i.setIndex !== undefined ? index(i.setIndex) ?? -1 : ex.sets.findIndex((s) => !s.completed);
      if (idx < 0 || idx >= ex.sets.length) return reject('No open set to log.');
      const weight = num(i.weight);
      if (weight !== undefined && weight < 0) return reject('Load cannot be negative.');
      let rir: number | undefined;
      if (i.rir !== undefined) {
        rir = index(i.rir);
        if (rir === undefined || rir > 5) return reject('Reps in reserve must be 0–5.');
      }
      const set = ex.sets[idx];
      const unit = unitOf(set);
      const changes: Partial<WorkoutSet> = {
        reps,
        ...(weight !== undefined ? { weight } : {}),
        ...(rir !== undefined ? { rir } : {}),
        completed: true,
        // Same rule as completeSet: judged against the prescription being replaced.
        failed: reps < prescribedFloor(set),
      };
      const pair = patchPair(set, changes, { completed: set.completed, reps: set.reps, weight: set.weight });
      return {
        kind: 'auto', id,
        summary: `${set.completed ? 'Corrected' : 'Logged'} set ${idx + 1}: ${reps} reps${weight !== undefined ? ` at ${weight} ${unit}` : ''}`,
        apply: [setsPatched({ exerciseId: ex.id, patches: [pair.apply] })],
        undo: [setsPatched({ exerciseId: ex.id, patches: [pair.undo] })],
      };
    }

    case 'addSets': {
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');
      const count = index(i.count) ?? index(i.sets) ?? 1;
      if (count < 1 || count > 10) return reject('Sets must be 1–10.');

      const lastSet = ex.sets[ex.sets.length - 1];
      const unit = unitOf(lastSet);

      let reps: number;
      if (i.reps !== undefined) {
        const parsedReps = index(i.reps);
        if (!parsedReps || parsedReps > 100) return reject('Reps must be a whole number above zero.');
        reps = parsedReps;
      } else {
        reps = lastSet?.reps ?? 10;
      }

      let weight: number;
      if (i.weight !== undefined) {
        const check = checkProposedLoad(num(i.weight) ?? 0, referenceLoad(ex), unit, stepFor(ctx, ex, unit));
        if (!check.ok) return reject(check.reason);
        weight = check.value;
      } else {
        weight = lastSet?.weight ?? 0;
      }

      const newSets: WorkoutSet[] = Array.from({ length: count }, (_, k) => ({
        id: `set-${id}-${k}`,
        reps,
        weight,
        unit: lastSet?.unit ?? (unit === 'kg' ? 'kg' : 'lbs'),
        completed: false,
      }));

      const apply = newSets.map((s) => addSet({ exerciseId: ex.id, setData: s }));
      const undo = [removeOpenSets({ exerciseId: ex.id, setIds: newSets.map((s) => s.id) })];

      return {
        kind: 'auto',
        id,
        summary: `${ex.customTitle || ex.exercise.name}: added ${count} set${count === 1 ? '' : 's'}${weight > 0 ? ` at ${weight} ${unit}` : ''}`,
        apply,
        undo,
      };
    }

    case 'removeOpenSets': {
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');
      const count = index(i.count) ?? index(i.sets) ?? 1;
      if (count < 1) return reject('Count must be at least 1.');

      if (ex.sets.length <= 1) return reject('An exercise must keep at least one set.');

      let openCount = 0;
      while (
        openCount < ex.sets.length &&
        !ex.sets[ex.sets.length - 1 - openCount].completed
      ) {
        openCount++;
      }

      if (openCount === 0) return reject('No open sets to remove.');

      const maxRemovable = Math.min(openCount, ex.sets.length - 1);
      if (count > openCount) return reject('Cannot remove completed sets.');
      if (count > maxRemovable) return reject('An exercise must keep at least one set.');

      const droppedSets = ex.sets.slice(ex.sets.length - count);
      const apply = [removeOpenSets({ exerciseId: ex.id, count })];
      const undo = droppedSets.map((s) => addSet({ exerciseId: ex.id, setData: s }));

      return {
        kind: 'auto',
        id,
        summary: `${ex.customTitle || ex.exercise.name}: removed ${droppedSets.length} open set${droppedSets.length === 1 ? '' : 's'}`,
        apply,
        undo,
      };
    }

    case 'addExerciseToWorkout': {
      if (!ctx.activeWorkout) return reject('No active workout.');
      const name = str(i.exerciseName);
      if (!name) return reject('No exercise was named.');
      const matched = libraryMatch(ctx, name);
      if (!matched) return reject(`"${name}" is not in the exercise library.`);

      const setsCount = index(i.sets) ?? 3;
      if (setsCount < 1 || setsCount > 10) return reject('Sets must be 1–10.');

      const reps = index(i.reps) ?? 10;
      if (reps < 1 || reps > 100) return reject('Reps must be 1–100.');

      const unit: WorkoutUnit = ctx.units ?? 'lbs';
      let weight: number | undefined;
      if (i.weight !== undefined) {
        const check = checkProposedLoad(num(i.weight) ?? 0, null, unit === 'kg' ? 'kg' : 'lb');
        if (!check.ok) return reject(check.reason);
        weight = check.value;
      }

      let afterExerciseId: string | undefined;
      if (i.afterExerciseId !== undefined) {
        afterExerciseId = str(i.afterExerciseId);
        if (!afterExerciseId || !findExercise(ctx, afterExerciseId)) {
          return reject('The reference exercise is not in this workout.');
        }
      }

      const exerciseId = `exercise-${id}`;
      const newSets: WorkoutSet[] = Array.from({ length: setsCount }, (_, k) => ({
        id: `set-${id}-${k}`,
        reps,
        weight: weight ?? 0,
        unit,
        completed: false,
      }));

      const newExercise: WorkoutExercise = {
        id: exerciseId,
        exercise: plainExercise(matched),
        sets: newSets,
        restTime: 120,
      };

      const loadDesc = weight !== undefined && weight > 0 ? ` @ ${weight} ${unit === 'kg' ? 'kg' : 'lb'}` : '';
      return {
        kind: 'confirm',
        id,
        summary: `Add ${matched.name} (${setsCount}×${reps}${loadDesc}) to workout`,
        detail: str(i.reason),
        apply: [addExerciseToWorkout({ exercise: newExercise, afterExerciseId })],
      };
    }

    case 'removeExerciseFromWorkout': {
      if (!ctx.activeWorkout) return reject('No active workout.');
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');

      if (ex.sets.some((s) => s.completed)) {
        return reject('Cannot remove an exercise with completed sets.');
      }
      if (ctx.activeWorkout.exercises.length <= 1) {
        return reject('A workout must have at least one exercise.');
      }

      return {
        kind: 'confirm',
        id,
        summary: `Remove ${ex.customTitle || ex.exercise.name} from workout`,
        detail: str(i.reason),
        apply: [removeExerciseFromWorkout({ exerciseId: ex.id })],
      };
    }

    case 'setExerciseNote': {
      if (!ctx.activeWorkout) return reject('No active workout.');
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');

      const note = str(i.note);
      if (!note) return reject('No note was provided.');

      return {
        kind: 'auto',
        id,
        summary: `${ex.customTitle || ex.exercise.name}: "${note}"`,
        apply: [updateExerciseNotesAndTitle({ exerciseId: ex.id, notes: note })],
        undo: [updateExerciseNotesAndTitle({ exerciseId: ex.id, notes: ex.notes ?? '' })],
      };
    }

    case 'swapExercise': {
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');
      const name = str(i.replacementExerciseName);
      if (!name) return reject('No replacement exercise was named.');
      const replacement = libraryMatch(ctx, name, ex.exercise);
      if (!replacement) return reject(`"${name}" is not in the exercise library.`);
      const apply: UnknownAction[] = [replaceExerciseMovement({ exerciseId: ex.id, exercise: replacement })];
      const unit = unitOf(ex.sets[0]);
      let weight: number | undefined;
      if (i.weight !== undefined) {
        // A different movement: no reference to compare with, but still > 0 and loadable.
        const check = checkProposedLoad(num(i.weight) ?? 0, null, unit);
        if (!check.ok) return reject(check.reason);
        weight = check.value;
        // Only sets still open when Apply is tapped: a late Apply never un-logs one.
        const patches: SetPatch[] = ex.sets
          .filter((s) => !s.completed)
          .map((s) => ({ setId: s.id, changes: { weight }, onlyIf: { completed: false } }));
        apply.push(setsPatched({ exerciseId: ex.id, patches }));
      }
      // 'ongoing' only means something for a tracked lift; otherwise it is today's swap.
      const lift = i.scope === 'ongoing' && ex.tracked
        ? ctx.trackedLifts.find((l) => l.id === ex.tracked!.liftId)
        : undefined;
      if (lift) apply.push(liftUpdated({ id: lift.id, name: replacement.name }));
      const benchmarkNote = lift
        ? `Benchmark stays ${describeLift(lift)} — update it after your first session.`
        : undefined;
      return {
        kind: 'confirm', id,
        summary: `Swap ${ex.customTitle || ex.exercise.name} for ${replacement.name}${weight !== undefined ? ` at ${weight} ${unit}` : ''}${lift ? ' from now on' : ' today'}`,
        detail: [str(i.reason), benchmarkNote].filter(Boolean).join(' ') || undefined,
        apply,
        ...(lift && benchmarkNote ? { benchmarkNote: { liftId: lift.id, text: benchmarkNote } } : {}),
      };
    }

    case 'updateBenchmark': {
      const lift = ctx.trackedLifts.find((l) => l.id === i.liftId);
      if (!lift) return reject('That tracked lift does not exist.');
      // An omitted unit means the lift's own, not a silent switch to lb.
      const parsed = fromFlatLift({ ...i, unit: i.unit ?? liftUnit(lift) } as unknown as FlatLift);
      if (!parsed) return reject('That benchmark is missing a load or target.');
      return {
        kind: 'confirm', id,
        summary: `${lift.name} benchmark → ${describeLift(parsed)}`,
        detail: str(i.reason),
        apply: [liftUpdated({ id: lift.id, ...parsed })],
      };
    }

    case 'addTrackedLift': {
      const name = str(i.name);
      const category = str(i.category);
      const parsed = fromFlatLift(i as unknown as FlatLift);
      if (!name || !category || !parsed) return reject('That lift is missing a name, category or benchmark.');
      if (ctx.trackedLifts.some((l) => l.name.trim().toLowerCase() === name.toLowerCase())) {
        return reject(`${name} is already tracked.`);
      }
      let sets: number | undefined;
      if (i.sets !== undefined) {
        sets = index(i.sets);
        if (sets === undefined || sets < 1 || sets > 10) return reject('Sets must be 1–10.');
      }
      return {
        kind: 'confirm', id,
        summary: `Track ${name} (${category}): ${describeLift(parsed)}`,
        apply: [
          liftAdded({ name, category, ...parsed, ...(sets ? { sets } : {}), progression: i.progression === true }),
        ],
      };
    }

    case 'removeTrackedLift': {
      const lift = ctx.trackedLifts.find((l) => l.id === i.liftId);
      if (!lift) return reject('That tracked lift does not exist.');
      return { kind: 'confirm', id, summary: `Stop tracking ${lift.name}`, detail: str(i.reason), apply: [liftRemoved(lift.id)] };
    }

    case 'createWorkout': {
      const raw = Array.isArray(i.workouts) ? i.workouts : [];
      if (raw.length === 0) return reject('No workout to save.');
      if (raw.length > 7) return reject('At most 7 workouts at once.');
      const workouts: SavedWorkoutDraft[] = [];
      for (const item of raw) {
        const w = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const name = str(w.name);
        if (!name) return reject('A workout has no name.');
        const exercises = readExercises(w.exercises, ctx);
        if (typeof exercises === 'string') return reject(exercises);
        const parsedWorkout = { exercises, supersets: [] };
        workouts.push({ name, workoutText: workoutText(parsedWorkout), parsedWorkout });
      }
      const list = workouts.length === 1
        ? describeExercises(workouts[0].parsedWorkout.exercises)
        : workouts.map((w) => `${w.name}: ${describeExercises(w.parsedWorkout.exercises)}`).join('; ');
      return {
        kind: 'confirm', id,
        summary: workouts.length === 1
          ? `Save workout "${workouts[0].name}" (${plural(workouts[0].parsedWorkout.exercises.length, 'exercise')})`
          : `Save ${workouts.length} workouts: ${workouts.map((w) => w.name).join(', ')}`,
        detail: [str(i.reason), list].filter(Boolean).join(' — '),
        apply: [],
        effects: workouts.map((workout): AiEffect => ({ type: 'createSavedWorkout', workout })),
      };
    }

    case 'updateWorkout': {
      const saved = ctx.savedWorkouts?.find((w) => w.id === i.workoutId);
      if (!saved) return reject('That saved workout does not exist.');
      const name = i.name !== undefined ? str(i.name) : undefined;
      if (i.name !== undefined && !name) return reject('That name is not valid.');
      let exercises: ParsedExercise[] | undefined;
      if (i.exercises !== undefined) {
        const read = readExercises(i.exercises, ctx);
        if (typeof read === 'string') return reject(read);
        exercises = read;
      }
      if (!exercises && (!name || name === saved.name)) return reject('Nothing to change.');
      // Exercises replace the straight sets; supersets stay as they were.
      const parsedWorkout = exercises
        ? { exercises, supersets: saved.parsedWorkout.supersets ?? [] }
        : saved.parsedWorkout;
      const next: SavedWorkoutDraft = {
        name: name ?? saved.name,
        workoutText: exercises ? workoutText(parsedWorkout) : saved.workoutText,
        parsedWorkout,
      };
      const prior: SavedWorkoutDraft = { name: saved.name, workoutText: saved.workoutText, parsedWorkout: saved.parsedWorkout };
      const what = [
        name && name !== saved.name ? `rename to "${name}"` : '',
        exercises ? plural(exercises.length, 'exercise') : '',
      ].filter(Boolean).join(', ');
      return {
        kind: 'confirm', id,
        summary: `Update "${saved.name}": ${what}`,
        detail: [str(i.reason), exercises ? describeExercises(exercises) : ''].filter(Boolean).join(' — ') || undefined,
        apply: [],
        effects: [{ type: 'updateSavedWorkout', id: saved.id, workout: next, prior }],
      };
    }

    case 'planWorkout': {
      if (!isDateKey(i.dateKey)) return reject('That date is not valid.');
      if (ctx.todayKey && i.dateKey < ctx.todayKey) return reject('That date has passed.');
      const name = str(i.name);
      if (!name) return reject('The workout has no name.');
      const exercises = readExercises(i.exercises, ctx);
      if (typeof exercises === 'string') return reject(exercises);
      const planId = `ai-${id}`;
      const day = dateKeyToDate(i.dateKey).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return {
        kind: 'confirm', id,
        summary: `Plan "${name}" for ${day}`,
        detail: [str(i.reason), describeExercises(exercises)].filter(Boolean).join(' — '),
        apply: [planAdded({ id: planId, name, dateKey: i.dateKey, exercises: toWorkoutExercises(id, exercises, ctx) })],
        undo: [planRemoved(planId)],
      };
    }

    case 'updateProfile': {
      const prefs = ctx.preferences;
      const changes: Partial<UserPreferences> = {};
      const labels: string[] = [];
      let displayName: string | undefined;
      if (i.displayName !== undefined) {
        const name = str(i.displayName);
        if (!name || name.length > 60) return reject('That name is not valid.');
        if (name !== ctx.displayName) {
          displayName = name;
          labels.push(`name → ${name}`);
        }
      }
      if (i.weightUnit !== undefined) {
        if (i.weightUnit !== 'lbs' && i.weightUnit !== 'kg') return reject('Weight unit must be lbs or kg.');
        if (i.weightUnit !== prefs?.weightUnit) {
          changes.weightUnit = i.weightUnit;
          labels.push(`weight unit → ${i.weightUnit}`);
        }
      }
      if (i.unitSystem !== undefined) {
        if (i.unitSystem !== 'imperial' && i.unitSystem !== 'metric') return reject('Units must be imperial or metric.');
        if (i.unitSystem !== prefs?.unitSystem) {
          changes.unitSystem = i.unitSystem;
          labels.push(`units → ${i.unitSystem}`);
        }
      }
      if (i.defaultRestTime !== undefined) {
        const rest = index(i.defaultRestTime);
        if (!rest || rest < 15 || rest > 600) return reject('Default rest must be 15–600 seconds.');
        if (rest !== prefs?.defaultRestTime) {
          changes.defaultRestTime = rest;
          labels.push(`default rest → ${rest} s`);
        }
      }
      if (i.defaultProgressionRate !== undefined) {
        const rate = PROGRESSION_RATES.find((r) => r === i.defaultProgressionRate);
        if (!rate) return reject('Progression must be beginner, intermediate or advanced.');
        if (rate !== prefs?.defaultProgressionRate) {
          changes.defaultProgressionRate = rate;
          labels.push(`progression → ${rate}`);
        }
      }
      if (i.autoStartTimer !== undefined) {
        if (typeof i.autoStartTimer !== 'boolean') return reject('Rest timer auto-start must be on or off.');
        if (i.autoStartTimer !== prefs?.autoStartTimer) {
          changes.autoStartTimer = i.autoStartTimer;
          labels.push(`rest timer auto-start → ${i.autoStartTimer ? 'on' : 'off'}`);
        }
      }
      if (labels.length === 0) return reject('Nothing to change.');
      return {
        kind: 'confirm', id,
        summary: `Profile: ${labels.join(', ')}`,
        detail: str(i.reason),
        apply: [],
        effects: [{
          type: 'updateProfile',
          changes: {
            ...(displayName !== undefined ? { displayName } : {}),
            ...(Object.keys(changes).length ? { preferences: changes } : {}),
          },
        }],
      };
    }

    case 'addExercise': {
      const name = str(i.name);
      const muscles = strings(i.muscleGroups);
      const equipment = str(i.equipment);
      const cues = strings(i.setupCues);
      if (!name || muscles.length === 0 || !equipment || cues.length === 0) {
        return reject('That exercise is missing a name, muscles, equipment or setup cues.');
      }
      const defaults = (i.defaultSets && typeof i.defaultSets === 'object' ? i.defaultSets : {}) as Record<string, unknown>;
      const sets = index(defaults.sets);
      const reps = index(defaults.reps);
      if (!sets || sets > 10 || !reps || reps > 50) return reject('Default sets must be 1–10 sets of 1–50 reps.');
      const key = normalName(name);
      if (ctx.library.some((e) => normalName(e.name) === key)) return reject(`${name} is already in your exercises.`);
      return {
        kind: 'confirm', id,
        summary: `Add ${name} to your exercises`,
        detail: `${muscles.join(', ')} · ${equipment} · ${sets}×${reps}. ${cues.join(' ')}`,
        apply: [],
        effects: [{
          type: 'addCustomExercise',
          exercise: {
            originalName: name,
            name,
            muscleGroup: muscles.join(', '),
            equipment,
            difficulty: 'Intermediate',
            instructions: cues,
            notes: `Default: ${sets}×${reps}`,
          },
        }],
      };
    }

    case 'logPastWorkout': {
      const date = str(i.date);
      if (!date || !isDateKey(date)) return reject('That date is not valid.');
      const name = str(i.name) || 'Workout';
      const rawExercises = Array.isArray(i.exercises) ? i.exercises : [];
      if (rawExercises.length === 0) return reject('No exercises to log.');
      if (rawExercises.length > 20) return reject('At most 20 exercises at once.');

      const exercises: PastWorkoutExercise[] = [];
      for (const item of rawExercises) {
        const ex = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const exName = str(ex.name);
        if (!exName) return reject('An exercise has no name.');
        const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
        if (rawSets.length === 0) return reject(`Exercise "${exName}" has no sets.`);
        if (rawSets.length > 20) return reject(`Exercise "${exName}" has too many sets.`);

        const sets: PastWorkoutSet[] = [];
        for (const setItem of rawSets) {
          const s = (setItem && typeof setItem === 'object' ? setItem : {}) as Record<string, unknown>;
          const reps = index(s.reps);
          if (!reps || reps <= 0) return reject(`Exercise "${exName}" has an invalid rep count.`);
          const weight = num(s.weight);
          const unit = s.unit === 'kg' ? 'kg' : 'lbs';
          const rpe = num(s.rpe);
          sets.push({
            reps,
            ...(weight !== undefined ? { weight } : {}),
            unit,
            ...(rpe !== undefined ? { rpe } : {}),
          });
        }
        exercises.push({
          name: exName,
          sets,
          ...(str(ex.notes) ? { notes: str(ex.notes) } : {}),
        });
      }

      const durationMinutes = index(i.durationMinutes);
      const draft: PastWorkoutDraft = {
        date,
        name,
        exercises,
        ...(durationMinutes ? { durationMinutes } : {}),
      };

      const dayStr = dateKeyToDate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const exSummaries = exercises.map((e) => {
        const setDetails = e.sets.map((s) => `${s.reps}${s.weight ? `@${s.weight}${s.unit ?? 'lbs'}` : ''}`).join(', ');
        return `${e.name} (${setDetails})`;
      });

      return {
        kind: 'confirm', id,
        summary: `Log past workout "${name}" on ${dayStr} (${plural(exercises.length, 'exercise')})`,
        detail: exSummaries.join('; '),
        apply: [],
        effects: [{ type: 'logPastWorkout', workout: draft }],
      };
    }

    case 'editPastWorkout': {
      const workoutId = str(i.workoutId);
      if (!workoutId) return reject('Missing workout id to edit.');
      const name = str(i.name);
      const date = i.date !== undefined ? str(i.date) : undefined;
      if (i.date !== undefined && (!date || !isDateKey(date))) return reject('That date is not valid.');
      const durationMinutes = i.durationMinutes !== undefined ? index(i.durationMinutes) : undefined;

      let exercises: PastWorkoutExercise[] | undefined;
      if (i.exercises !== undefined) {
        const rawExercises = Array.isArray(i.exercises) ? i.exercises : [];
        exercises = [];
        for (const item of rawExercises) {
          const ex = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          const exName = str(ex.name);
          if (!exName) return reject('An exercise has no name.');
          const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
          if (rawSets.length === 0) return reject(`Exercise "${exName}" has no sets.`);

          const sets: PastWorkoutSet[] = [];
          for (const setItem of rawSets) {
            const s = (setItem && typeof setItem === 'object' ? setItem : {}) as Record<string, unknown>;
            const reps = index(s.reps);
            if (!reps || reps <= 0) return reject(`Exercise "${exName}" has an invalid rep count.`);
            const weight = num(s.weight);
            const unit = s.unit === 'kg' ? 'kg' : 'lbs';
            const rpe = num(s.rpe);
            sets.push({
              reps,
              ...(weight !== undefined ? { weight } : {}),
              unit,
              ...(rpe !== undefined ? { rpe } : {}),
            });
          }
          exercises.push({
            ...(str(ex.id) ? { id: str(ex.id) } : {}),
            name: exName,
            sets,
            ...(str(ex.notes) ? { notes: str(ex.notes) } : {}),
          });
        }
      }

      if (!name && !date && durationMinutes === undefined && !exercises) {
        return reject('Nothing to change.');
      }

      const update: PastWorkoutUpdate = {
        ...(name ? { name } : {}),
        ...(date ? { date } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
        ...(exercises ? { exercises } : {}),
      };

      const changes: string[] = [];
      if (name) changes.push(`rename to "${name}"`);
      if (date) changes.push(`date to ${date}`);
      if (exercises) changes.push(`${exercises.length} exercises updated`);

      return {
        kind: 'confirm', id,
        summary: `Edit past workout: ${changes.join(', ')}`,
        detail: exercises
          ? exercises.map((e) => `${e.name} (${e.sets.map((s) => `${s.reps}${s.weight ? `@${s.weight}` : ''}`).join(', ')})`).join('; ')
          : undefined,
        apply: [],
        effects: [{ type: 'editPastWorkout', workoutId, update }],
      };
    }

    case 'openTab': {
      const tab = i.tab;
      if (!isTab(tab)) return reject('That tab does not exist.');
      if (tab === 'workout' && !ctx.activeWorkout) {
        return reject('No workout is in progress, so there is no Workout tab to open.');
      }
      const label = TAB_LABEL[tab];
      if (ctx.pathname !== undefined && tabOfPath(ctx.pathname) === tab) {
        return { kind: 'auto', id, summary: `Already on ${label}`, apply: [], undo: [] };
      }
      return { kind: 'auto', id, summary: `Opened ${label}`, apply: [], undo: [], navigate: TAB_PATHS[tab] };
    }

    case 'startWorkout': {
      if (ctx.activeWorkout) {
        return reject(`"${ctx.activeWorkout.name}" is still in progress. End or finish it first.`);
      }
      const named = [i.workoutId !== undefined, i.planId !== undefined, i.today === true].filter(Boolean).length;
      if (named !== 1) return reject("Say which workout to start: a saved one, a planned one, or today's plan.");

      let name: string;
      let prepared: WorkoutExercise[];
      let planContext: ActivePlanContext | undefined;
      let savedWorkoutId: string | undefined;
      if (i.workoutId !== undefined) {
        const saved = ctx.savedWorkouts?.find((w) => w.id === i.workoutId);
        if (!saved) return reject('That saved workout does not exist.');
        // The app's own saved-workout start (as Profile does it), then tracked
        // lifts prescribed the way a planned workout's are.
        const converted = convertSavedWorkoutToExercises(
          { ...saved, parsedWorkout: { ...saved.parsedWorkout, supersets: saved.parsedWorkout.supersets ?? [] } } as unknown as SavedWorkout,
          ctx.library,
        );
        if (converted.length === 0) return reject('That saved workout has no exercises.');
        name = saved.name;
        savedWorkoutId = saved.id;
        prepared = preparePlannedWorkoutForExecution(
          { id: `ai-${id}`, dateKey: ctx.todayKey ?? '', name, exercises: converted, status: 'planned', createdAt: '' },
          ctx.trackedLifts,
          ctx.defaultGoal,
        );
      } else {
        const plans = ctx.plannedWorkouts ?? [];
        let plan: PlannedWorkout | undefined;
        if (i.planId !== undefined) {
          plan = plans.find((p) => p.id === i.planId);
          if (!plan) return reject('That planned workout does not exist.');
          if (plan.status !== 'planned') return reject(`"${plan.name}" is already ${plan.status}.`);
        } else {
          plan = plans.find((p) => p.dateKey === ctx.todayKey && p.status === 'planned');
          if (!plan) return reject('Nothing is planned for today.');
        }
        if (plan.exercises.length === 0) return reject('That planned workout has no exercises.');
        name = plan.name;
        planContext = { templateId: 'planned-workout', dateKey: plan.dateKey, plannedWorkoutId: plan.id };
        prepared = preparePlannedWorkoutForExecution(plan, ctx.trackedLifts, ctx.defaultGoal);
      }

      // Stable ids from the call, so the plan at Apply matches the card's.
      const exercises = withStableIds(id, prepared);
      const changed = applyOverrides(exercises, i.overrides, ctx);
      if (typeof changed === 'string') return reject(changed);
      const sanitized = sanitizeWorkoutExercisesForRedux(exercises) as WorkoutExercise[];
      return {
        kind: 'confirm', id,
        summary: `Start "${name}" (${plural(sanitized.length, 'exercise')})`,
        detail: [str(i.reason), changed.length ? `Changed: ${changed.join(', ')}` : '', describeWorkoutExercises(sanitized)]
          .filter(Boolean)
          .join(' — '),
        apply: [startWorkout({ name, exercises: sanitized })],
        afterApply: {
          navigate: '/workout',
          closeChat: true,
          ...(planContext ? { planContext } : {}),
          ...(savedWorkoutId ? { markPerformed: savedWorkoutId } : {}),
        },
      };
    }

    case 'loadIntoBuild': {
      const fromSaved = i.workoutId !== undefined;
      if (fromSaved === (i.exercises !== undefined)) {
        return reject('Say what to load: a saved workout or a list of exercises.');
      }
      if (i.name !== undefined && !str(i.name)) return reject('That name is not valid.');
      let workout: SavedWorkoutDraft;
      if (fromSaved) {
        const saved = ctx.savedWorkouts?.find((w) => w.id === i.workoutId);
        if (!saved) return reject('That saved workout does not exist.');
        workout = {
          name: str(i.name) ?? saved.name,
          workoutText: saved.workoutText,
          parsedWorkout: { exercises: saved.parsedWorkout.exercises ?? [], supersets: saved.parsedWorkout.supersets ?? [] },
        };
      } else {
        const exercises = readExercises(i.exercises, ctx);
        if (typeof exercises === 'string') return reject(exercises);
        const parsedWorkout = { exercises, supersets: [] };
        workout = { name: str(i.name) ?? 'AI workout', workoutText: workoutText(parsedWorkout), parsedWorkout };
      }
      const count = workout.parsedWorkout.exercises.length + (workout.parsedWorkout.supersets?.length ?? 0);
      if (count === 0) return reject('That workout has no exercises.');
      return {
        kind: 'confirm', id,
        summary: `Load "${workout.name}" into Build (${plural(count, 'exercise')})`,
        detail: [
          ctx.buildHasDraft ? 'This replaces what is on the Build screen now.' : '',
          str(i.reason),
          describeExercises(workout.parsedWorkout.exercises),
        ].filter(Boolean).join(' — '),
        apply: [buildPresetSet({ id: `build-${id}`, name: workout.name, workout })],
        afterApply: { navigate: '/build/custom', closeChat: true },
      };
    }

    default:
      return reject(`Unknown tool ${String((call as { name: unknown }).name)}.`);
  }
}

// ---------------------------------------------------------------------------
// App-control helpers (openTab, startWorkout, loadIntoBuild)
// ---------------------------------------------------------------------------

const TABS: readonly AiAppTab[] = ['today', 'workout', 'build', 'library', 'profile'];
const isTab = (v: unknown): v is AiAppTab => TABS.includes(v as AiAppTab);
const TAB_PATHS: Record<AiAppTab, string> = {
  today: '/',
  workout: '/workout',
  build: '/build',
  library: '/exercises',
  profile: '/profile',
};
const TAB_LABEL: Record<AiAppTab, string> = {
  today: 'Today',
  workout: 'Workout',
  build: 'Build',
  library: 'Library',
  profile: 'Profile',
};

/** The tab a route belongs to (Build covers the wizard and the custom builder). */
export function tabOfPath(pathname: string): AiAppTab | 'other' {
  if (pathname === '/' || pathname === '') return 'today';
  if (pathname.startsWith('/workout')) return 'workout';
  if (pathname.startsWith('/build')) return 'build';
  if (pathname.startsWith('/exercises')) return 'library';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'other';
}

/**
 * Exercises re-identified from the call id (exercise, set and superset ids),
 * with library-shaped exercises that carry no timestamps, so planning the
 * same call twice gives the same actions.
 */
function withStableIds(callId: string, list: readonly WorkoutExercise[]): WorkoutExercise[] {
  const ids = new Map<string, string>();
  const supersets = new Map<string, string>();
  list.forEach((e, k) => ids.set(e.id, `exercise-${callId}-${k}`));
  return list.map((e, k) => {
    const exercise = e.exercise.id.startsWith('fallback-') ? fallbackExercise(e.exercise.name) : plainExercise(e.exercise);
    let supersetId = e.supersetId;
    if (supersetId) {
      if (!supersets.has(supersetId)) supersets.set(supersetId, `superset-${callId}-${supersets.size}`);
      supersetId = supersets.get(supersetId);
    }
    return {
      ...e,
      id: ids.get(e.id)!,
      exercise,
      sets: e.sets.map((s, n) => ({ ...s, id: `set-${callId}-${k}-${n}` })),
      ...(supersetId ? { supersetId } : {}),
      ...(e.supersetExerciseIds ? { supersetExerciseIds: e.supersetExerciseIds.map((x) => ids.get(x) ?? x) } : {}),
    };
  });
}

/** The one exercise an override means: by index, else by (unambiguous) name. */
function overrideTarget(list: readonly WorkoutExercise[], o: Record<string, unknown>): WorkoutExercise | string {
  if (o.index !== undefined) {
    const k = index(o.index);
    if (k === undefined || k >= list.length) return 'That exercise number is not in the workout.';
    return list[k];
  }
  const asked = str(o.exerciseName);
  if (!asked) return 'Say which exercise to change.';
  const key = normalName(asked);
  const nameOf = (e: WorkoutExercise) => normalName(e.customTitle || e.exercise.name);
  const exact = list.filter((e) => nameOf(e) === key);
  if (exact.length === 1) return exact[0];
  const words = key.split(' ').filter(Boolean);
  const loose = exact.length ? exact : list.filter((e) => {
    const own = new Set(nameOf(e).split(' '));
    return words.length > 0 && words.every((w) => own.has(w));
  });
  if (loose.length === 1) return loose[0];
  return loose.length ? `"${asked}" matches more than one exercise.` : `"${asked}" is not in that workout.`;
}

/**
 * Applies the lifter's named sets / reps / weight to the exercises in place.
 * Resolves with a line per change, or a reason when an override is not valid.
 */
function applyOverrides(list: WorkoutExercise[], raw: unknown, ctx: PlanContext): string[] | string {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return 'Those changes are not valid.';
  if (raw.length > 20) return 'Too many changes at once.';
  const lines: string[] = [];
  for (const item of raw) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const target = overrideTarget(list, o);
    if (typeof target === 'string') return target;
    const label = target.customTitle || target.exercise.name;
    if (o.sets === undefined && o.reps === undefined && o.weight === undefined) return `Nothing to change for ${label}.`;
    const what: string[] = [];
    if (o.sets !== undefined) {
      const n = index(o.sets);
      if (!n || n > 10) return `${label}: sets must be 1–10.`;
      const last = target.sets[target.sets.length - 1];
      if (!last) return `${label} has no sets to copy.`;
      target.sets = Array.from({ length: n }, (_, k) => target.sets[k] ?? { ...last, completed: false });
      what.push(plural(n, 'set'));
    }
    if (o.reps !== undefined) {
      const reps = index(o.reps);
      if (!reps || reps > 100) return `${label}: reps must be 1–100.`;
      target.sets = target.sets.map((s) => {
        const next = { ...s, reps };
        delete next.repMin;
        delete next.repMax;
        return next;
      });
      what.push(`${reps} reps`);
    }
    if (o.weight !== undefined) {
      const unit = unitOf(target.sets[0]);
      const check = checkProposedLoad(num(o.weight) ?? 0, null, unit, stepFor(ctx, target, unit));
      if (!check.ok) return `${label}: ${check.reason}`;
      target.sets = target.sets.map((s) => ({ ...s, weight: check.value }));
      what.push(`${check.value} ${unit}`);
    }
    target.sets = target.sets.map((s, n) => ({ ...s, id: `${target.id.replace(/^exercise-/, 'set-')}-${n}` }));
    lines.push(`${label} ${what.join(' × ')}`);
  }
  return lines;
}

/** "Barbell Bench Press 3×8 @ 135 lb, …" for a start card. */
function describeWorkoutExercises(list: readonly WorkoutExercise[]): string {
  return list
    .map((e) => {
      const first = e.sets[0];
      if (!first) return e.customTitle || e.exercise.name;
      const reps = first.repMin !== undefined && first.repMax !== undefined ? `${first.repMin}-${first.repMax}` : `${first.reps}`;
      const load = first.weight ? ` @ ${first.weight} ${unitOf(first)}` : '';
      return `${e.customTitle || e.exercise.name} ${e.sets.length}×${reps}${load}`;
    })
    .join(', ');
}

/**
 * One assistant turn for the chat sheet: auto plans become "applied" notices,
 * confirm plans Apply/Reject proposals, rejected plans "discarded" notices.
 * An ongoing swap's "benchmark stays" note is dropped when the same turn also
 * proposes a new benchmark for that lift.
 */
export function toAssistantTurn(
  reply: string,
  plans: ReadonlyArray<{ call: ToolCallForPlan | AiToolCall; plan: ToolPlan }>,
): Required<Pick<AiAssistantTurn, 'text' | 'proposals' | 'notices'>> {
  const proposals: NonNullable<AiAssistantTurn['proposals']> = [];
  const notices: NonNullable<AiAssistantTurn['notices']> = [];
  const rebenchmarked = new Set<string>();
  for (const { call, plan } of plans) {
    if (call.name === 'updateBenchmark' && plan.kind === 'confirm') {
      rebenchmarked.add(String((call.input as Record<string, unknown>).liftId));
    }
  }
  for (const { call, plan } of plans) {
    if (plan.kind === 'auto') notices.push({ id: plan.id, tone: 'applied', text: plan.summary });
    else if (plan.kind === 'rejected') {
      notices.push({ id: plan.id, tone: 'discarded', text: `Suggestion discarded: ${plan.reason}` });
    } else {
      const note = plan.benchmarkNote;
      const detail = note && rebenchmarked.has(note.liftId)
        ? plan.detail?.replace(note.text, '').trim()
        : plan.detail;
      proposals.push({
        id: plan.id, tool: call.name, summary: plan.summary,
        ...(detail ? { detail } : {}),
      });
    }
  }
  return { text: reply, proposals, notices };
}
