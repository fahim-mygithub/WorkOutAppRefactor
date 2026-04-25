import type { EquipmentType, ProgressionIncrements, DeloadFactors, BodyweightProgression, BandColor } from '../types/progression';

// Default increment rules for each equipment type
export const equipmentIncrements: Record<EquipmentType, ProgressionIncrements> = {
  barbell: {
    strength: { aggressive: 10, standard: 5, conservative: 2.5 },
    hypertrophy: { aggressive: 5, standard: 2.5, conservative: 2.5 }
  },
  dumbbell: {
    strength: { aggressive: 10, standard: 5, conservative: 5 },
    hypertrophy: { aggressive: 5, standard: 5, conservative: 2.5 }
  },
  machine: {
    strength: { aggressive: 20, standard: 10, conservative: 10 },
    hypertrophy: { aggressive: 10, standard: 10, conservative: 5 }
  },
  cable: {
    strength: { aggressive: 10, standard: 5, conservative: 5 },
    hypertrophy: { aggressive: 5, standard: 5, conservative: 2.5 }
  },
  plate: {
    strength: { aggressive: 10, standard: 5, conservative: 2.5 },
    hypertrophy: { aggressive: 5, standard: 2.5, conservative: 2.5 }
  },
  kettlebell: {
    strength: { aggressive: 10, standard: 5, conservative: 5 },
    hypertrophy: { aggressive: 5, standard: 5, conservative: 5 }
  },
  'smith-machine': {
    strength: { aggressive: 10, standard: 5, conservative: 5 },
    hypertrophy: { aggressive: 5, standard: 5, conservative: 2.5 }
  },
  bodyweight: {
    strength: { aggressive: 2, standard: 1, conservative: 1 }, // reps
    hypertrophy: { aggressive: 3, standard: 2, conservative: 1 } // reps
  },
  band: {
    strength: { aggressive: 1, standard: 1, conservative: 0 }, // band color progression
    hypertrophy: { aggressive: 1, standard: 1, conservative: 0 }
  },
  trx: {
    strength: { aggressive: 2, standard: 1, conservative: 1 }, // reps or angle adjustment
    hypertrophy: { aggressive: 3, standard: 2, conservative: 1 }
  }
};

// Default deload factors
export const defaultDeloadFactors: DeloadFactors = {
  twoWeekGap: 0.85,     // 15% reduction
  threeWeekGap: 0.80,   // 20% reduction
  monthPlusGap: 0.70,   // 30% reduction
  fatiguedToday: 0.85   // 15% reduction
};

// Bodyweight exercise progressions
export const bodyweightProgressions: Record<string, BodyweightProgression> = {
  'Pull Ups': {
    regressions: [
      'Lat Pulldown',
      'Band Assisted (Black)',
      'Band Assisted (Green)',
      'Band Assisted (Blue)',
      'Band Assisted (Red)',
      'Band Assisted (Yellow)',
      'Negative Pull Ups'
    ],
    standard: 'Pull Ups',
    progressions: [
      'Wide Grip Pull Ups',
      'L-Sit Pull Ups',
      'Weighted +10lbs',
      'Weighted +25lbs',
      'Weighted +45lbs'
    ],
    bandColors: ['yellow', 'red', 'blue', 'green', 'black'] as BandColor[]
  },
  'Chin Ups': {
    regressions: [
      'Band Assisted (Black)',
      'Band Assisted (Green)',
      'Band Assisted (Blue)',
      'Band Assisted (Red)',
      'Negative Chin Ups'
    ],
    standard: 'Chin Ups',
    progressions: [
      'L-Sit Chin Ups',
      'Weighted +10lbs',
      'Weighted +25lbs',
      'Weighted +45lbs'
    ],
    bandColors: ['yellow', 'red', 'blue', 'green', 'black'] as BandColor[]
  },
  'Push Ups': {
    regressions: [
      'Wall Push Ups',
      'Incline Push Ups',
      'Knee Push Ups'
    ],
    standard: 'Push Ups',
    progressions: [
      'Diamond Push Ups',
      'Decline Push Ups',
      'Archer Push Ups',
      'Weighted Push Ups +10lbs',
      'Weighted Push Ups +25lbs'
    ]
  },
  'Dips': {
    regressions: [
      'Bench Dips',
      'Band Assisted Dips (Black)',
      'Band Assisted Dips (Green)',
      'Band Assisted Dips (Blue)'
    ],
    standard: 'Dips',
    progressions: [
      'L-Sit Dips',
      'Weighted Dips +10lbs',
      'Weighted Dips +25lbs',
      'Weighted Dips +45lbs'
    ],
    bandColors: ['blue', 'green', 'black'] as BandColor[]
  },
  'Pistol Squats': {
    regressions: [
      'Assisted Pistol Squats',
      'Box Pistol Squats',
      'Negative Pistol Squats'
    ],
    standard: 'Pistol Squats',
    progressions: [
      'Weighted Pistol Squats +10lbs',
      'Weighted Pistol Squats +25lbs'
    ]
  },
  'Muscle Ups': {
    regressions: [
      'High Pull Ups',
      'Chest to Bar Pull Ups',
      'Assisted Muscle Ups',
      'Negative Muscle Ups'
    ],
    standard: 'Muscle Ups',
    progressions: [
      'Strict Muscle Ups',
      'L-Sit Muscle Ups',
      'Weighted Muscle Ups'
    ]
  }
};

// Time-based exercise increments (in seconds)
export const timeBasedIncrements = {
  aggressive: 10,    // +10 seconds
  standard: 5,       // +5 seconds
  conservative: 3    // +3 seconds
};

// Band color progression (from most assistance to least)
export const bandColorProgression: BandColor[] = ['black', 'green', 'blue', 'red', 'yellow'];

// Get next band color (less assistance)
export const getNextBandColor = (currentColor: BandColor): BandColor | null => {
  const currentIndex = bandColorProgression.indexOf(currentColor);
  if (currentIndex === -1 || currentIndex === bandColorProgression.length - 1) {
    return null; // No band or already at lightest band
  }
  return bandColorProgression[currentIndex + 1];
};

// Get previous band color (more assistance)
export const getPreviousBandColor = (currentColor: BandColor): BandColor | null => {
  const currentIndex = bandColorProgression.indexOf(currentColor);
  if (currentIndex <= 0) {
    return null; // Already at heaviest band or not found
  }
  return bandColorProgression[currentIndex - 1];
};

// Map equipment names from CSV to our equipment types
export const equipmentMapping: Record<string, EquipmentType> = {
  'Barbell': 'barbell',
  'Dumbbells': 'dumbbell',
  'Machine': 'machine',
  'Cables': 'cable',
  'Cable': 'cable',
  'Bodyweight': 'bodyweight',
  'Band': 'band',
  'Plate': 'plate',
  'Kettlebells': 'kettlebell',
  'Kettlebell': 'kettlebell',
  'Smith-Machine': 'smith-machine',
  'TRX': 'trx',
  'Stretches': 'bodyweight',
  'Recovery': 'bodyweight',
  'Cardio': 'bodyweight'
};

// Exercise types that use time-based progression
export const timeBasedExercises = [
  'Plank',
  'Side Plank',
  'Wall Sit',
  'Dead Hang',
  'L-Sit',
  'Hollow Body Hold',
  'Superman Hold',
  'Glute Bridge Hold',
  'Isometric Squat'
];

// Helper function to determine if exercise is time-based
export const isTimeBasedExercise = (exerciseName: string): boolean => {
  return timeBasedExercises.some(name =>
    exerciseName.toLowerCase().includes(name.toLowerCase())
  );
};

// Helper function to determine equipment type from exercise data
export const getEquipmentType = (equipment: string): EquipmentType => {
  return equipmentMapping[equipment] || 'bodyweight';
};