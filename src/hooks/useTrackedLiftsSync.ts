/**
 * Hydration + local-first persistence for the trackedLifts slice. Mount once
 * (TrackedLifts is its only consumer). Same guard as useScheduleSync: nothing
 * is written until this identity has hydrated, so the empty initial state can
 * never overwrite a saved list.
 */
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { trackedLiftsHydrated } from '../store/slices/trackedLiftsSlice';
import { TrackedLiftsService } from '../services/trackedLiftsService';

export function useTrackedLiftsSync(): void {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.user.profile?.uid);
  const idKey = uid ?? 'anon';
  const state = useAppSelector((s) => s.trackedLifts);
  const hydratedKey = useRef<string | null>(null);
  // The state object rendered BEFORE a hydrate dispatch belongs to the previous
  // identity; the persist effect in the same flush must not save it under the
  // new key. The hydrate action always yields a new object, so an identity
  // check is enough.
  const latestState = useRef(state);
  latestState.current = state;
  const staleState = useRef<typeof state | null>(null);

  // Hydrate whenever the identity changes (anon → signed-in / demo user).
  useEffect(() => {
    staleState.current = latestState.current;
    dispatch(trackedLiftsHydrated(TrackedLiftsService.loadLocal(idKey)));
    hydratedKey.current = idKey;
  }, [idKey, dispatch]);

  // Persist — only once this identity has hydrated.
  useEffect(() => {
    if (hydratedKey.current !== idKey || state.status !== 'ready') return;
    if (state === staleState.current) return;
    TrackedLiftsService.saveLocal(idKey, { categories: state.categories, lifts: state.lifts });
  }, [state, idKey]);
}
