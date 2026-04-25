import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { SharedWorkout, SharedWorkoutService, CreateSharedWorkoutData, SharedWorkoutStats } from '../../services/sharedWorkoutService';

export interface SharedWorkoutState {
  currentSharedWorkout: SharedWorkout | null;
  userSharedWorkouts: SharedWorkout[];
  stats: Record<string, SharedWorkoutStats>; // shareId -> stats
  isLoadingShared: boolean;
  isLoadingUserWorkouts: boolean;
  isCreating: boolean;
  shareError: string | null;
  generalError: string | null;
  isAnonymousSession: boolean;
  lastCreatedShareId: string | null;
}

const initialState: SharedWorkoutState = {
  currentSharedWorkout: null,
  userSharedWorkouts: [],
  stats: {},
  isLoadingShared: false,
  isLoadingUserWorkouts: false,
  isCreating: false,
  shareError: null,
  generalError: null,
  isAnonymousSession: false,
  lastCreatedShareId: null,
};

// Async thunks for API calls
export const createSharedWorkout = createAsyncThunk(
  'sharedWorkout/create',
  async ({
    creatorId,
    creatorName,
    workoutData
  }: {
    creatorId: string;
    creatorName: string;
    workoutData: CreateSharedWorkoutData;
  }) => {
    const shareId = await SharedWorkoutService.createSharedWorkout(creatorId, creatorName, workoutData);
    return { shareId, workoutData };
  }
);

export const loadSharedWorkout = createAsyncThunk(
  'sharedWorkout/load',
  async (shareId: string) => {
    console.log('🔄 SharedWorkout Slice: Loading shared workout:', shareId);

    try {
      const workout = await SharedWorkoutService.getSharedWorkoutByShareId(shareId);
      if (!workout) {
        console.error('❌ SharedWorkout Slice: Workout not found for shareId:', shareId);
        throw new Error('Workout not found or has expired');
      }

      console.log('✅ SharedWorkout Slice: Successfully loaded workout:', {
        shareId,
        workoutName: workout.workoutData.name,
        creatorName: workout.creatorName,
        hasWorkoutText: !!workout.workoutData.workoutText,
        exerciseCount: workout.workoutData.exercises.length
      });

      return workout;
    } catch (error) {
      console.error('💥 SharedWorkout Slice: Failed to load workout:', {
        shareId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      });
      throw error;
    }
  }
);

export const loadUserSharedWorkouts = createAsyncThunk(
  'sharedWorkout/loadUserWorkouts',
  async (userId: string) => {
    const workouts = await SharedWorkoutService.getUserSharedWorkouts(userId);
    return workouts;
  }
);

export const incrementWorkoutUseCount = createAsyncThunk(
  'sharedWorkout/incrementUse',
  async (shareId: string) => {
    await SharedWorkoutService.incrementUseCount(shareId);
    return shareId;
  }
);

export const deleteSharedWorkout = createAsyncThunk(
  'sharedWorkout/delete',
  async ({ shareId, userId }: { shareId: string; userId: string }) => {
    await SharedWorkoutService.deleteSharedWorkout(shareId, userId);
    return shareId;
  }
);

export const loadSharedWorkoutStats = createAsyncThunk(
  'sharedWorkout/loadStats',
  async (shareId: string) => {
    const stats = await SharedWorkoutService.getSharedWorkoutStats(shareId);
    return { shareId, stats };
  }
);

const sharedWorkoutSlice = createSlice({
  name: 'sharedWorkout',
  initialState,
  reducers: {
    clearCurrentSharedWorkout: (state) => {
      state.currentSharedWorkout = null;
      state.shareError = null;
      state.isAnonymousSession = false;
    },

    setAnonymousSession: (state, action: PayloadAction<boolean>) => {
      state.isAnonymousSession = action.payload;
    },

    clearShareError: (state) => {
      state.shareError = null;
    },

    clearGeneralError: (state) => {
      state.generalError = null;
    },

    clearLastCreatedShareId: (state) => {
      state.lastCreatedShareId = null;
    },

    setCurrentSharedWorkout: (state, action: PayloadAction<SharedWorkout | null>) => {
      state.currentSharedWorkout = action.payload;
      if (!action.payload) {
        state.isAnonymousSession = false;
      }
    },

    clearUserSharedWorkouts: (state) => {
      state.userSharedWorkouts = [];
      state.stats = {};
    },

    // Reset all state when user logs out
    resetSharedWorkoutState: (state) => {
      Object.assign(state, initialState);
    }
  },
  extraReducers: (builder) => {
    builder
      // Create shared workout
      .addCase(createSharedWorkout.pending, (state) => {
        state.isCreating = true;
        state.shareError = null;
      })
      .addCase(createSharedWorkout.fulfilled, (state, action) => {
        state.isCreating = false;
        state.lastCreatedShareId = action.payload.shareId;
        state.shareError = null;
      })
      .addCase(createSharedWorkout.rejected, (state, action) => {
        state.isCreating = false;
        state.shareError = action.error.message || 'Failed to create shared workout';
      })

      // Load shared workout
      .addCase(loadSharedWorkout.pending, (state) => {
        state.isLoadingShared = true;
        state.shareError = null;
        state.currentSharedWorkout = null;
      })
      .addCase(loadSharedWorkout.fulfilled, (state, action) => {
        state.isLoadingShared = false;
        state.currentSharedWorkout = action.payload;
        state.shareError = null;
        // If there's no authenticated user, this is an anonymous session
        state.isAnonymousSession = true; // This will be overridden by auth state check in component
      })
      .addCase(loadSharedWorkout.rejected, (state, action) => {
        state.isLoadingShared = false;
        state.currentSharedWorkout = null;
        state.shareError = action.error.message || 'Failed to load shared workout';
      })

      // Load user shared workouts
      .addCase(loadUserSharedWorkouts.pending, (state) => {
        state.isLoadingUserWorkouts = true;
        state.generalError = null;
      })
      .addCase(loadUserSharedWorkouts.fulfilled, (state, action) => {
        state.isLoadingUserWorkouts = false;
        state.userSharedWorkouts = action.payload;
        state.generalError = null;
      })
      .addCase(loadUserSharedWorkouts.rejected, (state, action) => {
        state.isLoadingUserWorkouts = false;
        state.generalError = action.error.message || 'Failed to load your shared workouts';
      })

      // Increment use count
      .addCase(incrementWorkoutUseCount.fulfilled, (state, action) => {
        // Update use count in current workout if it matches
        if (state.currentSharedWorkout?.shareId === action.payload) {
          state.currentSharedWorkout.metadata.useCount += 1;
        }

        // Update use count in user workouts list
        const userWorkout = state.userSharedWorkouts.find(w => w.shareId === action.payload);
        if (userWorkout) {
          userWorkout.metadata.useCount += 1;
        }

        // Update stats if available
        if (state.stats[action.payload]) {
          state.stats[action.payload].useCount += 1;
        }
      })

      // Delete shared workout
      .addCase(deleteSharedWorkout.pending, (state) => {
        state.generalError = null;
      })
      .addCase(deleteSharedWorkout.fulfilled, (state, action) => {
        // Remove from user shared workouts
        state.userSharedWorkouts = state.userSharedWorkouts.filter(
          workout => workout.shareId !== action.payload
        );

        // Remove from stats
        delete state.stats[action.payload];

        // Clear current if it was the deleted one
        if (state.currentSharedWorkout?.shareId === action.payload) {
          state.currentSharedWorkout = null;
        }

        state.generalError = null;
      })
      .addCase(deleteSharedWorkout.rejected, (state, action) => {
        state.generalError = action.error.message || 'Failed to delete shared workout';
      })

      // Load stats
      .addCase(loadSharedWorkoutStats.fulfilled, (state, action) => {
        const { shareId, stats } = action.payload;
        if (stats) {
          state.stats[shareId] = stats;
        }
      });
  },
});

export const {
  clearCurrentSharedWorkout,
  setAnonymousSession,
  clearShareError,
  clearGeneralError,
  clearLastCreatedShareId,
  setCurrentSharedWorkout,
  clearUserSharedWorkouts,
  resetSharedWorkoutState
} = sharedWorkoutSlice.actions;

export default sharedWorkoutSlice.reducer;