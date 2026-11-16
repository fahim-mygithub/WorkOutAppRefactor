import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ExerciseQuickAdd } from '../workout/ExerciseQuickAdd';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updatePlanned, type PlannedWorkout } from '../../store/slices/plannedWorkoutsSlice';
import { askAiOpened, planEditConsumed } from '../../store/slices/aiSlice';
import { isBackendAvailable, isSignedIn } from '../../ai/aiClient';
import {
  buildUpdatedPlanExercise,
  planEditorScreen,
  toPlanDraftExercises,
  type PlanDraftExercise,
} from '../../ai/planDraft';
import { usePublishScreen } from '../../ai/useScreenSnapshot';
import type { Exercise, WorkoutExercise } from '../../types/exercise';

export interface PlanEditSheetProps {
  plan: PlannedWorkout | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlanEditSheet: React.FC<PlanEditSheetProps> = ({
  plan,
  open,
  onOpenChange,
}) => {
  const dispatch = useAppDispatch();
  const defaultUnit = useAppSelector((s) => s.user?.preferences?.weightUnit ?? 'lbs');
  const aiDisabledReason = useAppSelector((s) => s.ai?.disabledReason);
  const planEdit = useAppSelector((s) => s.ai?.planEdit);

  const [activePlanId, setActivePlanId] = useState<string | null>(plan?.id ?? null);
  const [activePlanDate, setActivePlanDate] = useState<string>(plan?.dateKey ?? '');
  const [name, setName] = useState<string>(plan?.name ?? '');
  const [draftExercises, setDraftExercises] = useState<PlanDraftExercise[]>(() =>
    plan ? toPlanDraftExercises(plan.exercises, defaultUnit) : [],
  );

  useEffect(() => {
    if (open && plan) {
      setActivePlanId(plan.id);
      setActivePlanDate(plan.dateKey);
      setName(plan.name);
      setDraftExercises(toPlanDraftExercises(plan.exercises, defaultUnit));
    }
  }, [open, plan, defaultUnit]);

  const snapshot = useMemo(() => {
    if (!open || !plan || activePlanId !== plan.id) return null;
    return planEditorScreen({
      planId: activePlanId,
      date: activePlanDate,
      name,
      exercises: draftExercises,
    });
  }, [open, plan, activePlanId, activePlanDate, name, draftExercises]);

  usePublishScreen('plan-edit', snapshot);

  useEffect(() => {
    if (!planEdit) return;
    if (open && activePlanId && planEdit.planId === activePlanId) {
      if (planEdit.name !== undefined) setName(planEdit.name);
      if (planEdit.exercises !== undefined) setDraftExercises(planEdit.exercises);
    }
    dispatch(planEditConsumed(planEdit.id));
  }, [planEdit, open, activePlanId, dispatch]);

  const trimmedName = name.trim();
  const canSave = Boolean(activePlanId && trimmedName.length > 0);
  const aiUsable = !aiDisabledReason && isBackendAvailable() && isSignedIn();

  const handleFieldChange = (
    key: string,
    field: 'setsCount' | 'reps' | 'weight',
    value: string,
  ) => {
    setDraftExercises((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  };

  const handleRemove = (key: string) => {
    setDraftExercises((prev) => prev.filter((item) => item.key !== key));
  };

  const handleAddExercise = (exercise: Exercise) => {
    const newId = `plan-ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newWorkoutExercise: WorkoutExercise = {
      id: newId,
      exercise,
      sets: Array.from({ length: 3 }, (_, idx) => ({
        id: `plan-set-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        reps: 10,
        unit: defaultUnit,
        completed: false,
      })),
      restTime: 120,
    };

    setDraftExercises((prev) => [
      ...prev,
      ...toPlanDraftExercises([newWorkoutExercise], defaultUnit).map((d) => ({
        ...d,
        key: `${newId}-${prev.length}`,
      })),
    ]);
  };

  const handleSave = () => {
    if (!activePlanId || !trimmedName) return;
    dispatch(
      updatePlanned({
        id: activePlanId,
        name: trimmedName,
        exercises: draftExercises.map(buildUpdatedPlanExercise),
      }),
    );
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="mx-auto max-w-lg overflow-x-hidden">
        <div className="flex items-center justify-between gap-3">
          <SheetTitle className="text-title">Edit workout</SheetTitle>
          {aiUsable ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Ask AI"
              onClick={() => dispatch(askAiOpened())}
              className="shrink-0 text-ink-muted hover:text-ink"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
        <SheetDescription>
          Rename this planned session or adjust its exercises, sets, reps, and weights.
        </SheetDescription>

        <div className="mt-4 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="plan-edit-name" className="text-ink-muted">
              Workout name
            </Label>
            <Input
              id="plan-edit-name"
              size="md"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!trimmedName}
              placeholder="Workout name"
            />
          </div>

          <ExerciseQuickAdd
            id="plan-edit-add-exercise"
            label="Add exercise"
            onAdd={handleAddExercise}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-body-sm font-semibold text-ink">
                Exercises ({draftExercises.length})
              </h3>
            </div>

            {draftExercises.length === 0 ? (
              <p className="rounded-2xl bg-surface-raised/40 px-4 py-6 text-center text-body-sm text-ink-muted">
                No exercises yet. Search above to add one.
              </p>
            ) : (
              <ul className="space-y-3">
                {draftExercises.map((item) => {
                  const exName = item.base.exercise.name;
                  return (
                    <li
                      key={item.key}
                      className="space-y-3 rounded-2xl bg-surface-raised/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-ink">{exName}</p>
                          {item.base.exercise.muscleGroup && (
                            <p className="truncate text-caption text-ink-muted">
                              {item.base.exercise.muscleGroup}
                              {item.base.exercise.equipment ? ` · ${item.base.exercise.equipment}` : ''}
                            </p>
                          )}
                        </div>
                        <IconButton
                          variant="ghost"
                          size="md"
                          aria-label={`Remove ${exName}`}
                          onClick={() => handleRemove(item.key)}
                          className="shrink-0 text-ink-muted hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`${item.key}-sets`}
                            className="text-caption text-ink-muted"
                          >
                            Sets
                          </Label>
                          <Input
                            id={`${item.key}-sets`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            size="md"
                            aria-label={`Sets for ${exName}`}
                            value={item.setsCount}
                            onChange={(e) =>
                              handleFieldChange(item.key, 'setsCount', e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor={`${item.key}-reps`}
                            className="text-caption text-ink-muted"
                          >
                            Reps
                          </Label>
                          <Input
                            id={`${item.key}-reps`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            size="md"
                            aria-label={`Reps for ${exName}`}
                            value={item.reps}
                            onChange={(e) =>
                              handleFieldChange(item.key, 'reps', e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor={`${item.key}-weight`}
                            className="text-caption text-ink-muted"
                          >
                            Weight ({item.unit})
                          </Label>
                          <Input
                            id={`${item.key}-weight`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            size="md"
                            placeholder="BW"
                            aria-label={`Weight for ${exName}`}
                            value={item.weight}
                            onChange={(e) =>
                              handleFieldChange(item.key, 'weight', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!canSave}
              onClick={handleSave}
            >
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
