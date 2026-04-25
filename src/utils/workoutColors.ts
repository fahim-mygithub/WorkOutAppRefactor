// Utility for consistent color assignment to workouts
// Uses a hash function to ensure same workout names get same colors

export const WORKOUT_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-lime-500',
  'bg-rose-500',
  'bg-fuchsia-500'
];

export const WORKOUT_TEXT_COLORS = [
  'text-red-500',
  'text-blue-500',
  'text-green-500',
  'text-yellow-500',
  'text-purple-500',
  'text-pink-500',
  'text-indigo-500',
  'text-teal-500',
  'text-orange-500',
  'text-cyan-500',
  'text-emerald-500',
  'text-amber-500',
  'text-violet-500',
  'text-lime-500',
  'text-rose-500',
  'text-fuchsia-500'
];

// Simple hash function to convert string to number
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Get consistent color for workout name
export function getWorkoutColor(workoutName: string): string {
  const hash = hashString(workoutName.toLowerCase());
  const colorIndex = hash % WORKOUT_COLORS.length;
  return WORKOUT_COLORS[colorIndex];
}

// Get consistent text color for workout name
export function getWorkoutTextColor(workoutName: string): string {
  const hash = hashString(workoutName.toLowerCase());
  const colorIndex = hash % WORKOUT_TEXT_COLORS.length;
  return WORKOUT_TEXT_COLORS[colorIndex];
}

// Get first letter of workout name for badge
export function getWorkoutInitial(workoutName: string): string {
  return workoutName.trim().charAt(0).toUpperCase() || 'W';
}

// Get multiple workout initials for days with multiple workouts
export function getMultiWorkoutInitials(workoutNames: string[]): string[] {
  return workoutNames.map(name => getWorkoutInitial(name));
}

// Get workout intensity level based on volume/duration
export function getWorkoutIntensity(
  totalVolume: number,
  duration: number,
  totalSets: number
): 'low' | 'medium' | 'high' {
  // Calculate intensity score based on volume per minute and sets per minute
  const volumePerMin = totalVolume / Math.max(duration, 1);
  const setsPerMin = totalSets / Math.max(duration, 1);

  const intensityScore = (volumePerMin / 100) + (setsPerMin * 10);

  if (intensityScore >= 15) return 'high';
  if (intensityScore >= 8) return 'medium';
  return 'low';
}

// Get border style based on intensity
export function getIntensityBorderStyle(intensity: 'low' | 'medium' | 'high'): string {
  switch (intensity) {
    case 'high': return 'border-4';
    case 'medium': return 'border-2';
    case 'low': return 'border';
    default: return 'border';
  }
}