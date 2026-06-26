import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DateKey } from '../../lib/dateKey';
import type {
  CharlieProgram,
  DayOverride,
  OneRepMax,
  PullupSeed,
  RetestState,
  ScheduleState,
} from '../../types/schedule';

const DEFAULT_RETEST: RetestState = {
  // Research rotation order — alternates axial/CNS load across the 7 main lifts.
  rotation: ['back-squat', 'db-bench', 'deadlift', 'pullup', 'bb-bench', 'front-squat', 'seal-row'],
  everyDays: 14,
  lastTestedAtKey: null,
  nextIndex: 0,
};

const initialState: ScheduleState = {
  program: null,
  oneRepMax: {},
  pullup: null,
  overrides: {},
  filledThroughKey: null,
  retest: DEFAULT_RETEST,
  status: 'idle',
  error: null,
  lastSyncedAt: null,
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    scheduleHydrated: (state, action: PayloadAction<Partial<ScheduleState>>) => {
      Object.assign(state, action.payload);
      state.status = 'ready';
    },

    templateActivated: (
      state,
      action: PayloadAction<{
        program: CharlieProgram;
        oneRepMax: Partial<ScheduleState['oneRepMax']>;
        pullup: PullupSeed | null;
      }>,
    ) => {
      state.program = action.payload.program;
      state.oneRepMax = action.payload.oneRepMax;
      state.pullup = action.payload.pullup;
      state.status = 'ready';
    },

    oneRepMaxSet: (state, action: PayloadAction<OneRepMax>) => {
      state.oneRepMax[action.payload.key] = action.payload;
    },

    pullupSet: (state, action: PayloadAction<PullupSeed>) => {
      state.pullup = action.payload;
    },

    monthFilled: (state, action: PayloadAction<{ filledThroughKey: DateKey }>) => {
      const next = action.payload.filledThroughKey;
      if (!state.filledThroughKey || next > state.filledThroughKey) {
        state.filledThroughKey = next;
      }
    },

    dayOverrideSet: (state, action: PayloadAction<DayOverride>) => {
      state.overrides[action.payload.dateKey] = action.payload;
    },

    dayCleared: (state, action: PayloadAction<DateKey>) => {
      delete state.overrides[action.payload];
    },

    retestAdvanced: (state, action: PayloadAction<{ testedAtKey: DateKey }>) => {
      state.retest.lastTestedAtKey = action.payload.testedAtKey;
      state.retest.nextIndex = (state.retest.nextIndex + 1) % state.retest.rotation.length;
    },

    setScheduleStatus: (state, action: PayloadAction<ScheduleState['status']>) => {
      state.status = action.payload;
    },

    setScheduleError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) state.status = 'error';
    },

    scheduleReset: () => ({ ...initialState }),
  },
});

export const {
  scheduleHydrated,
  templateActivated,
  oneRepMaxSet,
  pullupSet,
  monthFilled,
  dayOverrideSet,
  dayCleared,
  retestAdvanced,
  setScheduleStatus,
  setScheduleError,
  scheduleReset,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;
