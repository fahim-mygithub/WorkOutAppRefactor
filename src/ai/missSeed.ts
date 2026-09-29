// The first message the player's "Ask coach" chip sends after a set: what was
// just logged against what was planned. Pure, so the wording is testable
// without rendering the player.
import { formatRepRange } from '@/lib/progression/setPrescription';

export interface LoggedSetLike {
  reps: number;
  weight?: number;
  unit?: string;
}

export interface PlannedSetLike {
  reps: number;
  repMin?: number;
  repMax?: number;
}

export function buildMissSeed(
  exerciseName: string,
  lastSet: LoggedSetLike | undefined,
  plannedSet: PlannedSetLike | undefined,
): string {
  if (!lastSet) return `I can't do ${exerciseName} today. What should I do instead?`;
  const load = lastSet.weight && lastSet.weight > 0
    ? ` at ${lastSet.weight}${lastSet.unit ? ` ${lastSet.unit}` : ''}`
    : '';
  const planned: PlannedSetLike = plannedSet ?? { reps: lastSet.reps };
  const target = formatRepRange(planned) ?? String(planned.repMin ?? planned.reps);
  return `I just did ${lastSet.reps} reps${load} on ${exerciseName}; the target was ${target}. What should I do for the rest?`;
}
