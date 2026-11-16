import type { SessionGoal, TrainingGoal } from './trackedLifts';

export type ExerciseDifficulty = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Expert';
export type ExerciseForce = 'Push' | 'Pull' | 'Static';
export type ExerciseGrip = 'Overhand' | 'Underhand' | 'Neutral' | 'Hook' | 'Mixed';
export type ExerciseMechanic = 'Compound' | 'Isolation';

/** Per-exercise training emphasis flag; reuses `TrainingGoal` ('volume' | 'strength'). */
export type ExerciseEmphasis = TrainingGoal;

export function emphasisOfGoal(goal: SessionGoal | undefined): ExerciseEmphasis | undefined {
  return goal === 'volume' || goal === 'strength' ? goal : undefined;
}

/**
 * Reads an exercise's effective Volume/Strength emphasis. A `checkpoint` goal
 * never carries an emphasis; otherwise `emphasis` and `tracked.goal` agree.
 */
export function effectiveEmphasis(ex: {
  emphasis?: unknown;
  tracked?: { goal?: SessionGoal };
}): ExerciseEmphasis | undefined {
  if (ex.tracked?.goal === 'checkpoint') return undefined;
  if (ex.emphasis === 'volume' || ex.emphasis === 'strength') return ex.emphasis;
  return emphasisOfGoal(ex.tracked?.goal);
}

/**
 * Keeps `emphasis` and `tracked.goal` in sync on any exercise object:
 * - `checkpoint` goals drop `emphasis`
 * - setting `emphasis` updates `tracked.goal` when `tracked` is present
 * - a `tracked.goal` of `'volume' | 'strength'` populates `emphasis` when unset
 */
export function syncExerciseEmphasis<
  T extends {
    emphasis?: ExerciseEmphasis;
    tracked?: { liftId: string; goal: SessionGoal };
  },
>(ex: T): T {
  if (ex.tracked?.goal === 'checkpoint') {
    if (ex.emphasis === undefined) return ex;
    const { emphasis: _dropped, ...rest } = ex;
    return rest as T;
  }
  const emp = effectiveEmphasis(ex);
  const nextTracked =
    ex.tracked && emp && ex.tracked.goal !== emp ? { ...ex.tracked, goal: emp } : ex.tracked;
  if (ex.emphasis === emp && nextTracked === ex.tracked) return ex;
  const out = { ...ex } as T;
  if (emp) out.emphasis = emp;
  else delete out.emphasis;
  if (nextTracked) out.tracked = nextTracked;
  return out;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string; // Will contain comma-separated muscle groups
  muscleGroups: string[]; // Array of individual muscle groups
  equipment: string;
  videoLinks: string[];
  instructions: string[];
  difficulty: ExerciseDifficulty;
  force: ExerciseForce | null;
  grips: ExerciseGrip | null;
  mechanic: ExerciseMechanic | null;
  searchKeywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseRaw {
  'Muscle Group': string;
  'Exercise Name': string;
  'Equipment': string;
  'Video Links': string;
  'Difficulty': string;
  'Force': string;
  'Grips': string;
  'Mechanic': string;
  'Instructions': string;
}

export interface WorkoutSet {
  id: string;
  reps: number;
  repMin?: number; // prescribed range floor (double-progression start)
  repMax?: number; // prescribed range ceiling (advance load when beaten)
  weight?: number;
  unit?: 'lbs' | 'kg';
  time?: number;
  distance?: number;
  rpe?: number;
  rir?: number; // reps-in-reserve (0/1/2/3+), optional effort tap
  completed: boolean;
  failed?: boolean;
}

export interface WorkoutExercise {
  id: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
  customTitle?: string; // User's custom display name for exercise variation
  restTime?: number;
  // Superset support
  isSuperset?: boolean;
  supersetId?: string;
  supersetIndex?: number; // Index within the superset (0, 1, 2...)
  supersetExerciseIds?: string[]; // Only populated for the first exercise in superset
  /** Built from a tracked lift (Build page); finished sets count toward its cycle. */
  tracked?: { liftId: string; goal: 'volume' | 'strength' | 'checkpoint' };
  /** Per-exercise Volume / Strength training emphasis ('volume' | 'strength'). */
  emphasis?: ExerciseEmphasis;
}

export interface ActiveWorkout {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  startTime: string;
  duration: number;
  isActive: boolean;
  // Superset tracking
  currentSupersetIndex?: number; // Index within current superset (0, 1, 2...)
  isInSuperset?: boolean;
}

export interface Workout {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface RestTimer {
  isActive: boolean;
  timeRemaining: number;
  duration: number;
  /**
   * Absolute epoch-ms instant the running timer should fire completion.
   * Set when the timer starts/resumes; `null` when stopped or paused. The
   * displayed `timeRemaining` is derived from this against `Date.now()` so the
   * timer stays correct after the tab is backgrounded (no setInterval drift).
   */
  targetEndTime: number | null;
}

export interface ExerciseFilter {
  muscleGroup?: string;
  equipment?: string;
  difficulty?: string;
  search?: string;
}