/**
 * Local log of which muscles each finished workout hit, for the Home body map's
 * heat (see lib/muscleHeat). Written on Save and end so the map updates at once
 * and works offline and in the demo build; the Home hook merges it with synced
 * exercise history for signed-in users.
 */
import type { ActiveWorkout } from '../types/exercise';
import { musclesForExercise, type MuscleLogEntry } from '../lib/muscleHeat';

const storageKey = (idKey: string): string => `woapp:v1:muscleLog:${idKey}`;
/** Only the last couple of weeks matter for a 2-day cool-down. */
const KEEP_DAYS = 14;

export class MuscleLogService {
  static load(idKey: string): MuscleLogEntry[] {
    try {
      const raw = localStorage.getItem(storageKey(idKey));
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /** One entry per exercise with at least one completed set. */
  static entriesForWorkout(workout: ActiveWorkout, finishedAt: Date = new Date()): MuscleLogEntry[] {
    return workout.exercises
      .filter((ex) => ex.sets.some((s) => s.completed))
      .map((ex) => ({
        date: finishedAt.toISOString(),
        workoutId: workout.id,
        terms: musclesForExercise(ex.exercise),
      }))
      .filter((e) => e.terms.length > 0);
  }

  static recordWorkout(idKey: string, workout: ActiveWorkout, finishedAt: Date = new Date()): void {
    try {
      const cutoff = finishedAt.getTime() - KEEP_DAYS * 86_400_000;
      const kept = this.load(idKey).filter((e) => new Date(e.date).getTime() >= cutoff);
      const next = [...kept, ...this.entriesForWorkout(workout, finishedAt)];
      localStorage.setItem(storageKey(idKey), JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(MUSCLE_LOG_EVENT));
    } catch {
      /* quota / unavailable: non-fatal */
    }
  }
}

/** Fired after a workout is recorded, so a mounted map can refresh. */
export const MUSCLE_LOG_EVENT = 'woapp:muscle-log';
