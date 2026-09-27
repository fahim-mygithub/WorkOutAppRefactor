/**
 * Tracked lifts — the user's running list of lifts to watch, grouped by
 * user-defined categories (Build page). Local-first: hydrated and persisted by
 * useTrackedLiftsSync; `status` stays 'idle' until hydration so the sync hook
 * never writes the empty initial state over saved data.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  SessionGoal,
  TrackedLift,
  TrackedLiftsData,
  TrackedSetLog,
  TrainingGoal,
} from '../../types/trackedLifts';
import { newTrackedLiftId, seedTrackedLifts } from '../../lib/trackedLifts';
import { recordSession } from '../../lib/trackedLiftProgression';

/** One tracked lift's completed sets from a finished workout. */
export interface TrackedSessionEntry {
  liftId: string;
  goal: SessionGoal;
  sets: TrackedSetLog[];
}

export interface TrackedLiftsState extends TrackedLiftsData {
  status: 'idle' | 'ready';
}

const initialState: TrackedLiftsState = {
  status: 'idle',
  categories: [],
  lifts: [],
  pendingBests: [],
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
      state.lastGoal = data.lastGoal;
      state.pendingBests = data.pendingBests ?? [];
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
    /** Merges, so an editor save keeps the progression flag, cycle and log. */
    liftUpdated(state, action: PayloadAction<Partial<TrackedLift> & { id: string }>) {
      const i = state.lifts.findIndex((l) => l.id === action.payload.id);
      if (i === -1) return;
      if (action.payload.category) ensureCategory(state, action.payload.category);
      state.lifts[i] = { ...state.lifts[i], ...action.payload };
    },
    liftRemoved(state, action: PayloadAction<string>) {
      state.lifts = state.lifts.filter((l) => l.id !== action.payload);
      state.pendingBests = (state.pendingBests ?? []).filter((b) => b.liftId !== action.payload);
    },
    progressionToggled(state, action: PayloadAction<string>) {
      const lift = state.lifts.find((l) => l.id === action.payload);
      if (lift) lift.progression = !lift.progression;
    },
    goalChosen(state, action: PayloadAction<TrainingGoal>) {
      state.lastGoal = action.payload;
    },
    /**
     * A finished workout: log each tracked lift's session, move its cycle, and
     * queue any new best for Update / Keep (one pending best per lift).
     */
    sessionsRecorded(state, action: PayloadAction<{ date: string; entries: TrackedSessionEntry[] }>) {
      const { date, entries } = action.payload;
      for (const entry of entries) {
        const i = state.lifts.findIndex((l) => l.id === entry.liftId);
        if (i === -1) continue;
        const { lift, best } = recordSession(state.lifts[i], { date, goal: entry.goal, sets: entry.sets });
        state.lifts[i] = lift;
        if (best && lift.progression) {
          state.pendingBests = [
            ...(state.pendingBests ?? []).filter((b) => b.liftId !== best.liftId),
            best,
          ];
        }
      }
    },
    bestResolved(state, action: PayloadAction<{ liftId: string; accept: boolean }>) {
      const { liftId, accept } = action.payload;
      const best = (state.pendingBests ?? []).find((b) => b.liftId === liftId);
      state.pendingBests = (state.pendingBests ?? []).filter((b) => b.liftId !== liftId);
      if (!best || !accept) return;
      const lift = state.lifts.find((l) => l.id === liftId);
      if (lift) {
        lift.load = best.load;
        lift.target = best.target;
      }
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
  progressionToggled,
  goalChosen,
  sessionsRecorded,
  bestResolved,
  categoryAdded,
  categoryRenamed,
  categoryRemoved,
} = trackedLiftsSlice.actions;

export default trackedLiftsSlice.reducer;
