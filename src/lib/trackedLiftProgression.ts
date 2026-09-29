/**
 * Tracked-lift progression (design: docs/plans/2026-09-26-tracked-lift-progression-design.md).
 *
 * Progression lifts are prescribed from their own log for the session goal:
 * Strength (heavy triples), Volume (double-progression 8–12), or a checkpoint
 * day (warm-up ladder to a max attempt) once 2 of each are done. Loads without
 * a formula (a named step, bodyweight, timed holds) are exceptions: the tracked
 * step is kept and only sets / reps / time change. Accessories are copied from
 * their entry verbatim.
 *
 * Everything here is pure; the slice and pages wire it up.
 */
import { estimateOneRepMax } from './oneRepMax';
import { smoothedSessionE1RM } from './progression';
import type { ParsedExercise, ParsedSet } from '../parser/types';
import type { WorkoutExercise } from '../types/exercise';
import type {
  PendingBest,
  SessionGoal,
  TrackedLift,
  TrackedLoad,
  TrackedSetLog,
  TrackedTarget,
  WeightUnit,
} from '../types/trackedLifts';

/** A builder exercise that remembers which tracked lift and goal it came from. */
export interface TrackedParsedExercise extends ParsedExercise {
  tracked?: { liftId: string; goal: SessionGoal };
}

export const DEFAULT_SETS = 3;
/** Sessions kept per lift (enough for the 3-session median plus a margin). */
export const SESSION_LOG_CAP = 6;
/** Sessions of each goal before a checkpoint is due. */
export const SESSIONS_PER_GOAL = 2;

const LB_PER_KG = 2.20462;

/** Round to the loadable increment: the equipment `step`, else 5 lb or 2.5 kg. */
export function roundLoad(value: number, unit: WeightUnit, step?: number): number {
  const inc = step && step > 0 ? step : unit === 'kg' ? 2.5 : 5;
  return Math.round(value / inc) * inc;
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return to === 'kg' ? value / LB_PER_KG : value * LB_PER_KG;
}

const parsedUnit = (unit: WeightUnit): 'lbs' | 'kg' => (unit === 'kg' ? 'kg' : 'lbs');

// --- estimate -----------------------------------------------------------------

/** The benchmark read as an estimated 1RM (weight loads only). */
export function benchmarkE1RM(lift: TrackedLift): number | null {
  if (lift.load.kind !== 'weight') return null;
  const { value } = lift.load;
  const { target } = lift;
  const reps =
    target.kind === 'repMax' ? target.reps : target.kind === 'reps' ? target.min : 10;
  return estimateOneRepMax(value, reps);
}

/**
 * Current estimated 1RM for a weighted progression lift: the median of the
 * last 3 sessions' best effort-adjusted sets from its own log, else the
 * benchmark. `null` for loads without a formula.
 */
export function currentEstimate(lift: TrackedLift): { value: number; fromLog: boolean } | null {
  if (lift.load.kind !== 'weight') return null;
  const logged = (lift.sessions ?? []).map((s) =>
    s.sets
      .filter((set) => (set.weight ?? 0) > 0 && set.reps > 0)
      .map((set) => ({ weight: set.weight!, reps: set.reps, rir: set.rir })),
  );
  const fromLog = smoothedSessionE1RM(logged);
  if (fromLog != null) return { value: fromLog, fromLog: true };
  const bench = benchmarkE1RM(lift);
  return bench != null ? { value: bench, fromLog: false } : null;
}

// --- cycle ----------------------------------------------------------------------

export function cycleOf(lift: TrackedLift): { volume: number; strength: number } {
  return lift.cycle ?? { volume: 0, strength: 0 };
}

export function checkpointDue(lift: TrackedLift): boolean {
  if (!lift.progression) return false;
  const c = cycleOf(lift);
  return c.volume >= SESSIONS_PER_GOAL && c.strength >= SESSIONS_PER_GOAL;
}

// --- prescriptions ------------------------------------------------------------------

const repeat = (n: number, set: ParsedSet): ParsedSet[] =>
  Array.from({ length: n }, () => ({ ...set }));

/** Accessories and anything unflagged: the tracked entry, verbatim. */
export function accessoryExercise(lift: TrackedLift): TrackedParsedExercise {
  const { load, target } = lift;
  const weighted =
    load.kind === 'weight'
      ? { value: load.value, unit: load.unit }
      : load.kind === 'bodyweight'
        ? load.plus
        : undefined;

  const reps: ParsedSet['reps'] =
    target.kind === 'reps'
      ? target.max !== undefined && target.max > target.min
        ? { min: target.min, max: target.max }
        : target.min
      : target.kind === 'repMax'
        ? target.reps
        : target.kind === 'time'
          ? 1
          : 10;

  const set: ParsedSet = { reps };
  if (weighted) {
    set.weight = weighted.value;
    set.unit = parsedUnit(weighted.unit);
  }
  if (target.kind === 'time') set.time = target.seconds;

  const count = lift.sets ?? (target.kind === 'repMax' ? 1 : DEFAULT_SETS);
  const notes = [
    load.kind === 'level' ? load.label.trim() : '',
    target.kind === 'time' ? `${target.seconds} s under tension${target.tempo ? `, tempo ${target.tempo}` : ''}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  return { name: lift.name, sets: repeat(count, set), ...(notes ? { notes } : {}) };
}

/** Checkpoint warm-up ladder: [reps, fraction of estimate], then the attempt. */
const CHECKPOINT_LADDER: ReadonlyArray<[number, number]> = [
  [5, 0.5],
  [3, 0.7],
  [1, 0.85],
  [1, 0.95],
];
const ATTEMPT_FRACTION = 1.02;

/**
 * Sets for a progression lift and goal. Weighted loads use the current
 * estimate; the other load kinds are the documented exceptions.
 */
export function prescribe(lift: TrackedLift, goal: SessionGoal): TrackedParsedExercise {
  const tracked = { liftId: lift.id, goal };
  const base = { name: lift.name, tracked };
  const { load, target } = lift;

  if (load.kind === 'weight') {
    const estimate = currentEstimate(lift)?.value ?? load.value;
    const unit = parsedUnit(load.unit);
    const at = (fraction: number) => roundLoad(estimate * fraction, load.unit, lift.step);
    if (goal === 'strength') {
      return { ...base, restTime: 180, sets: repeat(4, { reps: 3, weight: at(0.85), unit }) };
    }
    if (goal === 'volume') {
      return {
        ...base,
        restTime: 90,
        sets: repeat(4, { reps: { min: 8, max: 12 }, weight: at(0.675), unit }),
      };
    }
    // The attempt always goes after the benchmark: at least one loadable step
    // above it, even when submaximal logged sets read low (no RIR tapped).
    const step = lift.step && lift.step > 0 ? lift.step : load.unit === 'kg' ? 2.5 : 5;
    const bench = benchmarkE1RM(lift);
    const attempt = Math.max(
      at(ATTEMPT_FRACTION),
      bench != null ? roundLoad(bench, load.unit, lift.step) + step : 0,
    );
    const top = attempt / ATTEMPT_FRACTION;
    return {
      ...base,
      restTime: 180,
      notes: 'Checkpoint: warm up, then one max attempt',
      sets: [
        ...CHECKPOINT_LADDER.map(([reps, f]) => ({ reps, weight: roundLoad(top * f, load.unit, lift.step), unit })),
        { reps: 1, weight: attempt, unit },
      ],
    };
  }

  if (target.kind === 'time') {
    const seconds = target.seconds;
    if (goal === 'volume') return { ...base, restTime: 60, sets: repeat(4, { reps: 1, time: seconds }) };
    if (goal === 'strength') {
      return { ...base, restTime: 90, sets: repeat(3, { reps: 1, time: Math.round(seconds * 1.25) }) };
    }
    return { ...base, restTime: 120, notes: 'Checkpoint: one max hold', sets: [{ reps: 1, time: seconds }] };
  }

  // Named step or bodyweight: keep the step / added load, change the reps.
  const added = load.kind === 'bodyweight' ? load.plus : undefined;
  const withLoad = (reps: ParsedSet['reps']): ParsedSet =>
    added ? { reps, weight: added.value, unit: parsedUnit(added.unit) } : { reps };
  const step = load.kind === 'level' ? load.label.trim() : '';

  if (goal === 'volume') {
    return { ...base, restTime: 90, ...(step ? { notes: step } : {}), sets: repeat(4, withLoad(12)) };
  }
  if (goal === 'strength') {
    return {
      ...base,
      restTime: 150,
      notes: step ? `${step}; try the next step up` : 'Add load or slow the tempo',
      sets: repeat(5, withLoad(5)),
    };
  }
  const usual = target.kind === 'reps' ? target.min : target.kind === 'repMax' ? target.reps : 5;
  return {
    ...base,
    restTime: 180,
    notes:
      load.kind === 'level'
        ? `Checkpoint: try the step after ${step} for ${usual} reps`
        : 'Checkpoint: one set of max reps',
    sets: [withLoad(load.kind === 'level' ? usual : target.kind === 'reps' ? target.min : 10)],
  };
}

/**
 * The builder workout for the chosen lifts. Progression lifts follow `goal`
 * (the Build page only passes 'checkpoint' with the due lifts); accessories
 * are always the tracked entry.
 */
export function buildTrackedWorkout(
  lifts: TrackedLift[],
  goal: SessionGoal | null,
): { exercises: TrackedParsedExercise[]; supersets: [] } {
  return {
    exercises: lifts.map((lift) =>
      lift.progression && goal ? prescribe(lift, goal) : accessoryExercise(lift),
    ),
    supersets: [],
  };
}

// --- recording + new bests -------------------------------------------------------------

/**
 * A logged set that beats the benchmark, as the benchmark it would become.
 * Weight: heavier at ≥ the benchmark reps, or more reps at the same load (a
 * 1RM: a heavier single). Bodyweight reps: more reps. Time: a longer hold.
 * Named steps can't be judged from numbers, so they never qualify.
 */
export function newBest(
  lift: TrackedLift,
  sets: TrackedSetLog[],
): { load: TrackedLoad; target: TrackedTarget } | null {
  const { load, target } = lift;

  if (load.kind === 'weight') {
    const benchReps =
      target.kind === 'repMax' ? target.reps : target.kind === 'reps' ? target.min : 1;
    let best: { weight: number; reps: number } | null = null;
    for (const s of sets) {
      const w = s.weight ?? 0;
      if (w <= 0 || s.reps < benchReps) continue;
      const beats = w > load.value || (w === load.value && s.reps > benchReps && target.kind === 'reps');
      if (!beats) continue;
      if (!best || estimateOneRepMax(w, s.reps) > estimateOneRepMax(best.weight, best.reps)) {
        best = { weight: w, reps: s.reps };
      }
    }
    if (!best) return null;
    const newTarget: TrackedTarget =
      target.kind === 'reps' && best.weight === load.value
        ? { kind: 'reps', min: best.reps, ...(target.max && target.max > best.reps ? { max: target.max } : {}) }
        : target;
    return { load: { ...load, value: best.weight }, target: newTarget };
  }

  if (target.kind === 'time') {
    const longest = Math.max(0, ...sets.map((s) => s.time ?? 0));
    return longest > target.seconds ? { load, target: { ...target, seconds: longest } } : null;
  }

  if (load.kind === 'bodyweight' && target.kind === 'reps') {
    const most = Math.max(0, ...sets.map((s) => s.reps));
    if (most <= target.min) return null;
    return {
      load,
      target: { kind: 'reps', min: most, ...(target.max && target.max > most ? { max: target.max } : {}) },
    };
  }

  return null;
}

/**
 * Apply one finished session to a lift: append it to the log (capped), move
 * the cycle (a checkpoint resets it), and report a new best if there is one.
 */
export function recordSession(
  lift: TrackedLift,
  session: { date: string; goal: SessionGoal; sets: TrackedSetLog[] },
): { lift: TrackedLift; best: PendingBest | null } {
  const c = cycleOf(lift);
  const cycle =
    session.goal === 'checkpoint'
      ? { volume: 0, strength: 0 }
      : { ...c, [session.goal]: c[session.goal] + 1 };
  const sessions = [...(lift.sessions ?? []), session].slice(-SESSION_LOG_CAP);
  const found = newBest(lift, session.sets);
  return {
    lift: { ...lift, cycle, sessions },
    best: found ? { liftId: lift.id, ...found } : null,
  };
}

/** Status line for a progression row: estimate + cycle, or checkpoint due. */
export function progressionStatus(lift: TrackedLift): string {
  if (checkpointDue(lift)) return 'Checkpoint due';
  const c = cycleOf(lift);
  const cycle = `Volume ${c.volume}/${SESSIONS_PER_GOAL} · Strength ${c.strength}/${SESSIONS_PER_GOAL}`;
  const est = currentEstimate(lift);
  if (!est || lift.load.kind !== 'weight') return cycle;
  return est.fromLog ? `Est. max ${roundLoad(est.value, lift.load.unit, lift.step)} ${lift.load.unit} · ${cycle}` : cycle;
}

/**
 * A finished workout's tracked exercises as one session entry per lift: only
 * completed sets, weights converted to the lift's unit, a lift that appears
 * twice merged into one session. Lifts with no completed sets are skipped.
 */
export function trackedSessionsFromWorkout(
  exercises: WorkoutExercise[],
  lifts: TrackedLift[],
): { liftId: string; goal: SessionGoal; sets: TrackedSetLog[] }[] {
  const byLift = new Map<string, { liftId: string; goal: SessionGoal; sets: TrackedSetLog[] }>();
  for (const ex of exercises) {
    if (!ex.tracked) continue;
    const lift = lifts.find((l) => l.id === ex.tracked!.liftId);
    if (!lift) continue;
    const liftUnit: WeightUnit =
      lift.load.kind === 'weight'
        ? lift.load.unit
        : lift.load.kind === 'bodyweight' && lift.load.plus
          ? lift.load.plus.unit
          : 'lb';
    const sets: TrackedSetLog[] = ex.sets
      .filter((s) => s.completed)
      .map((s) => {
        const log: TrackedSetLog = { reps: s.reps };
        if (s.weight) {
          const from: WeightUnit = s.unit === 'kg' ? 'kg' : 'lb';
          log.weight = Math.round(convertWeight(s.weight, from, liftUnit) * 10) / 10;
        }
        if (s.rir !== undefined) log.rir = s.rir;
        if (s.time) log.time = s.time;
        return log;
      });
    if (sets.length === 0) continue;
    const entry = byLift.get(lift.id);
    if (entry) entry.sets.push(...sets);
    else byLift.set(lift.id, { liftId: lift.id, goal: ex.tracked.goal, sets });
  }
  return [...byLift.values()];
}
