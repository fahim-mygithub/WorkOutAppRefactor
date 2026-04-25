export type ExperienceLevel = 'aggressive' | 'standard' | 'conservative';
export type ProgressionAction = 'increase' | 'maintain' | 'decrease' | 'deload';
export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'band' | 'plate' | 'kettlebell' | 'smith-machine' | 'trx';
export type ProgressionType = 'weight' | 'time' | 'reps' | 'band-color' | 'bodyweight-variation';
export type BandColor = 'yellow' | 'red' | 'blue' | 'green' | 'black'; // light to heavy

export interface ProgressionIncrements {
  strength: {
    aggressive: number;
    standard: number;
    conservative: number;
  };
  hypertrophy: {
    aggressive: number;
    standard: number;
    conservative: number;
  };
}

export interface BodyweightProgression {
  regressions: string[];
  standard: string;
  progressions: string[];
  bandColors?: BandColor[];
}

export interface DeloadFactors {
  twoWeekGap: number;
  threeWeekGap: number;
  monthPlusGap: number;
  fatiguedToday: number;
}

export interface ProgressionConfig {
  exerciseId: string;
  equipmentType: EquipmentType;
  progressionType: ProgressionType;
  increments: ProgressionIncrements;
  bodyweightProgression?: BodyweightProgression;
  deloadFactors: DeloadFactors;
  timeIncrement?: number; // For time-based exercises (seconds)
}

export interface ProgressionRecommendation {
  action: ProgressionAction;
  recommendedWeight?: number;
  recommendedReps?: number;
  recommendedTime?: number; // For time-based exercises
  recommendedVariation?: string; // For bodyweight exercises
  recommendedBand?: BandColor; // For band-assisted exercises
  previousWeight?: number;
  previousReps?: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  deloadApplied: boolean;
  daysSinceLastWorkout?: number;
  alternatives?: AlternativeProgression[];
}

export interface AlternativeProgression {
  type: 'tempo' | 'pause' | 'partial' | 'variation' | 'band' | 'deload';
  description: string;
  recommendation: string;
}

export interface ProgressionTracking {
  recommendedWeight?: number;
  recommendedReps?: number;
  recommendedTime?: number;
  actualWeight?: number;
  actualReps?: number;
  actualTime?: number;
  progressionFollowed: boolean;
  experienceLevel: ExperienceLevel;
  outcomeRating: 'exceeded' | 'met' | 'failed';
  failureReason?: 'fatigue' | 'form' | 'weight-too-heavy' | 'other';
  deloadApplied: boolean;
  userNotes?: string;
}

export interface PerformanceAnalysis {
  success: boolean;
  repCompletion: number; // percentage of target reps completed
  shouldIncrease: boolean;
  shouldMaintain: boolean;
  shouldDecrease: boolean;
  isDroppingReps: boolean;
  averageRPE?: number;
  failurePattern?: 'early' | 'late' | 'consistent';
}

export interface ExerciseProgressionProfile {
  exerciseId: string;
  exerciseName: string;
  equipmentType: EquipmentType;
  progressionType: ProgressionType;
  stabilityRequirement: 'low' | 'medium' | 'high';
  technicalDifficulty: 1 | 2 | 3 | 4 | 5;
  injuryRisk: 1 | 2 | 3 | 4 | 5;
  customIncrements?: ProgressionIncrements;
  notes?: string;
}