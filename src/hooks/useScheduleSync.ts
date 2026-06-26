/**
 * SINGLE-INSTANCE hydration + local-first persistence for the schedule slice.
 * Mount once in the app shell. Keeping this out of usePlannedSchedule (which has
 * many consumers per page) prevents racing debounced saves from clobbering good
 * data, and the `hydratedKey` guard ensures we never persist the transient
 * empty/initial state over a saved blob before it's loaded.
 */
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { ScheduleService } from '../services/scheduleService';
import { scheduleHydrated } from '../store/slices/scheduleSlice';

export function useScheduleSync(): void {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.user.profile?.uid);
  const idKey = uid ?? 'anon';
  const schedule = useAppSelector((s) => s.schedule);
  const hydratedKey = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate whenever the identity changes (e.g. anon → signed-in / demo user).
  useEffect(() => {
    hydratedKey.current = null; // suspend persistence until loaded for this key
    const local = ScheduleService.loadLocal(idKey);
    if (local) {
      dispatch(
        scheduleHydrated({
          program: local.program,
          oneRepMax: local.oneRepMax,
          pullup: local.pullup,
          overrides: local.overrides,
          filledThroughKey: local.filledThroughKey,
          retest: local.retest,
        }),
      );
    } else {
      dispatch(scheduleHydrated({}));
    }
    hydratedKey.current = idKey;
  }, [idKey, dispatch]);

  // Persist (debounced) — only once this identity has hydrated.
  useEffect(() => {
    if (hydratedKey.current !== idKey) return;
    if (schedule.status !== 'ready') return;
    const persisted = {
      program: schedule.program,
      oneRepMax: schedule.oneRepMax,
      pullup: schedule.pullup,
      overrides: schedule.overrides,
      filledThroughKey: schedule.filledThroughKey,
      retest: schedule.retest,
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      ScheduleService.saveLocal(idKey, persisted);
      void ScheduleService.saveRemote(uid, persisted);
    }, 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [schedule, idKey, uid]);
}
