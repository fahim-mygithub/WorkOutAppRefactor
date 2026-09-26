/**
 * Small formatting helpers shared by the Profile / History surfaces.
 */

/**
 * ExerciseHistory.workoutDate is typed `Date`, but ExerciseHistoryService
 * serialises Firestore Timestamps to ISO strings before they reach the UI.
 * Normalise either shape to an ISO string.
 */
export function toIsoString(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : String(date);
}

/** "Sep 24, 2026" — invalid or missing dates fall back to a dash. */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

/** "Sep 24, 9:05 AM" */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** 95 → "1h 35m", 40 → "40m" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
