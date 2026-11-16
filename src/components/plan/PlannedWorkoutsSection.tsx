import React, { useState } from 'react';
import { Play, Calendar, Trash2, CalendarPlus, SkipForward, ChevronRight } from 'lucide-react';
import { Card, CardBody } from '../ui/card';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { usePlannedWorkouts } from '../../hooks/usePlannedWorkouts';
import { useAppSelector } from '../../store/hooks';
import { generateWorkoutIcs, downloadIcsFile } from '../../lib/ics';
import { toDateKey, dateKeyToDate } from '../../lib/dateKey';
import { PlanDateModal } from './PlanDateModal';
import { PlanEditSheet } from './PlanEditSheet';
import type { PlannedWorkout } from '../../store/slices/plannedWorkoutsSlice';

function formatPlanDate(dateKey: string): string {
  try {
    const d = dateKeyToDate(dateKey);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateKey;
  }
}

export const PlannedWorkoutsSection: React.FC = () => {
  const {
    todayPlans,
    overduePlans,
    upcomingPlans,
    startPlan,
    movePlan,
    removePlan,
    skipPlan,
  } = usePlannedWorkouts();

  const reminderTime = useAppSelector(
    (s) => s.user?.preferences?.notifications?.reminderTime || '08:00',
  );

  const [movingPlan, setMovingPlan] = useState<PlannedWorkout | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlannedWorkout | null>(null);

  const handleAddToCalendar = (plan: PlannedWorkout) => {
    const exerciseList = plan.exercises.map((e) => e.exercise.name).join(', ');
    const icsContent = generateWorkoutIcs({
      uid: `${plan.id}@workoutapp`,
      title: plan.name,
      description: exerciseList ? `Exercises: ${exerciseList}` : undefined,
      dateKey: plan.dateKey,
      reminderTime,
    });
    const safeTitle = plan.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'workout';
    downloadIcsFile(`${safeTitle}_${plan.dateKey}`, icsContent);
  };

  const handleStartToday = (plan: PlannedWorkout) => {
    const today = toDateKey(new Date());
    if (plan.dateKey !== today) {
      movePlan(plan.id, today);
      startPlan({ ...plan, dateKey: today });
    } else {
      startPlan(plan);
    }
  };

  const hasAnyPlans =
    todayPlans.length > 0 || overduePlans.length > 0 || upcomingPlans.length > 0;

  if (!hasAnyPlans) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6" data-testid="planned-workouts-section">
      {/* Planned Today */}
      {todayPlans.length > 0 && (
        <section aria-label="Planned for today" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-body font-semibold text-ink">Planned today</h2>
            <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-caption font-semibold text-accent">
              Due today
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {todayPlans.map((plan) => (
              <Card key={plan.id} className="border-accent/40 bg-surface-raised/40">
                <CardBody className="p-4">
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(plan)}
                      aria-label={`Edit ${plan.name}`}
                      className="-mx-2 -mt-1 flex min-h-touch-min min-w-0 items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-snap hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-title font-semibold text-ink">{plan.name}</h3>
                        <p className="text-body-sm text-ink-muted">
                          {plan.exercises.length} exercise{plan.exercises.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => startPlan(plan)}
                      >
                        <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                        Start
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => setMovingPlan(plan)}
                      >
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        Move
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => handleAddToCalendar(plan)}
                        title="Add to Calendar (.ics)"
                      >
                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                        Calendar
                      </Button>
                      <IconButton
                        variant="ghost"
                        size="md"
                        onClick={() => removePlan(plan.id)}
                        className="text-ink-muted hover:text-danger"
                        aria-label={`Remove ${plan.name}`}
                        title="Remove plan"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Missed / Overdue Plans */}
      {overduePlans.length > 0 && (
        <section aria-label="Missed workouts" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-body font-semibold text-danger">Missed</h2>
            <span className="inline-flex items-center rounded-full bg-danger/15 px-2.5 py-0.5 text-caption font-semibold text-danger">
              {overduePlans.length} missed
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {overduePlans.map((plan) => (
              <Card key={plan.id} className="border-danger/30 bg-surface-subtle">
                <CardBody className="p-4">
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(plan)}
                      aria-label={`Edit ${plan.name}`}
                      className="-mx-2 -mt-1 flex min-h-touch-min min-w-0 items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-snap hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3 className="break-words text-body font-semibold text-ink">{plan.name}</h3>
                          <span className="text-caption text-ink-muted">
                            (Planned {formatPlanDate(plan.dateKey)})
                          </span>
                        </div>
                        <p className="text-body-sm text-ink-muted">
                          {plan.exercises.length} exercise{plan.exercises.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleStartToday(plan)}
                      >
                        <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                        Start today
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => setMovingPlan(plan)}
                      >
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        Move
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => skipPlan(plan.id)}
                        title="Skip missed plan"
                      >
                        <SkipForward className="h-4 w-4" aria-hidden="true" />
                        Skip
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Plans */}
      {upcomingPlans.length > 0 && (
        <section aria-label="Upcoming planned workouts" className="space-y-3">
          <h2 className="text-body font-semibold text-ink">Upcoming plans</h2>
          <div className="flex flex-col gap-2">
            {upcomingPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface p-2 pl-3"
              >
                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  aria-label={`Edit ${plan.name}`}
                  className="flex min-h-touch-min min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors duration-snap hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-ink">{plan.name}</p>
                    <p className="truncate text-caption text-ink-muted">
                      {formatPlanDate(plan.dateKey)} · {plan.exercises.length} exercise
                      {plan.exercises.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                </button>

                <div className="flex shrink-0 items-center gap-0.5">
                  <IconButton
                    variant="ghost"
                    size="md"
                    onClick={() => handleAddToCalendar(plan)}
                    aria-label={`Add ${plan.name} to Calendar`}
                    title="Add to Calendar"
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="md"
                    onClick={() => setMovingPlan(plan)}
                    aria-label={`Move ${plan.name}`}
                    title="Move date"
                  >
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="md"
                    onClick={() => removePlan(plan.id)}
                    className="text-ink-muted hover:text-danger"
                    aria-label={`Remove ${plan.name}`}
                    title="Remove plan"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Move Date Sheet */}
      {movingPlan && (
        <PlanDateModal
          open={!!movingPlan}
          onOpenChange={(open) => !open && setMovingPlan(null)}
          title={`Move "${movingPlan.name}"`}
          description="Choose a new date for this planned workout."
          initialDateKey={movingPlan.dateKey}
          confirmLabel="Move workout"
          onConfirm={(newDateKey) => {
            movePlan(movingPlan.id, newDateKey);
            setMovingPlan(null);
          }}
        />
      )}

      {/* Edit Plan Sheet */}
      <PlanEditSheet
        plan={editingPlan}
        open={!!editingPlan}
        onOpenChange={(open) => !open && setEditingPlan(null)}
      />
    </div>
  );
};
