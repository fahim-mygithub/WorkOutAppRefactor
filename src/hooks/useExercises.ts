import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setExercises, setLoading, setError } from '../store/slices/exerciseSlice';
import { loadExercisesFromCSV } from '../utils/exercises';
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
      const loadExercises = async () => {
        dispatch(setLoading(true));
        try {
          const loadedExercises = await loadExercisesFromCSV();
          dispatch(setExercises(loadedExercises));
        } catch (error) {
          console.error('Failed to load exercises:', error);
          dispatch(setError('Failed to load exercises. Please try again later.'));
        } finally {
          dispatch(setLoading(false));
        }
      };

      loadExercises();
    }
  }, [dispatch, exercises.length, lastUpdated]);

  // Load custom exercises for authenticated users
  useEffect(() => {
    if (user?.uid) {
      dispatch(loadCustomExercises(user.uid));
    }
  }, [dispatch, user?.uid]);

  // Merge custom exercises with database exercises
  const mergedExercises = CustomExerciseService.mergeWithDatabaseExercises(
    exercises,
    customExercises
  );

  return {
    exercises: mergedExercises,
    databaseExercises: exercises,
    customExercises,
    isLoading: useAppSelector((state) => state.exercise.isLoading),
    error: useAppSelector((state) => state.exercise.error),
  };
};