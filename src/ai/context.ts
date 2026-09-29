/**
 * The read-only slice of app state sent with each chat turn. Kept small:
 * names, ids, numbers; no media, instructions or account data.
 *
 * The ids are the ones the tool planner (`applyTool.ts`) resolves:
 * exercise `id` → `exerciseId`, set `index` → `setIndex` / `fromSetIndex`,
 * tracked lift `id` → `liftId`.
 */
import type { ActiveWorkout } from '../types/exercise';
import type { SessionGoal, TrackedLift, TrackedSetLog, WeightUnit } from '../types/trackedLifts';
import { currentEstimate, prescribe, progressionStatus, roundLoad } from '../lib/trackedLiftProgression';
import { formatLoad, formatTarget } from '../lib/trackedLifts';
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
}): AiContext {
  const { activeWorkout } = input;
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

/**
 * Trim the other lifts in stages until the JSON fits `CONTEXT_BUDGET`:
 * drop their recent sessions, then their prescriptions, then all but
 * id, name and benchmark.
 */
function fitBudget(ctx: AiContext, keep: ReadonlySet<string>): AiContext {
  const stages: ((l: AiContextLift) => AiContextLift)[] = [
    (l) => ({ ...l, recentSessions: undefined }),
    (l) => ({ ...l, next: undefined }),
    ({ id, name, benchmark }) => ({ id, name, benchmark }),
  ];
  let out = ctx;
  for (const stage of stages) {
    if (JSON.stringify(out).length <= CONTEXT_BUDGET) break;
    out = { ...out, trackedLifts: out.trackedLifts.map((l) => (keep.has(l.id) ? l : stage(l))) };
  }
  return out;
}
