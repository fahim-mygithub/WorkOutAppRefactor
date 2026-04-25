import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { CustomExercise, CustomExerciseService, SaveCustomExerciseData } from '../../services/customExerciseService';

interface CustomExerciseState {
  exercises: CustomExercise[];
  isLoading: boolean;
  error: string | null;
  lastSynced: string | null;
  pendingExercises: SaveCustomExerciseData[]; // For offline support
}

const initialState: CustomExerciseState = {
  exercises: [],
  isLoading: false,
  error: null,
  lastSynced: null,
  pendingExercises: []
};

// Async thunks for Firebase operations
export const loadCustomExercises = createAsyncThunk(
  'customExercise/loadCustomExercises',
  async (userId: string, { rejectWithValue }) => {
    try {
      const exercises = await CustomExerciseService.getUserCustomExercises(userId);
      return { exercises, lastSynced: new Date().toISOString() };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load custom exercises');
    }
  }
);

export const saveCustomExercise = createAsyncThunk(
  'customExercise/saveCustomExercise',
  async ({ userId, exerciseData }: { userId: string; exerciseData: SaveCustomExerciseData }, { rejectWithValue }) => {
    try {
      const exerciseId = await CustomExerciseService.saveCustomExercise(userId, exerciseData);

      // Fetch the saved exercise to get the actual timestamps from Firestore
      const exercises = await CustomExerciseService.getUserCustomExercises(userId);
      const savedExercise = exercises.find(ex => ex.id === exerciseId);

      if (!savedExercise) {
        throw new Error('Failed to retrieve saved exercise');
      }

      return savedExercise;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save custom exercise');
    }
  }
);

export const updateCustomExercise = createAsyncThunk(
  'customExercise/updateCustomExercise',
  async (
    { userId, exerciseId, updates }: { userId: string; exerciseId: string; updates: Partial<SaveCustomExerciseData> },
    { rejectWithValue }
  ) => {
    try {
      await CustomExerciseService.updateCustomExercise(userId, exerciseId, updates);
      return { exerciseId, updates };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update custom exercise');
    }
  }
);

export const deleteCustomExercise = createAsyncThunk(
  'customExercise/deleteCustomExercise',
  async ({ userId, exerciseId }: { userId: string; exerciseId: string }, { rejectWithValue }) => {
    try {
      await CustomExerciseService.deleteCustomExercise(userId, exerciseId);
      return exerciseId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete custom exercise');
    }
  }
);

export const incrementUsage = createAsyncThunk(
  'customExercise/incrementUsage',
  async ({ userId, exerciseId }: { userId: string; exerciseId: string }, { rejectWithValue }) => {
    try {
      await CustomExerciseService.incrementUsage(userId, exerciseId);
      return exerciseId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to increment usage');
    }
  }
);

export const batchSaveCustomExercises = createAsyncThunk(
  'customExercise/batchSaveCustomExercises',
  async (
    { userId, exercises }: { userId: string; exercises: SaveCustomExerciseData[] },
    { rejectWithValue }
  ) => {
    try {
      await CustomExerciseService.batchSaveCustomExercises(userId, exercises);

      // Fetch all exercises to get the saved ones with proper timestamps
      const allExercises = await CustomExerciseService.getUserCustomExercises(userId);

      return allExercises;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to batch save custom exercises');
    }
  }
);

const customExerciseSlice = createSlice({
  name: 'customExercise',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    
    addPendingExercise: (state, action: PayloadAction<SaveCustomExerciseData>) => {
      state.pendingExercises.push(action.payload);
    },
    
    removePendingExercise: (state, action: PayloadAction<string>) => {
      state.pendingExercises = state.pendingExercises.filter(
        exercise => exercise.originalName !== action.payload
      );
    },
    
    clearPendingExercises: (state) => {
      state.pendingExercises = [];
    },
    
    // Local state management for optimistic updates
    addCustomExerciseLocally: (state, action: PayloadAction<CustomExercise>) => {
      state.exercises.unshift(action.payload);
    },

    updateCustomExerciseLocally: (state, action: PayloadAction<{ exerciseId: string; updates: Partial<CustomExercise> }>) => {
      const { exerciseId, updates } = action.payload;
      const exerciseIndex = state.exercises.findIndex(exercise => exercise.id === exerciseId);
      if (exerciseIndex !== -1) {
        // Create a proper Date object for updatedAt
        const now = new Date();
        state.exercises[exerciseIndex] = {
          ...state.exercises[exerciseIndex],
          ...updates,
          updatedAt: now
        };
      }
    },
    
    removeCustomExerciseLocally: (state, action: PayloadAction<string>) => {
      state.exercises = state.exercises.filter(exercise => exercise.id !== action.payload);
    },
    
    resetCustomExerciseState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Load custom exercises
      .addCase(loadCustomExercises.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadCustomExercises.fulfilled, (state, action) => {
        state.isLoading = false;
        state.exercises = action.payload.exercises;
        state.lastSynced = action.payload.lastSynced;
        state.error = null;
      })
      .addCase(loadCustomExercises.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Save custom exercise
      .addCase(saveCustomExercise.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveCustomExercise.fulfilled, (state, action) => {
        state.isLoading = false;
        
        // Add to beginning of array (most recently used first)
        state.exercises.unshift(action.payload);
        
        // Remove from pending exercises
        state.pendingExercises = state.pendingExercises.filter(
          pending => pending.originalName !== action.payload.originalName
        );
        
        state.error = null;
      })
      .addCase(saveCustomExercise.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update custom exercise
      .addCase(updateCustomExercise.fulfilled, (state, action) => {
        const { exerciseId, updates } = action.payload;
        const exerciseIndex = state.exercises.findIndex(exercise => exercise.id === exerciseId);
        if (exerciseIndex !== -1) {
          // Create a proper Date object for updatedAt
          const now = new Date();
          state.exercises[exerciseIndex] = {
            ...state.exercises[exerciseIndex],
            ...updates,
            updatedAt: now
          };
        }
      })
      .addCase(updateCustomExercise.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      
      // Delete custom exercise
      .addCase(deleteCustomExercise.fulfilled, (state, action) => {
        state.exercises = state.exercises.filter(exercise => exercise.id !== action.payload);
      })
      .addCase(deleteCustomExercise.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      
      // Increment usage
      .addCase(incrementUsage.fulfilled, (state, action) => {
        const exerciseId = action.payload;
        const exerciseIndex = state.exercises.findIndex(exercise => exercise.id === exerciseId);
        if (exerciseIndex !== -1) {
          state.exercises[exerciseIndex].usageCount += 1;
          // Create a proper Date object for updatedAt
          state.exercises[exerciseIndex].updatedAt = new Date();

          // Resort exercises by usage count
          state.exercises.sort((a, b) => b.usageCount - a.usageCount);
        }
      })
      
      // Batch save custom exercises
      .addCase(batchSaveCustomExercises.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(batchSaveCustomExercises.fulfilled, (state, action) => {
        state.isLoading = false;

        // Replace with all exercises fetched from Firestore
        state.exercises = action.payload;

        // Clear pending exercises
        state.pendingExercises = [];

        state.error = null;
      })
      .addCase(batchSaveCustomExercises.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  addPendingExercise,
  removePendingExercise,
  clearPendingExercises,
  addCustomExerciseLocally,
  updateCustomExerciseLocally,
  removeCustomExerciseLocally,
  resetCustomExerciseState,
} = customExerciseSlice.actions;

// Selectors
export const selectCustomExercises = (state: { customExercise: CustomExerciseState }) => 
  state.customExercise.exercises;

export const selectCustomExercisesByUsage = (state: { customExercise: CustomExerciseState }) =>
  [...state.customExercise.exercises].sort((a, b) => b.usageCount - a.usageCount);

export const selectIsLoadingCustomExercises = (state: { customExercise: CustomExerciseState }) => 
  state.customExercise.isLoading;

export const selectCustomExerciseError = (state: { customExercise: CustomExerciseState }) => 
  state.customExercise.error;

export const selectPendingCustomExercises = (state: { customExercise: CustomExerciseState }) => 
  state.customExercise.pendingExercises;

export const selectCustomExerciseById = (exerciseId: string) => 
  (state: { customExercise: CustomExerciseState }) =>
    state.customExercise.exercises.find(exercise => exercise.id === exerciseId);

export const selectCustomExerciseByName = (exerciseName: string) =>
  (state: { customExercise: CustomExerciseState }) =>
    state.customExercise.exercises.find(
      exercise => 
        exercise.name.toLowerCase() === exerciseName.toLowerCase() ||
        exercise.originalName.toLowerCase() === exerciseName.toLowerCase()
    );

export const selectLastSyncedAt = (state: { customExercise: CustomExerciseState }) => 
  state.customExercise.lastSynced;

export default customExerciseSlice.reducer;