import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Exercise, ExerciseFilter } from '../../types/exercise';

export interface ExerciseState {
  exercises: Exercise[];
  filteredExercises: Exercise[];
  selectedExercise: Exercise | null;
  filter: ExerciseFilter;
  favorites: string[];
  recentlyUsed: string[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: ExerciseState = {
  exercises: [],
  filteredExercises: [],
  selectedExercise: null,
  filter: {},
  favorites: [],
  recentlyUsed: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const exerciseSlice = createSlice({
  name: 'exercise',
  initialState,
  reducers: {
    setExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.exercises = action.payload;
      state.filteredExercises = action.payload;
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    },

    setFilteredExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.filteredExercises = action.payload;
    },

    setSelectedExercise: (state, action: PayloadAction<Exercise | null>) => {
      state.selectedExercise = action.payload;
    },

    updateFilter: (state, action: PayloadAction<Partial<ExerciseFilter>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },

    clearFilter: (state) => {
      state.filter = {};
      state.filteredExercises = state.exercises;
    },

    addToFavorites: (state, action: PayloadAction<string>) => {
      if (!state.favorites.includes(action.payload)) {
        state.favorites.push(action.payload);
      }
    },

    removeFromFavorites: (state, action: PayloadAction<string>) => {
      state.favorites = state.favorites.filter(id => id !== action.payload);
    },

    addToRecentlyUsed: (state, action: PayloadAction<string>) => {
      state.recentlyUsed = state.recentlyUsed.filter(id => id !== action.payload);
      state.recentlyUsed.unshift(action.payload);
      if (state.recentlyUsed.length > 20) {
        state.recentlyUsed = state.recentlyUsed.slice(0, 20);
      }
    },

    searchExercises: (state, action: PayloadAction<string>) => {
      const searchTerm = action.payload.toLowerCase().trim();
      
      if (!searchTerm) {
        state.filteredExercises = state.exercises;
        return;
      }

      state.filteredExercises = state.exercises.filter(exercise => 
        exercise.name.toLowerCase().includes(searchTerm) ||
        exercise.muscleGroup.toLowerCase().includes(searchTerm) ||
        exercise.equipment.toLowerCase().includes(searchTerm) ||
        exercise.searchKeywords.some(keyword => 
          keyword.toLowerCase().includes(searchTerm)
        ) ||
        exercise.instructions.some(instruction => 
          instruction.toLowerCase().includes(searchTerm)
        )
      );
    },

    filterByMuscleGroup: (state, action: PayloadAction<string>) => {
      state.filter.muscleGroup = action.payload;
      if (action.payload === 'all') {
        state.filteredExercises = state.exercises;
      } else {
        state.filteredExercises = state.exercises.filter(exercise =>
          exercise.muscleGroup.toLowerCase() === action.payload.toLowerCase()
        );
      }
    },

    // Substring match against the (comma-joined) muscleGroup field only — used by
    // the Home body map, where a single muscle name (e.g. "Chest", "Lats") must
    // match exercises whose muscleGroup is a list like "Anterior Deltoid, Chest,
    // Front Shoulders". Unlike filterByMuscleGroup's exact match, and narrower
    // than searchExercises (which also scans names/instructions).
    filterByMuscle: (state, action: PayloadAction<string>) => {
      const term = action.payload.toLowerCase().trim();
      state.filter.muscleGroup = action.payload;
      if (!term || term === 'all') {
        state.filteredExercises = state.exercises;
      } else {
        state.filteredExercises = state.exercises.filter(exercise =>
          exercise.muscleGroup.toLowerCase().includes(term)
        );
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setExercises,
  setFilteredExercises,
  setSelectedExercise,
  updateFilter,
  clearFilter,
  addToFavorites,
  removeFromFavorites,
  addToRecentlyUsed,
  searchExercises,
  filterByMuscleGroup,
  filterByMuscle,
  setLoading,
  setError,
  clearError,
} = exerciseSlice.actions;

export default exerciseSlice.reducer;