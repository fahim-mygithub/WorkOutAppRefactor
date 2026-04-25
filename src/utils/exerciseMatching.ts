/**
 * Utilities for normalizing and matching exercise names and configurations
 */

// Common variations and their normalized forms
const EXERCISE_NAME_VARIATIONS: Record<string, string> = {
  'benchpress': 'bench press',
  'bench-press': 'bench press',
  'benchpresses': 'bench press',
  'deadlift': 'deadlift',
  'dead-lift': 'deadlift',
  'deadlifts': 'deadlift',
  'pullup': 'pull up',
  'pull-up': 'pull up',
  'pullups': 'pull up',
  'pushup': 'push up',
  'push-up': 'push up',
  'pushups': 'push up',
  'squat': 'squat',
  'squats': 'squat',
  'bicep curl': 'bicep curl',
  'bicep curls': 'bicep curl',
  'biceptcurl': 'bicep curl',
  'tricep extension': 'tricep extension',
  'tricep extensions': 'tricep extension',
  'shoulder press': 'shoulder press',
  'shoulderpress': 'shoulder press',
  'overhead press': 'overhead press',
  'overheadpress': 'overhead press',
  'lat pulldown': 'lat pulldown',
  'latpulldown': 'lat pulldown',
  'lat pull down': 'lat pulldown',
  'barbell row': 'barbell row',
  'barbellrow': 'barbell row',
  'barbell rows': 'barbell row',
  'dumbbell row': 'dumbbell row',
  'dumbbellrow': 'dumbbell row',
  'dumbbell rows': 'dumbbell row',
  'leg curl': 'leg curl',
  'legcurl': 'leg curl',
  'leg curls': 'leg curl',
  'leg extension': 'leg extension',
  'legextension': 'leg extension',
  'leg extensions': 'leg extension',
  'calf raise': 'calf raise',
  'calfraise': 'calf raise',
  'calf raises': 'calf raise',
};

/**
 * Normalize an exercise name for consistent matching
 * @param exerciseName - The exercise name to normalize
 * @returns Normalized exercise name
 */
export function normalizeExerciseName(exerciseName: string): string {
  if (!exerciseName) return '';

  // Convert to lowercase and trim
  let normalized = exerciseName.toLowerCase().trim();

  // Remove extra spaces and replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ');

  // Remove common prefixes/suffixes that don't affect exercise identity
  normalized = normalized.replace(/^(barbell|dumbbell|cable|machine)\s+/i, '');
  normalized = normalized.replace(/\s+(barbell|dumbbell|cable|machine)$/i, '');

  // Apply known variations mapping
  if (EXERCISE_NAME_VARIATIONS[normalized]) {
    normalized = EXERCISE_NAME_VARIATIONS[normalized];
  }

  return normalized;
}

/**
 * Extract set configuration from workout text or exercise description
 * @param text - Text that may contain set configuration (e.g., "5x5", "4x8-10")
 * @returns Configuration string or null if not found
 */
export function extractConfiguration(text: string): string | null {
  if (!text) return null;

  // Pattern to match configurations like "5x5", "4x8-10", "3x12", "2x6-8"
  const configPattern = /(\d+)\s*x\s*(\d+)(?:-(\d+))?/i;
  const match = text.match(configPattern);

  if (match) {
    const sets = match[1];
    const minReps = match[2];
    const maxReps = match[3];

    if (maxReps) {
      return `${sets}x${minReps}-${maxReps}`;
    } else {
      return `${sets}x${minReps}`;
    }
  }

  return null;
}

/**
 * Check if two exercise names refer to the same exercise
 * @param name1 - First exercise name
 * @param name2 - Second exercise name
 * @returns True if they match, false otherwise
 */
export function exerciseNamesMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const normalized1 = normalizeExerciseName(name1);
  const normalized2 = normalizeExerciseName(name2);

  return normalized1 === normalized2;
}

/**
 * Check if two configurations are the same
 * @param config1 - First configuration
 * @param config2 - Second configuration
 * @returns True if they match, false otherwise
 */
export function configurationsMatch(config1: string, config2: string): boolean {
  if (!config1 || !config2) return false;

  // Normalize configurations by removing spaces
  const norm1 = config1.replace(/\s+/g, '').toLowerCase();
  const norm2 = config2.replace(/\s+/g, '').toLowerCase();

  return norm1 === norm2;
}

/**
 * Generate a configuration string from an array of sets
 * @param sets - Array of workout sets
 * @returns Configuration string (e.g., "5x5", "4x8-10")
 */
export function generateConfiguration(sets: { reps: number }[]): string {
  if (!sets || sets.length === 0) return '';

  // Group sets by rep count
  const repGroups = sets.reduce((groups, set) => {
    const reps = set.reps;
    if (!groups[reps]) groups[reps] = 0;
    groups[reps]++;
    return groups;
  }, {} as Record<number, number>);

  const repValues = Object.keys(repGroups).map(Number).sort((a, b) => a - b);

  // If all sets have the same rep count
  if (repValues.length === 1) {
    return `${sets.length}x${repValues[0]}`;
  }

  // If there's a range
  if (repValues.length === 2) {
    const minReps = repValues[0];
    const maxReps = repValues[1];
    return `${sets.length}x${minReps}-${maxReps}`;
  }

  // For complex configurations, use the most common rep count
  const mostCommonReps = repValues.reduce((a, b) =>
    repGroups[a] > repGroups[b] ? a : b
  );

  return `${sets.length}x${mostCommonReps}`;
}

/**
 * Parse a workout name to extract exercise name and configuration
 * @param workoutName - Full workout name (e.g., "5x5 Bench Press", "Bench Press 4x8")
 * @returns Object with exercise name and configuration
 */
export function parseWorkoutName(workoutName: string): { exerciseName: string; configuration: string | null } {
  if (!workoutName) return { exerciseName: '', configuration: null };

  const configuration = extractConfiguration(workoutName);

  // Remove the configuration from the workout name to get the exercise name
  let exerciseName = workoutName;
  if (configuration) {
    // Remove the configuration pattern from the workout name
    exerciseName = workoutName.replace(/\d+\s*x\s*\d+(?:-\d+)?/i, '').trim();
  }

  return {
    exerciseName: normalizeExerciseName(exerciseName),
    configuration
  };
}

/**
 * Check if a workout matches another workout based on exercise name and configuration
 * @param workout1 - First workout name
 * @param workout2 - Second workout name
 * @returns Object indicating if they match and on what criteria
 */
export function workoutsMatch(
  workout1: string,
  workout2: string
): { exactMatch: boolean; exerciseMatch: boolean; configMatch: boolean } {
  const parsed1 = parseWorkoutName(workout1);
  const parsed2 = parseWorkoutName(workout2);

  const exerciseMatch = exerciseNamesMatch(parsed1.exerciseName, parsed2.exerciseName);
  const configMatch = parsed1.configuration && parsed2.configuration
    ? configurationsMatch(parsed1.configuration, parsed2.configuration)
    : false;

  return {
    exactMatch: exerciseMatch && configMatch,
    exerciseMatch,
    configMatch
  };
}

/**
 * Find the best matching workouts from a list based on exercise name and configuration
 * @param targetWorkout - The workout to match against
 * @param workoutList - List of workouts to search through
 * @returns Sorted array of matches (best matches first)
 */
export function findMatchingWorkouts(
  targetWorkout: string,
  workoutList: { name: string; [key: string]: any }[]
): Array<{ workout: any; matchType: 'exact' | 'exercise' | 'partial' }> {
  const matches: Array<{ workout: any; matchType: 'exact' | 'exercise' | 'partial' }> = [];

  for (const workout of workoutList) {
    const matchResult = workoutsMatch(targetWorkout, workout.name);

    if (matchResult.exactMatch) {
      matches.push({ workout, matchType: 'exact' });
    } else if (matchResult.exerciseMatch) {
      matches.push({ workout, matchType: 'exercise' });
    } else if (workout.name.toLowerCase().includes(targetWorkout.toLowerCase()) ||
               targetWorkout.toLowerCase().includes(workout.name.toLowerCase())) {
      matches.push({ workout, matchType: 'partial' });
    }
  }

  // Sort by match quality: exact > exercise > partial
  return matches.sort((a, b) => {
    const order = { exact: 0, exercise: 1, partial: 2 };
    return order[a.matchType] - order[b.matchType];
  });
}