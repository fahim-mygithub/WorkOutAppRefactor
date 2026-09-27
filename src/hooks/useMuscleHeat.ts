/**
 * Current body-map heat: the local muscle log (this device, instant) merged
 * with synced exercise history (signed-in users, other devices), de-duplicated
 * by workout. Recomputed on mount, when a workout is recorded, and when the app
 * comes back into view (so it cools overnight without a reload).
 */
import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { MuscleLogService, MUSCLE_LOG_EVENT } from '../services/muscleLogService';
import { muscleHeat, musclesForExercise, type HeatLevel, type MuscleLogEntry } from '../lib/muscleHeat';

export function useMuscleHeat(): Record<string, HeatLevel> {
  const uid = useAppSelector((s) => s.user.profile?.uid);
  const idKey = uid ?? 'anon';
  const [local, setLocal] = useState<MuscleLogEntry[]>(() => MuscleLogService.load(idKey));
  const [synced, setSynced] = useState<MuscleLogEntry[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      setLocal(MuscleLogService.load(idKey));
      setNow(new Date());
    };
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener(MUSCLE_LOG_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(MUSCLE_LOG_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [idKey]);

  // Synced history (returns [] for the demo user / on failure).
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // Newest first; older rows are ignored by muscleHeat anyway.
    ExerciseHistoryService.getExerciseHistory(uid, { limit: 100 })
      .then((rows) => {
        if (cancelled) return;
        setSynced(
          rows.map((r) => ({
            date: new Date(r.workoutDate).toISOString(),
            workoutId: r.workoutId,
            terms: musclesForExercise({ muscleGroups: r.muscleGroups }),
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return useMemo(() => {
    const localIds = new Set(local.map((e) => e.workoutId).filter(Boolean));
    const merged = [...local, ...synced.filter((e) => !e.workoutId || !localIds.has(e.workoutId))];
    return muscleHeat(merged, now);
  }, [local, synced, now]);
}
