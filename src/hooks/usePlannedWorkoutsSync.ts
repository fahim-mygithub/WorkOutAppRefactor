import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { plannedWorkoutsHydrated } from '../store/slices/plannedWorkoutsSlice';
import { PlannedWorkoutsService } from '../services/plannedWorkoutsService';

export function usePlannedWorkoutsSync(): void {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.user.profile?.uid);
  const idKey = uid ?? 'anon';
  const { plans, status } = useAppSelector((s) => s.plannedWorkouts);
  const hydratedKey = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate whenever the identity changes (anon -> signed-in).
  useEffect(() => {
    hydratedKey.current = null;
    const local = PlannedWorkoutsService.loadLocal(idKey);
    dispatch(plannedWorkoutsHydrated(local ?? []));
    hydratedKey.current = idKey;

    // Background fetch remote for signed-in users
    if (uid) {
      void PlannedWorkoutsService.getRemote(uid).then((remote) => {
        if (remote && hydratedKey.current === idKey) {
          // If remote has data and we loaded empty or older local, reconcile
          dispatch(plannedWorkoutsHydrated(remote));
          PlannedWorkoutsService.saveLocal(idKey, remote);
        }
      });
    }
  }, [idKey, uid, dispatch]);

  // Persist (debounced) — only once this identity has hydrated.
  useEffect(() => {
    if (hydratedKey.current !== idKey || status !== 'ready') return;

    PlannedWorkoutsService.saveLocal(idKey, plans);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void PlannedWorkoutsService.saveRemote(uid, plans);
    }, 300);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [plans, idKey, uid, status]);
}
