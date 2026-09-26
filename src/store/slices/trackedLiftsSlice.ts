/**
 * Tracked lifts — the user's running list of lifts to watch, grouped by
 * user-defined categories (Build page). Local-first: hydrated and persisted by
 * useTrackedLiftsSync; `status` stays 'idle' until hydration so the sync hook
 * never writes the empty initial state over saved data.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TrackedLift, TrackedLiftsData } from '../../types/trackedLifts';
import { newTrackedLiftId, seedTrackedLifts } from '../../lib/trackedLifts';

export interface TrackedLiftsState extends TrackedLiftsData {
  status: 'idle' | 'ready';
}

const initialState: TrackedLiftsState = {
  status: 'idle',
  categories: [],
  lifts: [],
};

function findCategory(categories: string[], name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return categories.find((c) => c.toLowerCase() === key);
}

function ensureCategory(state: TrackedLiftsState, name: string): void {
  const trimmed = name.trim();
  if (trimmed && !findCategory(state.categories, trimmed)) state.categories.push(trimmed);
}

const trackedLiftsSlice = createSlice({
  name: 'trackedLifts',
  initialState,
  reducers: {
    /** `null` = nothing saved for this identity → start from the template. */
    trackedLiftsHydrated(state, action: PayloadAction<TrackedLiftsData | null>) {
      const data = action.payload ?? seedTrackedLifts();
      state.categories = data.categories;
      state.lifts = data.lifts;
      state.status = 'ready';
    },
    liftAdded: {
      reducer(state, action: PayloadAction<TrackedLift>) {
        ensureCategory(state, action.payload.category);
        state.lifts.push(action.payload);
      },
      prepare(lift: Omit<TrackedLift, 'id'>) {
        return { payload: { ...lift, id: newTrackedLiftId() } };
      },
    },
    liftUpdated(state, action: PayloadAction<TrackedLift>) {
      const i = state.lifts.findIndex((l) => l.id === action.payload.id);
      if (i === -1) return;
      ensureCategory(state, action.payload.category);
      state.lifts[i] = action.payload;
    },
    liftRemoved(state, action: PayloadAction<string>) {
      state.lifts = state.lifts.filter((l) => l.id !== action.payload);
    },
    categoryAdded(state, action: PayloadAction<string>) {
      ensureCategory(state, action.payload);
    },
    categoryRenamed(state, action: PayloadAction<{ from: string; to: string }>) {
      const { from } = action.payload;
      const to = action.payload.to.trim();
      if (!to || from === to) return;
      const existing = findCategory(state.categories, to);
      if (existing && existing !== from) {
        // Merge into the existing category.
        state.categories = state.categories.filter((c) => c !== from);
        for (const l of state.lifts) if (l.category === from) l.category = existing;
        return;
      }
      state.categories = state.categories.map((c) => (c === from ? to : c));
      for (const l of state.lifts) if (l.category === from) l.category = to;
    },
    /** Lifts in a removed category are kept (grouping appends them). */
    categoryRemoved(state, action: PayloadAction<string>) {
      state.categories = state.categories.filter((c) => c !== action.payload);
    },
  },
});

export const {
  trackedLiftsHydrated,
  liftAdded,
  liftUpdated,
  liftRemoved,
  categoryAdded,
  categoryRenamed,
  categoryRemoved,
} = trackedLiftsSlice.actions;

export default trackedLiftsSlice.reducer;
