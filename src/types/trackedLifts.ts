/**
 * Tracked lifts — a running, user-curated list of the lifts someone wants to
 * keep an eye on (Build page), grouped under user-defined categories.
 *
 * Load and target are discriminated unions on purpose: progress isn't always
 * "more plates". A lift can progress by weight, by added load on bodyweight,
 * by a named step on a non-linear ladder (medicine balls, bands, machine
 * levels), or by time under tension instead of reps.
 */

export type WeightUnit = 'lb' | 'kg';

export type TrackedLoad =
  | { kind: 'weight'; value: number; unit: WeightUnit }
  | { kind: 'bodyweight'; plus?: { value: number; unit: WeightUnit } }
  /** Free-text progression step, e.g. "Med ball 6 kg", "Band: red", "Level 3". */
  | { kind: 'level'; label: string };

export type TrackedTarget =
  /** A rep count (`max` omitted) or a rep range (`min`–`max`). */
  | { kind: 'reps'; min: number; max?: number }
  /** An N-rep max, e.g. reps: 1 → a 1-rep max. */
  | { kind: 'repMax'; reps: number }
  /** Time under tension, optionally with a tempo such as "3-1-3". */
  | { kind: 'time'; seconds: number; tempo?: string }
  | { kind: 'none' };

/** How a progression lift is trained in one session. */
export type TrainingGoal = 'volume' | 'strength';
export type SessionGoal = TrainingGoal | 'checkpoint';

/** One logged set, as recorded against a tracked lift. */
export interface TrackedSetLog {
  reps: number;
  /** In the lift's own unit (converted when logged in the other one). */
  weight?: number;
  rir?: number;
  /** Seconds, for timed holds. */
  time?: number;
}

/** A finished session of a tracked lift (the lift's own log). */
export interface TrackedSession {
  /** ISO date-time the workout was saved. */
  date: string;
  goal: SessionGoal;
  sets: TrackedSetLog[];
}

export interface TrackedLift {
  id: string;
  name: string;
  /** Must match one of `TrackedLiftsData.categories` (unknowns still render). */
  category: string;
  load: TrackedLoad;
  target: TrackedTarget;
  /** Accessory set count (default 3). */
  sets?: number;
  /** Marked for progression: Volume/Strength prescriptions + checkpoint days. */
  progression?: boolean;
  /** Volume/Strength sessions since the last checkpoint. */
  cycle?: { volume: number; strength: number };
  /** Most recent finished sessions, oldest first (capped). */
  sessions?: TrackedSession[];
  /** Smallest load change the equipment allows (default 5 lb / 2.5 kg). */
  step?: number;
  /** Equipment kind, for display and AI context. */
  equipment?: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'band' | 'other';
}

/** A logged result that beat a benchmark, waiting for Update / Keep. */
export interface PendingBest {
  liftId: string;
  load: TrackedLoad;
  target: TrackedTarget;
}

export interface TrackedLiftsData {
  /** User-defined, ordered category names. */
  categories: string[];
  lifts: TrackedLift[];
  /** The Volume/Strength choice used last on the Build page. */
  lastGoal?: TrainingGoal;
  pendingBests?: PendingBest[];
}
