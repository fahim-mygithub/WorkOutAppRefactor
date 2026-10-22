import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  planAdded,
  planMoved,
  planRemoved,
  planMarkedDone,
  planSkipped,
  selectOverduePlans,
  selectPlansForToday,
  selectUpcomingPlans,
  selectPlannedWorkouts,
  type PlannedWorkout,
} from '../store/slices/plannedWorkoutsSlice';
import { toDateKey, type DateKey } from '../lib/dateKey';
import { useStartPlannedWorkout } from './useStartPlannedWorkout';

export function usePlannedWorkouts() {
  const dispatch = useAppDispatch();
  const allPlans = useAppSelector(selectPlannedWorkouts);
  const startPlannedWorkout = useStartPlannedWorkout();

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const todayPlans = useMemo(
    () => selectPlansForToday({ plannedWorkouts: { plans: allPlans, status: 'ready' } }, todayKey),
    [allPlans, todayKey],
  );

  const overduePlans = useMemo(
    () => selectOverduePlans({ plannedWorkouts: { plans: allPlans, status: 'ready' } }, todayKey),
    [allPlans, todayKey],
  );

  const upcomingPlans = useMemo(
    () => selectUpcomingPlans({ plannedWorkouts: { plans: allPlans, status: 'ready' } }, todayKey, 5),
    [allPlans, todayKey],
  );

  const hasPlanDueToday = useMemo(() => todayPlans.length > 0, [todayPlans]);

  const addPlan = useCallback(
    (plan: Omit<PlannedWorkout, 'id' | 'createdAt' | 'status'>) => {
      dispatch(planAdded(plan));
    },
    [dispatch],
  );

  const movePlan = useCallback(
    (id: string, dateKey: DateKey) => {
      dispatch(planMoved({ id, dateKey }));
    },
    [dispatch],
  );

  const removePlan = useCallback(
    (id: string) => {
      dispatch(planRemoved(id));
    },
    [dispatch],
  );

  const markDone = useCallback(
    (id: string) => {
      dispatch(planMarkedDone(id));
    },
    [dispatch],
  );

  const skipPlan = useCallback(
    (id: string) => {
      dispatch(planSkipped(id));
    },
    [dispatch],
  );

  return {
    allPlans,
    todayPlans,
    overduePlans,
    upcomingPlans,
    hasPlanDueToday,
    startPlan: startPlannedWorkout,
    addPlan,
    movePlan,
    removePlan,
    markDone,
    skipPlan,
  };
}
