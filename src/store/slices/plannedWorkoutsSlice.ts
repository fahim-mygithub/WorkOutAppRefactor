import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DateKey } from '../../lib/dateKey';
import type { WorkoutExercise } from '../../types/exercise';

export type PlanStatus = 'planned' | 'done' | 'skipped';

export interface PlannedWorkout {
  id: string;
  dateKey: DateKey;
  name: string;
  exercises: WorkoutExercise[];
  source?: { historyId?: string };
  status: PlanStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface PlannedWorkoutsState {
  status: 'idle' | 'ready';
  plans: PlannedWorkout[];
}

const initialState: PlannedWorkoutsState = {
  status: 'idle',
  plans: [],
};

function generatePlanId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const plannedWorkoutsSlice = createSlice({
  name: 'plannedWorkouts',
  initialState,
  reducers: {
    plannedWorkoutsHydrated(state, action: PayloadAction<PlannedWorkout[] | null>) {
      state.plans = Array.isArray(action.payload) ? action.payload : [];
      state.status = 'ready';
    },

    plansMerged(state, action: PayloadAction<PlannedWorkout[]>) {
      const incoming = action.payload;
      if (!Array.isArray(incoming) || incoming.length === 0) {
        state.status = 'ready';
        return;
      }
      const existingMap = new Map<string, PlannedWorkout>(state.plans.map((p) => [p.id, p]));
      for (const item of incoming) {
        const existing = existingMap.get(item.id);
        if (!existing) {
          existingMap.set(item.id, item);
        } else {
          const existingTime = existing.updatedAt || existing.createdAt || '';
          const itemTime = item.updatedAt || item.createdAt || '';
          if (itemTime > existingTime) {
            existingMap.set(item.id, item);
          } else if (existing.status === 'planned' && item.status !== 'planned') {
            existingMap.set(item.id, { ...existing, status: item.status });
          }
        }
      }
      state.plans = Array.from(existingMap.values());
      state.status = 'ready';
    },

    planAdded: {
      reducer(state, action: PayloadAction<PlannedWorkout>) {
        state.plans.push(action.payload);
      },
      prepare(
        plan: Omit<PlannedWorkout, 'id' | 'createdAt' | 'status'> & {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
          status?: PlanStatus;
        },
      ) {
        const now = new Date().toISOString();
        return {
          payload: {
            ...plan,
            id: plan.id ?? generatePlanId(),
            status: plan.status ?? 'planned',
            createdAt: plan.createdAt ?? now,
            updatedAt: plan.updatedAt ?? plan.createdAt ?? now,
          },
        };
      },
    },

    planMoved(state, action: PayloadAction<{ id: string; dateKey: DateKey }>) {
      const plan = state.plans.find((p) => p.id === action.payload.id);
      if (plan) {
        plan.dateKey = action.payload.dateKey;
        plan.updatedAt = new Date().toISOString();
      }
    },

    planRemoved(state, action: PayloadAction<string>) {
      state.plans = state.plans.filter((p) => p.id !== action.payload);
    },

    planMarkedDone(state, action: PayloadAction<string | { id: string }>) {
      const id = typeof action.payload === 'string' ? action.payload : action.payload.id;
      const plan = state.plans.find((p) => p.id === id);
      if (plan) {
        plan.status = 'done';
        plan.updatedAt = new Date().toISOString();
      }
    },

    planSkipped(state, action: PayloadAction<string | { id: string }>) {
      const id = typeof action.payload === 'string' ? action.payload : action.payload.id;
      const plan = state.plans.find((p) => p.id === id);
      if (plan) {
        plan.status = 'skipped';
        plan.updatedAt = new Date().toISOString();
      }
    },

    plannedWorkoutsReset() {
      return { ...initialState };
    },
  },
});

export const {
  plannedWorkoutsHydrated,
  plansMerged,
  planAdded,
  planMoved,
  planRemoved,
  planMarkedDone,
  planSkipped,
  plannedWorkoutsReset,
} = plannedWorkoutsSlice.actions;

export default plannedWorkoutsSlice.reducer;

// --- Selectors ---

interface RootStateSlice {
  plannedWorkouts?: PlannedWorkoutsState;
}

export function selectPlannedWorkouts(state: RootStateSlice): PlannedWorkout[] {
  return state.plannedWorkouts?.plans ?? [];
}

export function selectPlansByDateKey(state: RootStateSlice, dateKey: DateKey): PlannedWorkout[] {
  return selectPlannedWorkouts(state).filter((p) => p.dateKey === dateKey);
}

export function selectPlansForToday(state: RootStateSlice, todayKey: DateKey): PlannedWorkout[] {
  return selectPlansForTodayInternal(state, todayKey);
}

function selectPlansForTodayInternal(state: RootStateSlice, todayKey: DateKey): PlannedWorkout[] {
  return selectPlannedWorkouts(state).filter(
    (p) => p.dateKey === todayKey && p.status === 'planned',
  );
}

export function selectOverduePlans(state: RootStateSlice, todayKey: DateKey): PlannedWorkout[] {
  return selectPlannedWorkouts(state)
    .filter((p) => p.dateKey < todayKey && p.status === 'planned')
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function selectUpcomingPlans(
  state: RootStateSlice,
  todayKey: DateKey,
  limit = 3,
): PlannedWorkout[] {
  return selectPlannedWorkouts(state)
    .filter((p) => p.dateKey > todayKey && p.status === 'planned')
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(0, limit);
}

export function selectHasPlanDueToday(state: RootStateSlice, todayKey: DateKey): boolean {
  return selectPlansForTodayInternal(state, todayKey).length > 0;
}
