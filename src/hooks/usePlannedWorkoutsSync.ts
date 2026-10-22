import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { plannedWorkoutsHydrated, plansMerged } from '../store/slices/plannedWorkoutsSlice';
import { PlannedWorkoutsService } from '../services/plannedWorkoutsService';

export function usePlannedWorkoutsSync(): void {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.user.profile?.uid);
  const idKey = uid ?? 'anon';
  const { plans, status } = useAppSelector((s) => s.plannedWorkouts);
  const hydratedKey = useRef<string | null>(null);
  const [remoteSettledFor, setRemoteSettledFor] = useState<string | null>(!uid ? idKey : null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate whenever the identity changes (anon -> signed-in).
  useEffect(() => {
    hydratedKey.current = null;
    setRemoteSettledFor(!uid ? idKey : null);

    const local = PlannedWorkoutsService.loadLocal(idKey);
    dispatch(plannedWorkoutsHydrated(local ?? []));
    hydratedKey.current = idKey;

    // Background fetch remote for signed-in users
    if (uid) {
      void PlannedWorkoutsService.getRemote(uid).then((remote) => {
        if (hydratedKey.current === idKey) {
          if (remote !== null) {
            if (remote.length > 0) {
              dispatch(plansMerged(remote));
            }
            setRemoteSettledFor(idKey);
          }
        }
      });
    }
  }, [idKey, uid, dispatch]);

  // Persist (debounced) — only once this identity has hydrated and remote has settled.
  useEffect(() => {
    if (hydratedKey.current !== idKey || status !== 'ready') return;

    PlannedWorkoutsService.saveLocal(idKey, plans);

    // Don't push to remote until remote fetch for that identity has settled
    if (!uid || remoteSettledFor !== idKey) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void PlannedWorkoutsService.saveRemote(uid, plans);
    }, 300);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [plans, idKey, uid, status, remoteSettledFor]);
}
