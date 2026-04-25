import { configureStore } from '@reduxjs/toolkit';
import exerciseReducer from './slices/exerciseSlice';
import workoutReducer from './slices/workoutSlice';
import userReducer from './slices/userSlice';
import customExerciseReducer from './slices/customExerciseSlice';
import exerciseHistoryReducer from './slices/exerciseHistorySlice';
import sharedWorkoutReducer from './slices/sharedWorkoutSlice';

export const store = configureStore({
  reducer: {
    exercise: exerciseReducer,
    workout: workoutReducer,
    user: userReducer,
    customExercise: customExerciseReducer,
    exerciseHistory: exerciseHistoryReducer,
    sharedWorkout: sharedWorkoutReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;