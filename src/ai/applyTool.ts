/**
 * Turns one AI tool call into Redux actions, tiered per the design:
 *   auto     — only today's workout, just described → apply now, Undo restores
 *   confirm  — saved data or future numbers → Apply/Reject card
 *   rejected — unknown ids, bad shapes, loads the engine refuses
 * Pure: reads a snapshot, returns actions; the caller dispatches.
 *
 * Units: workout sets say 'lbs' | 'kg', tracked lifts and the engine say
 * 'lb' | 'kg'. Everything here (checks, summaries) uses 'lb' | 'kg'.
 */
import type { UnknownAction } from '@reduxjs/toolkit';
import type { ActiveWorkout, Exercise, WorkoutExercise, WorkoutSet } from '../types/exercise';
import type { TrackedLift, TrackedLoad, TrackedTarget, WeightUnit } from '../types/trackedLifts';
import { replaceExerciseMovement, setsPatched, type SetPatch } from '../store/slices/workoutSlice';
import { prescribedFloor } from '../lib/progression/setPrescription';
import { liftAdded, liftRemoved, liftUpdated } from '../store/slices/trackedLiftsSlice';
import { checkProposedLoad } from '../lib/aiLoadCheck';
import { formatLoad, formatTarget } from '../lib/trackedLifts';
import { fromFlatLift, type FlatLift } from './liftFields';
import type { AiAssistantTurn, AiToolCall } from './types';

export interface PlanContext {
  activeWorkout: ActiveWorkout | null;
  trackedLifts: TrackedLift[];
  library: Exercise[];
}

export type ToolPlan =
  | { kind: 'auto'; id: string; summary: string; apply: UnknownAction[]; undo: UnknownAction[] }
  | {
      kind: 'confirm'; id: string; summary: string; detail?: string; apply: UnknownAction[];
      /** The "benchmark stays" sentence inside `detail`, for the lift an ongoing swap renames. */
      benchmarkNote?: { liftId: string; text: string };
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
 * case, spacing and punctuation), else the shortest name that contains every
 * word of it (words of 2+ letters), else none. The model often drops the
 * equipment prefix the library uses ("Romanian Deadlift" → "Barbell
 * Romanian Deadlift").
 */
function libraryMatch(ctx: PlanContext, name: string): Exercise | undefined {
  const key = normalName(name);
  if (!key) return undefined;
  const exact = ctx.library.find((e) => normalName(e.name) === key);
  if (exact) return exact;
  const words = key.split(' ').filter((w) => w.length >= 2);
  if (words.length === 0) return undefined;
  let best: Exercise | undefined;
  for (const e of ctx.library) {
    const own = new Set(normalName(e.name).split(' '));
    if (!words.every((w) => own.has(w))) continue;
    if (!best || e.name.length < best.name.length || (e.name.length === best.name.length && e.name < best.name)) best = e;
  }
  return best;
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

export function planToolCall(call: AiToolCall, ctx: PlanContext): ToolPlan {
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

    case 'swapExercise': {
      const ex = findExercise(ctx, i.exerciseId);
      if (!ex) return reject('That exercise is not in this workout.');
      const name = str(i.replacementExerciseName);
      if (!name) return reject('No replacement exercise was named.');
      const replacement = libraryMatch(ctx, name);
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

    default:
      return reject(`Unknown tool ${String((call as { name: unknown }).name)}.`);
  }
}

/**
 * One assistant turn for the chat sheet: auto plans become "applied" notices,
 * confirm plans Apply/Reject proposals, rejected plans "discarded" notices.
 * An ongoing swap's "benchmark stays" note is dropped when the same turn also
 * proposes a new benchmark for that lift.
 */
export function toAssistantTurn(
  reply: string,
  plans: ReadonlyArray<{ call: AiToolCall; plan: ToolPlan }>,
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
