/**
 * Strength markers state: per-exercise stated-max overrides (which beat formula
 * and AI estimates) and cached Claude-reviewed adjustments, persisted per user
 * identity in localStorage (mirroring ScheduleService / chatPersistence).
 */
import { createSlice, type PayloadAction, type Store } from '@reduxjs/toolkit';
import type { AiMarkerReview, StatedMaxOverride } from '../../lib/strengthMarkers';
import { getSafeLocalStorage, type StorageLike } from '../../lib/workoutSession';

export const STRENGTH_MARKERS_STORAGE_PREFIX = 'woapp:v1:strengthMarkers:';
const SCHEMA_VERSION = 1;

export const strengthMarkersStorageKey = (idKey: string): string =>
  `${STRENGTH_MARKERS_STORAGE_PREFIX}${idKey}`;

export interface StrengthMarkersState {
  uid: string | null;
  statedMaxes: Record<string, StatedMaxOverride>;
  aiReviews: Record<string, AiMarkerReview>;
  lastReviewedAt: string | null;
}

const initialState: StrengthMarkersState = {
  uid: null,
  statedMaxes: {},
  aiReviews: {},
  lastReviewedAt: null,
};

const strengthMarkersSlice = createSlice({
  name: 'strengthMarkers',
  initialState,
  reducers: {
    strengthMarkersRestored(
      state,
      action: PayloadAction<{
        uid: string | null;
        statedMaxes?: Record<string, StatedMaxOverride>;
        aiReviews?: Record<string, AiMarkerReview>;
        lastReviewedAt?: string | null;
      }>,
    ) {
      state.uid = action.payload.uid;
      state.statedMaxes = action.payload.statedMaxes ?? {};
      state.aiReviews = action.payload.aiReviews ?? {};
      state.lastReviewedAt = action.payload.lastReviewedAt ?? null;
    },

    statedMaxSet(
      state,
      action: PayloadAction<{
        exerciseKey: string;
        exerciseName: string;
        weight: number;
        unit: 'lbs' | 'kg';
        updatedAt?: string;
      }>,
    ) {
      const { exerciseKey, exerciseName, weight, unit, updatedAt } = action.payload;
      if (!exerciseKey.trim() || !Number.isFinite(weight) || weight <= 0) return;
      state.statedMaxes[exerciseKey] = {
        exerciseKey,
        exerciseName,
        weight: Math.round(weight * 100) / 100,
        unit,
        updatedAt: updatedAt ?? new Date().toISOString(),
      };
    },

    statedMaxCleared(state, action: PayloadAction<string>) {
      delete state.statedMaxes[action.payload];
    },

    aiReviewsApplied(
      state,
      action: PayloadAction<{
        reviews: Record<string, AiMarkerReview>;
        reviewedAt: string;
      }>,
    ) {
      state.aiReviews = { ...state.aiReviews, ...action.payload.reviews };
      state.lastReviewedAt = action.payload.reviewedAt;
    },

    aiReviewsCleared(state) {
      state.aiReviews = {};
      state.lastReviewedAt = null;
    },
  },
});

export const {
  strengthMarkersRestored,
  statedMaxSet,
  statedMaxCleared,
  aiReviewsApplied,
  aiReviewsCleared,
} = strengthMarkersSlice.actions;

export const selectStatedMaxes = (state: { strengthMarkers: StrengthMarkersState }) =>
  state.strengthMarkers.statedMaxes;

export const selectAiReviews = (state: { strengthMarkers: StrengthMarkersState }) =>
  state.strengthMarkers.aiReviews;

export default strengthMarkersSlice.reducer;

// --- Local persistence (mirrors chatPersistence.ts) ---------------------------

interface PersistedMarkers {
  schemaVersion: number;
  statedMaxes: Record<string, StatedMaxOverride>;
  aiReviews: Record<string, AiMarkerReview>;
  lastReviewedAt: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function parseStatedMax(key: string, v: unknown): StatedMaxOverride | null {
  if (!isObj(v)) return null;
  if (typeof v.exerciseName !== 'string' || typeof v.weight !== 'number') return null;
  if (!Number.isFinite(v.weight) || v.weight <= 0) return null;
  const unit = v.unit === 'kg' ? 'kg' : 'lbs';
  const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : '';
  return {
    exerciseKey: typeof v.exerciseKey === 'string' && v.exerciseKey ? v.exerciseKey : key,
    exerciseName: v.exerciseName,
    weight: v.weight,
    unit,
    updatedAt,
  };
}

function parseAiReview(key: string, v: unknown): AiMarkerReview | null {
  if (!isObj(v)) return null;
  if (typeof v.e1RM !== 'number' || !Number.isFinite(v.e1RM) || v.e1RM <= 0) return null;
  if (typeof v.formulaE1RM !== 'number' || !Number.isFinite(v.formulaE1RM)) return null;
  return {
    exerciseKey: typeof v.exerciseKey === 'string' && v.exerciseKey ? v.exerciseKey : key,
    e1RM: v.e1RM,
    note: typeof v.note === 'string' ? v.note : '',
    reviewedAt: typeof v.reviewedAt === 'string' ? v.reviewedAt : '',
    formulaE1RM: v.formulaE1RM,
  };
}

export function loadStrengthMarkers(
  idKey: string,
  storage: StorageLike | null = getSafeLocalStorage(),
): Omit<StrengthMarkersState, 'uid'> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(strengthMarkersStorageKey(idKey));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!isObj(data) || data.schemaVersion !== SCHEMA_VERSION) return null;

    const statedMaxes: Record<string, StatedMaxOverride> = {};
    if (isObj(data.statedMaxes)) {
      for (const [key, val] of Object.entries(data.statedMaxes)) {
        const parsed = parseStatedMax(key, val);
        if (parsed) statedMaxes[key] = parsed;
      }
    }

    const aiReviews: Record<string, AiMarkerReview> = {};
    if (isObj(data.aiReviews)) {
      for (const [key, val] of Object.entries(data.aiReviews)) {
        const parsed = parseAiReview(key, val);
        if (parsed) aiReviews[key] = parsed;
      }
    }

    return {
      statedMaxes,
      aiReviews,
      lastReviewedAt: typeof data.lastReviewedAt === 'string' ? data.lastReviewedAt : null,
    };
  } catch {
    return null;
  }
}

export function saveStrengthMarkers(
  idKey: string,
  state: Pick<StrengthMarkersState, 'statedMaxes' | 'aiReviews' | 'lastReviewedAt'>,
  storage: StorageLike | null = getSafeLocalStorage(),
): void {
  if (!storage) return;
  try {
    const key = strengthMarkersStorageKey(idKey);
    const hasData =
      Object.keys(state.statedMaxes).length > 0 || Object.keys(state.aiReviews).length > 0;
    if (!hasData) {
      storage.removeItem(key);
      return;
    }
    const payload: PersistedMarkers = {
      schemaVersion: SCHEMA_VERSION,
      statedMaxes: state.statedMaxes,
      aiReviews: state.aiReviews,
      lastReviewedAt: state.lastReviewedAt,
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota or unavailable storage — non-fatal.
  }
}

interface PersistStoreState {
  user: { profile?: { uid?: string } | null };
  strengthMarkers: StrengthMarkersState;
}

/**
 * Hydrate strengthMarkers whenever the signed-in uid changes (falling back to
 * 'anon' when signed out) and persist changes for that identity. Never throws.
 */
export function initStrengthMarkersPersistence(
  store: Pick<Store<PersistStoreState>, 'getState' | 'dispatch' | 'subscribe'>,
  storage: StorageLike | null = getSafeLocalStorage(),
): () => void {
  try {
    let activeKey: string | undefined;
    let saved: StrengthMarkersState | undefined;

    const sync = () => {
      const state = store.getState();
      const uid = state.user.profile?.uid ?? null;
      const idKey = uid ?? 'anon';
      if (idKey !== activeKey) {
        activeKey = idKey;
        const stored = loadStrengthMarkers(idKey, storage);
        store.dispatch(
          strengthMarkersRestored({
            uid,
            ...(stored ?? {}),
          }),
        );
        saved = store.getState().strengthMarkers;
        return;
      }
      const current = state.strengthMarkers;
      if (current === saved) return;
      saved = current;
      if (current.uid === uid) {
        saveStrengthMarkers(idKey, current, storage);
      }
    };

    sync();
    return store.subscribe(sync);
  } catch {
    return () => {};
  }
}
