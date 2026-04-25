export interface PerformedSet {
  setNumber: number;
  targetReps: number;
  actualReps: number;
  weight: number;
  unit: 'lbs' | 'kg';
  completed: boolean;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  notes?: string;
}

import type { ProgressionTracking } from './progression';

export interface ExerciseHistory {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  customTitle?: string; // User's custom display name for exercise variation
  workoutId?: string;
  workoutName?: string;
  workoutDate: Date;
  sets: PerformedSet[];
  configuration: string; // "5x5", "4x8-10", "3x12", etc.
  muscleGroups: string[];
  equipment: string;
  totalVolume: number; // weight × reps × sets
  personalRecords?: {
    maxWeight?: boolean;
    maxReps?: boolean;
    maxVolume?: boolean;
  };
  progressionData?: ProgressionTracking; // Track progression recommendation data
  daysSinceLastWorkout?: number;
  notes?: string;
}

export interface ExerciseStats {
  exerciseId: string;
  exerciseName: string;
  totalSessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  lastPerformed: Date;
  firstPerformed: Date;
  maxWeight: number;
  maxReps: number;
  avgWeight: number;
  avgReps: number;
  frequency: number; // sessions per week
  personalRecords: {
    maxWeight: { weight: number; date: Date; reps: number };
    maxReps: { reps: number; date: Date; weight: number };
    maxVolume: { volume: number; date: Date; sets: number };
  };
}

export interface WorkoutSummary {
  id: string;
  userId: string;
  name: string;
  workoutId?: string; // Original workout ID to link with exercise history
  templateId?: string; // Link to saved workout template
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  exercisesSummary: {
    exerciseId: string;
    exerciseName: string;
    sets: number;
    reps: number;
    volume: number;
  }[];
  notes?: string;
}

export interface ExerciseHistoryFilter {
  exerciseId?: string;
  exerciseName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  configuration?: string;
  limit?: number;
}

export interface ProgressMetrics {
  exerciseId: string;
  exerciseName: string;
  volumeProgression: {
    date: Date;
    volume: number;
  }[];
  strengthProgression: {
    date: Date;
    maxWeight: number;
  }[];
  frequencyTrend: {
    week: string; // YYYY-WW format
    sessions: number;
  }[];
}