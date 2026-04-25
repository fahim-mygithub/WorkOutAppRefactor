import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { ExerciseHistory, ExerciseStats, WorkoutSummary, ExerciseHistoryFilter } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';

export interface ExerciseHistoryState {
  // Current workout context
  currentExerciseHistory: Record<string, ExerciseHistory[]>; // exerciseId -> history
  previousPerformances: Record<string, ExerciseHistory | null>; // exerciseId -> last performance
  exerciseStats: Record<string, ExerciseStats>; // exerciseId -> stats

  // User history
  workoutHistory: WorkoutSummary[];
  recentHistory: ExerciseHistory[];

  // Loading states
  isLoadingHistory: boolean;
  isLoadingStats: boolean;
  isLoadingPrevious: boolean;
  isSavingPerformance: boolean;

  // Error handling
  error: string | null;
}

const initialState: ExerciseHistoryState = {
  currentExerciseHistory: {},
  previousPerformances: {},
  exerciseStats: {},
  workoutHistory: [],
  recentHistory: [],
  isLoadingHistory: false,
  isLoadingStats: false,
  isLoadingPrevious: false,
  isSavingPerformance: false,
  error: null,
};

// Async thunks for Firebase operations

// Load exercise history for a specific exercise
export const loadExerciseHistory = createAsyncThunk(
  'exerciseHistory/loadExerciseHistory',
  async ({ userId, filter }: { userId: string; filter: ExerciseHistoryFilter }) => {
    const history = await ExerciseHistoryService.getExerciseHistory(userId, filter);
    return { exerciseId: filter.exerciseId!, history };
  }
);

// Load previous performance for comparison
export const loadPreviousPerformance = createAsyncThunk(
  'exerciseHistory/loadPreviousPerformance',
  async ({
    userId,
    exerciseId,
    configuration
  }: {
    userId: string;
    exerciseId: string;
    configuration?: string;
  }) => {
    const performance = await ExerciseHistoryService.getLastPerformance(userId, exerciseId, configuration);
    return { exerciseId, performance };
  }
);

// Load exercise statistics
export const loadExerciseStats = createAsyncThunk(
  'exerciseHistory/loadExerciseStats',
  async ({ userId, exerciseId }: { userId: string; exerciseId: string }) => {
    const stats = await ExerciseHistoryService.getExerciseStats(userId, exerciseId);
    return { exerciseId, stats };
  }
);

// Load workout history
export const loadWorkoutHistory = createAsyncThunk(
  'exerciseHistory/loadWorkoutHistory',
  async ({ userId, limit = 20 }: { userId: string; limit?: number }) => {
    return await ExerciseHistoryService.getWorkoutHistory(userId, limit);
  }
);

// Save exercise performance
export const saveExercisePerformance = createAsyncThunk(
  'exerciseHistory/saveExercisePerformance',
  async ({
    userId,
    exerciseData
  }: {
    userId: string;
    exerciseData: Parameters<typeof ExerciseHistoryService.saveExercisePerformance>[1];
  }) => {
    const historyId = await ExerciseHistoryService.saveExercisePerformance(userId, exerciseData);
    return { historyId, exerciseData };
  }
);

// Load multiple exercises' previous performances for workout context
export const loadWorkoutContext = createAsyncThunk(
  'exerciseHistory/loadWorkoutContext',
  async ({
    userId,
    exerciseIds
  }: {
    userId: string;
    exerciseIds: string[];
  }) => {
    const promises = exerciseIds.map(async (exerciseId) => {
      const performance = await ExerciseHistoryService.getLastPerformance(userId, exerciseId);
      const stats = await ExerciseHistoryService.getExerciseStats(userId, exerciseId);
      return { exerciseId, performance, stats };
    });

    const results = await Promise.all(promises);
    return results;
  }
);

const exerciseHistorySlice = createSlice({
  name: 'exerciseHistory',
  initialState,
  reducers: {
    // Clear current workout context
    clearWorkoutContext: (state) => {
      state.currentExerciseHistory = {};
      state.previousPerformances = {};
      state.exerciseStats = {};
    },

    // Clear errors
    clearError: (state) => {
      state.error = null;
    },

    // Add a new exercise history entry locally (for immediate UI update)
    addLocalHistory: (state, action: PayloadAction<{ exerciseId: string; history: ExerciseHistory }>) => {
      const { exerciseId, history } = action.payload;
      if (!state.currentExerciseHistory[exerciseId]) {
        state.currentExerciseHistory[exerciseId] = [];
      }
      state.currentExerciseHistory[exerciseId].unshift(history);
      state.recentHistory.unshift(history);
    },

    // Update previous performance for immediate comparison
    updatePreviousPerformance: (state, action: PayloadAction<{ exerciseId: string; performance: ExerciseHistory }>) => {
      const { exerciseId, performance } = action.payload;
      state.previousPerformances[exerciseId] = performance;
    },

    // Reset loading states
    resetLoadingStates: (state) => {
      state.isLoadingHistory = false;
      state.isLoadingStats = false;
      state.isLoadingPrevious = false;
      state.isSavingPerformance = false;
    },
  },

  extraReducers: (builder) => {
    // Load exercise history
    builder
      .addCase(loadExerciseHistory.pending, (state) => {
        state.isLoadingHistory = true;
        state.error = null;
      })
      .addCase(loadExerciseHistory.fulfilled, (state, action) => {
        state.isLoadingHistory = false;
        const { exerciseId, history } = action.payload;
        state.currentExerciseHistory[exerciseId] = history;
      })
      .addCase(loadExerciseHistory.rejected, (state, action) => {
        state.isLoadingHistory = false;
        state.error = action.error.message || 'Failed to load exercise history';
      });

    // Load previous performance
    builder
      .addCase(loadPreviousPerformance.pending, (state) => {
        state.isLoadingPrevious = true;
      })
      .addCase(loadPreviousPerformance.fulfilled, (state, action) => {
        state.isLoadingPrevious = false;
        const { exerciseId, performance } = action.payload;
        state.previousPerformances[exerciseId] = performance;
      })
      .addCase(loadPreviousPerformance.rejected, (state, action) => {
        state.isLoadingPrevious = false;
        state.error = action.error.message || 'Failed to load previous performance';
      });

    // Load exercise stats
    builder
      .addCase(loadExerciseStats.pending, (state) => {
        state.isLoadingStats = true;
      })
      .addCase(loadExerciseStats.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        const { exerciseId, stats } = action.payload;
        if (stats) {
          state.exerciseStats[exerciseId] = stats;
        }
      })
      .addCase(loadExerciseStats.rejected, (state, action) => {
        state.isLoadingStats = false;
        state.error = action.error.message || 'Failed to load exercise stats';
      });

    // Load workout history
    builder
      .addCase(loadWorkoutHistory.pending, (state) => {
        state.isLoadingHistory = true;
      })
      .addCase(loadWorkoutHistory.fulfilled, (state, action) => {
        state.isLoadingHistory = false;
        state.workoutHistory = action.payload;
      })
      .addCase(loadWorkoutHistory.rejected, (state, action) => {
        state.isLoadingHistory = false;
        state.error = action.error.message || 'Failed to load workout history';
      });

    // Save exercise performance
    builder
      .addCase(saveExercisePerformance.pending, (state) => {
        state.isSavingPerformance = true;
        state.error = null;
      })
      .addCase(saveExercisePerformance.fulfilled, (state, action) => {
        state.isSavingPerformance = false;
        // The actual history will be loaded separately if needed
        console.log('✅ Exercise performance saved:', action.payload.historyId);
      })
      .addCase(saveExercisePerformance.rejected, (state, action) => {
        state.isSavingPerformance = false;
        state.error = action.error.message || 'Failed to save exercise performance';
      });

    // Load workout context
    builder
      .addCase(loadWorkoutContext.pending, (state) => {
        state.isLoadingPrevious = true;
        state.isLoadingStats = true;
      })
      .addCase(loadWorkoutContext.fulfilled, (state, action) => {
        state.isLoadingPrevious = false;
        state.isLoadingStats = false;

        action.payload.forEach(({ exerciseId, performance, stats }) => {
          state.previousPerformances[exerciseId] = performance;
          if (stats) {
            state.exerciseStats[exerciseId] = stats;
          }
        });
      })
      .addCase(loadWorkoutContext.rejected, (state, action) => {
        state.isLoadingPrevious = false;
        state.isLoadingStats = false;
        state.error = action.error.message || 'Failed to load workout context';
      });
  },
});

export const {
  clearWorkoutContext,
  clearError,
  addLocalHistory,
  updatePreviousPerformance,
  resetLoadingStates,
} = exerciseHistorySlice.actions;

export default exerciseHistorySlice.reducer;