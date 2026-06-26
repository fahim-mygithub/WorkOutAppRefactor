/**
 * Launch a Charlie-Split planned day into the live workout player. Mirrors the
 * BuildWizard launch path (sanitize → startWorkout → /workout) and stashes an
 * `activePlanContext` in sessionStorage (reload-safe, like the shared-workout
 * pattern) so WorkoutPage completion can flip the planned day to completed.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { useExercises } from './useExercises';
import { usePlannedSchedule } from './usePlannedSchedule';
import { startWorkout } from '../store/slices/workoutSlice';
import { sanitizeWorkoutExercisesForRedux } from '../utils/workoutConversion';
import type { PlannedDay } from '../types/schedule';

export interface ActivePlanContext {
  dateKey: string;
  templateId: 'charlie-split';
  dayType: PlannedDay['dayType'];
  cycleOrdinal: number;
  isRetest?: boolean;
}

export function useStartPlannedDay(): (planned: PlannedDay) => void {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { exercises } = useExercises();
  const { generatePlannedWorkout } = usePlannedSchedule();

  return useCallback(
    (planned: PlannedDay) => {
      if (planned.status === 'completed') return;
      const gen = generatePlannedWorkout(planned.dateKey, exercises);
      if (!gen) return;
      const context: ActivePlanContext = {
        dateKey: planned.dateKey,
        templateId: 'charlie-split',
        dayType: planned.dayType,
        cycleOrdinal: planned.cycleOrdinal,
        isRetest: planned.isRetest,
      };
      try {
        sessionStorage.setItem('activePlanContext', JSON.stringify(context));
      } catch {
        /* sessionStorage unavailable — non-fatal */
      }
      const sanitized = sanitizeWorkoutExercisesForRedux(gen.exercises);
      dispatch(startWorkout({ name: gen.name, exercises: sanitized }));
      navigate('/workout');
    },
    [navigate, dispatch, exercises, generatePlannedWorkout],
  );
}
