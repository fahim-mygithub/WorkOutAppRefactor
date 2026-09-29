import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setExercises } from '../../store/slices/exerciseSlice';
import { loadExercises } from '../../utils/loadExercises';
import type { CustomExercise } from '../../services/customExerciseService';
import type { Exercise } from '../../types/exercise';

const NO_EXERCISES: Exercise[] = [];
const NO_CUSTOM: CustomExercise[] = [];

const toIso = (d: unknown): string => (d instanceof Date ? d.toISOString() : String(d ?? ''));

/** A saved custom exercise in library shape, so search and pickers treat it alike. */
export function customToExercise(custom: CustomExercise): Exercise {
  return {
    ...custom,
    id: custom.id ?? custom.name,
    muscleGroups:
      custom.muscleGroups ??
      custom.muscleGroup
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    videoLinks: custom.videoLinks ?? [],
    instructions: custom.instructions ?? [],
    searchKeywords: custom.searchKeywords ?? [],
    createdAt: toIso(custom.createdAt),
    updatedAt: toIso(custom.updatedAt),
  };
}

/**
 * The exercise library from the store, loading it once if nothing has yet,
 * plus the user's saved custom exercises (a custom one whose name the library
 * already has is left out). Needs no auth context, so it works inside sheets
 * and bare test stores.
 */
export function useExerciseLibrary(): Exercise[] {
  const dispatch = useAppDispatch();
  const hasSlice = useAppSelector((s) => Boolean(s.exercise));
  const exercises = useAppSelector((s) => s.exercise?.exercises ?? NO_EXERCISES);
  const lastUpdated = useAppSelector((s) => s.exercise?.lastUpdated);
  const custom = useAppSelector((s) => s.customExercise?.exercises ?? NO_CUSTOM);

  useEffect(() => {
    if (!hasSlice || exercises.length > 0 || lastUpdated) return;
    let cancelled = false;
    loadExercises().then((loaded) => {
      if (!cancelled && loaded.length > 0) dispatch(setExercises(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, hasSlice, exercises.length, lastUpdated]);

  return useMemo(() => {
    if (custom.length === 0) return exercises;
    const names = new Set(exercises.map((e) => e.name.toLowerCase()));
    const extra: Exercise[] = [];
    for (const c of custom) {
      const key = c.name.toLowerCase();
      if (names.has(key)) continue;
      names.add(key);
      extra.push(customToExercise(c));
    }
    return extra.length ? [...exercises, ...extra] : exercises;
  }, [exercises, custom]);
}
