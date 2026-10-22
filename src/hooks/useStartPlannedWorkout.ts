import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { startWorkout } from '../store/slices/workoutSlice';
import { sanitizeWorkoutExercisesForRedux } from '../utils/workoutConversion';
import { preparePlannedWorkoutForExecution } from '../lib/planWorkout';
import { setStoredPlanContext, type ActivePlanContext } from '../lib/workoutSession';
import type { PlannedWorkout } from '../store/slices/plannedWorkoutsSlice';

export function useStartPlannedWorkout(): (plan: PlannedWorkout) => void {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const trackedLifts = useAppSelector((s) => s.trackedLifts.lifts);
  const goal = useAppSelector((s) => s.trackedLifts.lastGoal) ?? 'volume';

  return useCallback(
    (plan: PlannedWorkout) => {
      const exercises = preparePlannedWorkoutForExecution(plan, trackedLifts, goal);
      const sanitized = sanitizeWorkoutExercisesForRedux(exercises);
      const context: ActivePlanContext = {
        templateId: 'planned-workout',
        dateKey: plan.dateKey,
        plannedWorkoutId: plan.id,
      };
      setStoredPlanContext(context);
      dispatch(startWorkout({ name: plan.name, exercises: sanitized }));
      navigate('/workout');
    },
    [dispatch, navigate, trackedLifts, goal],
  );
}
