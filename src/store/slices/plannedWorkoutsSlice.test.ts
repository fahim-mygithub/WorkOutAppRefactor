import { describe, it, expect } from 'vitest';
import reducer, {
  planAdded,
  planMoved,
  planRemoved,
  planMarkedDone,
  planSkipped,
  plannedWorkoutsHydrated,
  selectOverduePlans,
  selectPlansForToday,
  selectUpcomingPlans,
  selectHasPlanDueToday,
  type PlannedWorkoutsState,
  type PlannedWorkout,
} from './plannedWorkoutsSlice';

const samplePlan: PlannedWorkout = {
  id: 'plan-1',
  dateKey: '2026-10-23',
  name: 'Upper Body Blast',
  exercises: [],
  status: 'planned',
  createdAt: '2026-10-22T10:00:00.000Z',
};

describe('plannedWorkoutsSlice', () => {
  it('hydrates plans and sets ready status', () => {
    const next = reducer(undefined, plannedWorkoutsHydrated([samplePlan]));
    expect(next.status).toBe('ready');
    expect(next.plans).toEqual([samplePlan]);
  });

  it('adds a plan with default status and auto-generated id/createdAt when omitted', () => {
    const next = reducer(
      undefined,
      planAdded({
        dateKey: '2026-10-25',
        name: 'Leg Day',
        exercises: [],
      }),
    );
    expect(next.plans.length).toBe(1);
    expect(next.plans[0].name).toBe('Leg Day');
    expect(next.plans[0].dateKey).toBe('2026-10-25');
    expect(next.plans[0].status).toBe('planned');
    expect(typeof next.plans[0].id).toBe('string');
    expect(typeof next.plans[0].createdAt).toBe('string');
  });

  it('moves a plan to a new dateKey', () => {
    const initial: PlannedWorkoutsState = {
      status: 'ready',
      plans: [samplePlan],
    };
    const next = reducer(initial, planMoved({ id: 'plan-1', dateKey: '2026-10-28' }));
    expect(next.plans[0].dateKey).toBe('2026-10-28');
  });

  it('removes a plan by id', () => {
    const initial: PlannedWorkoutsState = {
      status: 'ready',
      plans: [samplePlan],
    };
    const next = reducer(initial, planRemoved('plan-1'));
    expect(next.plans.length).toBe(0);
  });

  it('marks a plan as done', () => {
    const initial: PlannedWorkoutsState = {
      status: 'ready',
      plans: [samplePlan],
    };
    const next = reducer(initial, planMarkedDone('plan-1'));
    expect(next.plans[0].status).toBe('done');
  });

  it('marks a plan as skipped', () => {
    const initial: PlannedWorkoutsState = {
      status: 'ready',
      plans: [samplePlan],
    };
    const next = reducer(initial, planSkipped('plan-1'));
    expect(next.plans[0].status).toBe('skipped');
  });

  describe('selectors', () => {
    const state = {
      plannedWorkouts: {
        status: 'ready' as const,
        plans: [
          { ...samplePlan, id: 'past-1', dateKey: '2026-10-20', status: 'planned' as const },
          { ...samplePlan, id: 'past-done', dateKey: '2026-10-20', status: 'done' as const },
          { ...samplePlan, id: 'today-1', dateKey: '2026-10-22', status: 'planned' as const },
          { ...samplePlan, id: 'today-2', dateKey: '2026-10-22', status: 'done' as const },
          { ...samplePlan, id: 'future-1', dateKey: '2026-10-24', status: 'planned' as const },
          { ...samplePlan, id: 'future-2', dateKey: '2026-10-26', status: 'planned' as const },
        ],
      },
    };
    const today = '2026-10-22';

    it('selects overdue plans sorted by dateKey ascending', () => {
      const overdue = selectOverduePlans(state, today);
      expect(overdue.map((p) => p.id)).toEqual(['past-1']);
    });

    it('selects active plans for today', () => {
      const todays = selectPlansForToday(state, today);
      expect(todays.map((p) => p.id)).toEqual(['today-1']);
    });

    it('selects upcoming plans in order', () => {
      const upcoming = selectUpcomingPlans(state, today);
      expect(upcoming.map((p) => p.id)).toEqual(['future-1', 'future-2']);
    });

    it('detects if a plan is due today for nav badge', () => {
      expect(selectHasPlanDueToday(state, today)).toBe(true);
      expect(selectHasPlanDueToday(state, '2026-10-23')).toBe(false);
    });
  });
});
