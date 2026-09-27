import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setExercises, setLoading, setError } from '../store/slices/exerciseSlice';
import { loadExercises } from '../utils/loadExercises';
import { loadCustomExercises, selectCustomExercises } from '../store/slices/customExerciseSlice';
import { CustomExerciseService } from '../services/customExerciseService';
import { useAuth } from '../contexts/AuthContext';
import { Exercise } from '../types/exercise';

export const useExercises = () => {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { exercises, lastUpdated } = useAppSelector((state) => state.exercise);
  const customExercises = useAppSelector(selectCustomExercises);

  useEffect(() => {
    // Load database exercises if we haven't loaded them yet
    if (exercises.length === 0 && !lastUpdated) {
      const loadExerciseDatabase = async () => {
        dispatch(setLoading(true));
        try {
          const loadedExercises = await loadExercises();
          dispatch(setExercises(loadedExercises));
        } catch (error) {
          console.error('Failed to load exercises:', error);
          dispatch(setError('Failed to load exercises. Please try again later.'));
        } finally {
          dispatch(setLoading(false));
        }
      };

      loadExerciseDatabase();
    }
  }, [dispatch, exercises.length, lastUpdated]);

  // Load custom exercises for authenticated users
  useEffect(() => {
    if (user?.uid) {
      dispatch(loadCustomExercises(user.uid));
    }
  }, [dispatch, user?.uid]);

  // Merge custom exercises with database exercises. Memoised: a fresh array
  // every render restarts consumers' debounced searches (the player re-renders
  // each second, so "Change exercise" never finished searching).
  const mergedExercises = useMemo(
    () => CustomExerciseService.mergeWithDatabaseExercises(exercises, customExercises),
    [exercises, customExercises],
  );

  return {
    exercises: mergedExercises,
    databaseExercises: exercises,
    customExercises,
    isLoading: useAppSelector((state) => state.exercise.isLoading),
    error: useAppSelector((state) => state.exercise.error),
  };
};