import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const [currentDateKey, setCurrentDateKey] = useState<DateKey>(() => toDateKey(new Date()));

  useEffect(() => {
    const updateToday = () => {
      const nextKey = toDateKey(new Date());
      setCurrentDateKey((prev) => (prev === nextKey ? prev : nextKey));
    };

    updateToday();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', updateToday);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', updateToday);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', updateToday);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', updateToday);
      }
    };
  }, []);

  // Compute todayKey from live date on render or visibility change
  const liveDateKey = toDateKey(new Date());
  const todayKey = liveDateKey !== currentDateKey ? liveDateKey : currentDateKey;

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
    todayKey,
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
