/**
 * The read-only slice of app state sent with each chat turn. Kept small:
 * names, ids, numbers; no media, instructions or account data.
 *
 * The ids are the ones the tool planner (`applyTool.ts`) resolves:
 * exercise `id` → `exerciseId`, set `index` → `setIndex` / `fromSetIndex`,
 * tracked lift `id` → `liftId`.
 */
import type { ActiveWorkout, Exercise } from '../types/exercise';
import type { SessionGoal, TrackedLift, TrackedSetLog, WeightUnit } from '../types/trackedLifts';
import { currentEstimate, prescribe, progressionStatus, roundLoad } from '../lib/trackedLiftProgression';
import { formatLoad, formatTarget } from '../lib/trackedLifts';
import { swapAlternatives } from './alternatives';
import type { AiChatContext } from './types';

/** Sessions of a lift's log sent along (the engine keeps up to 6). */
const RECENT_SESSIONS = 3;
/** Client-side JSON size target, below the Worker's 40,000-char cap. */
export const CONTEXT_BUDGET = 30_000;

export interface AiContextSet {
  index: number;
  reps: number;
  repMin?: number;
  repMax?: number;
  weight?: number;
  time?: number;
  rir?: number;
  completed: boolean;
}

export interface AiContextExercise {
  id: string;
  name: string;
  /** Unit of this exercise's set weights. */
  unit?: 'lbs' | 'kg';
  trackedLiftId?: string;
  goal?: SessionGoal;
  sets: AiContextSet[];
  /** Library names that work the same muscles: what swapExercise can resolve. */
  alternatives?: string[];
}

/** A tracked lift; lifts outside today's workout may be cut to id, name and benchmark. */
export interface AiContextLift {
  id: string;
  name: string;
  category?: string;
  benchmark: string;
  unit?: WeightUnit;
  step?: number;
  equipment?: TrackedLift['equipment'];
  progression?: boolean;
  /** Current estimated 1RM, rounded to a loadable number. */
  estimate?: number;
  status?: string;
  recentSessions?: { date: string; goal: SessionGoal; sets: TrackedSetLog[] }[];
  /** Next sessions as the engine prescribes them, e.g. "8-12@180, 8-12@180". */
  next?: { volume: string; strength: string; checkpoint: string };
}

export interface AiContext extends AiChatContext {
  activeWorkout?: { name: string; exercises: AiContextExercise[] };
  trackedLifts: AiContextLift[];
}

/** Copy only the defined keys, so JSON stays free of nulls and extras. */
function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  return out;
}

function liftUnit(lift: TrackedLift): WeightUnit | undefined {
  if (lift.load.kind === 'weight') return lift.load.unit;
  if (lift.load.kind === 'bodyweight') return lift.load.plus?.unit;
  return undefined;
}

const describeSets = (lift: TrackedLift, goal: SessionGoal): string =>
  prescribe(lift, goal)
    .sets.map((s) => {
      const reps = typeof s.reps === 'object' ? `${s.reps.min}-${s.reps.max}` : `${s.reps}`;
      return `${reps}${s.weight ? `@${s.weight}` : ''}${s.time ? ` ${s.time}s` : ''}`;
    })
    .join(', ');

const SET_KEYS = ['reps', 'repMin', 'repMax', 'weight', 'time', 'rir'] as const;
const LOG_KEYS = ['reps', 'weight', 'rir', 'time'] as const;

export function buildAiContext(input: {
  screen: AiChatContext['screen'];
  units: 'lbs' | 'kg';
  activeWorkout: ActiveWorkout | null;
  trackedLifts: TrackedLift[];
  focusExerciseId?: string;
  /** The merged exercise library (built-in + custom), for swap alternatives. */
  library?: readonly Exercise[];
}): AiContext {
  const { activeWorkout, library = [] } = input;
  const alternativesFor = (e: ActiveWorkout['exercises'][number]) => {
    const names = library.length && e.exercise ? swapAlternatives(e.exercise, library) : [];
    return names.length ? { alternatives: names } : {};
  };
  const ctx: AiContext = {
    screen: input.screen,
    units: input.units,
    ...(input.focusExerciseId ? { focusExerciseId: input.focusExerciseId } : {}),
    ...(activeWorkout
      ? {
          activeWorkout: {
            name: activeWorkout.name,
            exercises: activeWorkout.exercises.map((e) => ({
              id: e.id,
              name: e.customTitle || e.exercise.name,
              ...(e.sets[0]?.unit ? { unit: e.sets[0].unit } : {}),
              ...(e.tracked ? { trackedLiftId: e.tracked.liftId, goal: e.tracked.goal } : {}),
              sets: e.sets.map((s, index) => ({ index, ...pick(s, SET_KEYS), completed: s.completed })),
              ...alternativesFor(e),
            })),
          },
        }
      : {}),
    trackedLifts: input.trackedLifts.map((l) => {
      const unit = liftUnit(l);
      const estimate = currentEstimate(l);
      const sessions = (l.sessions ?? []).slice(-RECENT_SESSIONS);
      return {
        id: l.id,
        name: l.name,
        category: l.category,
        benchmark: [formatLoad(l.load), formatTarget(l.target)].filter(Boolean).join(', '),
        ...(unit ? { unit } : {}),
        ...(l.step !== undefined ? { step: l.step } : {}),
        ...(l.equipment ? { equipment: l.equipment } : {}),
        progression: !!l.progression,
        ...(estimate && unit ? { estimate: roundLoad(estimate.value, unit, l.step) } : {}),
        ...(l.progression ? { status: progressionStatus(l) } : {}),
        ...(sessions.length
          ? {
              recentSessions: sessions.map((s) => ({
                date: s.date.slice(0, 10),
                goal: s.goal,
                sets: s.sets.map((set) => pick(set, LOG_KEYS) as TrackedSetLog),
              })),
            }
          : {}),
        ...(l.progression
          ? {
              next: {
                volume: describeSets(l, 'volume'),
                strength: describeSets(l, 'strength'),
                checkpoint: describeSets(l, 'checkpoint'),
              },
            }
          : {}),
      };
    }),
  };

  // Lifts in today's workout (which includes the focus exercise's lift) are never trimmed.
  const keep = new Set<string>();
  for (const e of activeWorkout?.exercises ?? []) if (e.tracked) keep.add(e.tracked.liftId);
  return fitBudget(ctx, keep);
}

const fits = (ctx: AiContext): boolean => JSON.stringify(ctx).length <= CONTEXT_BUDGET;

/** The context with `alternatives` removed from the exercises `drop` selects. */
function withoutAlternatives(ctx: AiContext, drop: (e: AiContextExercise) => boolean): AiContext {
  if (!ctx.activeWorkout) return ctx;
  return {
    ...ctx,
    activeWorkout: {
      ...ctx.activeWorkout,
      exercises: ctx.activeWorkout.exercises.map((e) => {
        if (!e.alternatives || !drop(e)) return e;
        const rest = { ...e };
        delete rest.alternatives;
        return rest;
      }),
    },
  };
}

/**
 * Trim in stages until the JSON fits `CONTEXT_BUDGET`: the other lifts lose
 * their recent sessions, then their prescriptions, then all but id, name and
 * benchmark; then non-focus exercises lose their swap alternatives, and
 * finally the focus exercise does too.
 */
function fitBudget(ctx: AiContext, keep: ReadonlySet<string>): AiContext {
  const liftStages: ((l: AiContextLift) => AiContextLift)[] = [
    (l) => ({ ...l, recentSessions: undefined }),
    (l) => ({ ...l, next: undefined }),
    ({ id, name, benchmark }) => ({ id, name, benchmark }),
  ];
  let out = ctx;
  for (const stage of liftStages) {
    if (fits(out)) return out;
    out = { ...out, trackedLifts: out.trackedLifts.map((l) => (keep.has(l.id) ? l : stage(l))) };
  }
  if (fits(out)) return out;
  out = withoutAlternatives(out, (e) => e.id !== ctx.focusExerciseId);
  if (fits(out)) return out;
  return withoutAlternatives(out, () => true);
}
