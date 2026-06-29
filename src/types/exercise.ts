export type ExerciseDifficulty = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Expert';
export type ExerciseForce = 'Push' | 'Pull' | 'Static';
export type ExerciseGrip = 'Overhand' | 'Underhand' | 'Neutral' | 'Hook' | 'Mixed';
export type ExerciseMechanic = 'Compound' | 'Isolation';

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