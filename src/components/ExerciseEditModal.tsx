import React, { useState, useEffect } from 'react';
import { Check, Copy, Minus, Plus, Trash2, RotateCcw } from 'lucide-react';
import { WorkoutExercise, WorkoutSet } from '../types/exercise';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ExerciseEditModalProps {
  isOpen: boolean;
  exercise: WorkoutExercise | null;
  onClose: () => void;
  onSave: (exerciseId: string, updatedSets: WorkoutSet[], restTime: number) => void;
}

export const ExerciseEditModal: React.FC<ExerciseEditModalProps> = ({
  isOpen,
  exercise,
  onClose,
  onSave,
}) => {
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [restTime, setRestTime] = useState(120);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize state when exercise changes
  useEffect(() => {
    if (exercise) {
      setSets([...exercise.sets]); // Create a copy
      setRestTime(exercise.restTime || 120);
      setHasChanges(false);
    }
  }, [exercise]);

  // Track changes
  useEffect(() => {
    if (exercise) {
      const originalSetsJson = JSON.stringify(exercise.sets);
      const currentSetsJson = JSON.stringify(sets);
      const originalRestTime = exercise.restTime || 120;

      setHasChanges(
        originalSetsJson !== currentSetsJson ||
        originalRestTime !== restTime
      );
    }
  }, [sets, restTime, exercise]);

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (exercise) {
      onSave(exercise.id, sets, restTime);
      setHasChanges(false);
      onClose();
    }
  };

  const handleReset = () => {
    if (exercise && confirm('Reset all changes to original values?')) {
      setSets([...exercise.sets]);
      setRestTime(exercise.restTime || 120);
    }
  };

  const updateSet = (index: number, field: keyof WorkoutSet, value: any) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  };

  const addSet = () => {
    const newSet: WorkoutSet = {
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reps: sets.length > 0 ? sets[sets.length - 1].reps : 10,
      weight: sets.length > 0 ? sets[sets.length - 1].weight : 0,
      completed: false,
    };
    setSets([...sets, newSet]);
  };

  const removeSet = (index: number) => {
    if (sets.length > 1 && confirm('Remove this set?')) {
      setSets(sets.filter((_, i) => i !== index));
    }
  };

  const duplicateSet = (index: number) => {
    const setToDuplicate = sets[index];
    const newSet: WorkoutSet = {
      ...setToDuplicate,
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      completed: false,
    };
    const newSets = [...sets];
    newSets.splice(index + 1, 0, newSet);
    setSets(newSets);
  };

  if (!exercise) return null;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <SheetContent className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-title">Edit exercise</SheetTitle>
            <SheetDescription className="truncate">{exercise.exercise.name}</SheetDescription>
          </div>
          {hasChanges && (
            <IconButton
              aria-label="Reset changes"
              variant="ghost"
              onClick={handleReset}
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </IconButton>
          )}
        </div>

        <div className="space-y-6">
          {/* Rest time: a stepper, with the clock readout as the number */}
          <div>
            <Label htmlFor="rest-time-input" className="text-ink-muted">Rest between sets (seconds)</Label>
            <div className="mt-2 flex items-center gap-3">
              <IconButton
                variant="secondary"
                aria-label="Fifteen seconds less rest"
                onClick={() => setRestTime((t) => Math.max(0, t - 15))}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <Input
                id="rest-time-input"
                type="number"
                inputMode="numeric"
                value={restTime}
                onChange={(e) => setRestTime(parseInt(e.target.value) || 0)}
                className="w-24 text-center"
                min="0"
                step="15"
                aria-describedby="rest-time-clock"
              />
              <IconButton
                variant="secondary"
                aria-label="Fifteen seconds more rest"
                onClick={() => setRestTime((t) => t + 15)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <span id="rest-time-clock" className="ml-auto text-right">
                <span className="block font-display font-tabular text-title text-ink">
                  {Math.floor(restTime / 60)}:{(restTime % 60).toString().padStart(2, '0')}
                </span>
                <span className="block text-caption text-ink-muted">minutes</span>
              </span>
            </div>
          </div>

          {/* Sets: one row each. Tap the set number to mark it done. */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-body-sm font-semibold text-ink">Sets</h4>
              <Button variant="ghost" size="sm" onClick={addSet}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add set</span>
              </Button>
            </div>

            <div
              aria-hidden="true"
              className="grid grid-cols-[2.75rem_1fr_1fr_2.75rem_2.75rem] gap-2 pb-1 text-caption text-ink-subtle"
            >
              <span className="text-center">Set</span>
              <span>Reps</span>
              <span>Weight (lb)</span>
            </div>

            <ul className="divide-y divide-hairline">
              {sets.map((set, index) => (
                <li
                  key={set.id}
                  className="grid grid-cols-[2.75rem_1fr_1fr_2.75rem_2.75rem] items-center gap-2 py-2"
                >
                  <button
                    type="button"
                    aria-pressed={!!set.completed}
                    aria-label={`Set ${index + 1}, ${set.completed ? 'done' : 'not done'}. Toggle done`}
                    onClick={() => updateSet(index, 'completed', !set.completed)}
                    className={cn(
                      'flex h-touch-min w-touch-min items-center justify-center rounded-full font-num font-tabular text-body-sm font-bold transition-colors duration-snap',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
                      set.completed
                        ? 'bg-accent-2 text-accent-2-fg'
                        : 'bg-surface-raised text-ink-muted hover:text-ink',
                    )}
                  >
                    {set.completed ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : index + 1}
                  </button>
                  <Input
                    id={`reps-${set.id}`}
                    aria-label={`Set ${index + 1} reps`}
                    type="number"
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(e) => updateSet(index, 'reps', parseInt(e.target.value) || 0)}
                    className="min-w-0 px-3"
                    min="0"
                  />
                  <Input
                    id={`weight-${set.id}`}
                    aria-label={`Set ${index + 1} weight in pounds`}
                    type="number"
                    inputMode="decimal"
                    value={set.weight || 0}
                    onChange={(e) => updateSet(index, 'weight', parseFloat(e.target.value) || 0)}
                    className="min-w-0 px-3"
                    min="0"
                    step="0.5"
                  />
                  <IconButton
                    aria-label={`Duplicate set ${index + 1}`}
                    title="Duplicate set"
                    variant="ghost"
                    onClick={() => duplicateSet(index)}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  {sets.length > 1 ? (
                    <IconButton
                      aria-label={`Remove set ${index + 1}`}
                      variant="ghost"
                      className="hover:text-danger"
                      onClick={() => removeSet(index)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer: one primary */}
        <div className="mt-6 flex flex-col gap-2">
          <Button size="xl" onClick={handleSave} disabled={!hasChanges}>
            Save changes
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            {hasChanges ? 'Cancel' : 'Close'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
