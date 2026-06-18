import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Stack } from '@/components/ui/stack';

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
      <SheetContent className="max-w-3xl sm:mx-auto">
        {/* Header */}
        <Stack direction="row" align="start" justify="between" gap={3} className="mb-4">
          <div className="min-w-0">
            <SheetTitle className="text-title font-marker"><span className="marker-underline">Edit Exercise</span></SheetTitle>
            <SheetDescription>{exercise.exercise.name}</SheetDescription>
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
        </Stack>

        {/* Content */}
        <div className="space-y-6">
          {/* Rest Time */}
          <div>
            <Label htmlFor="rest-time-input" className="font-marker">Rest Time (seconds)</Label>
            <Input
              id="rest-time-input"
              type="number"
              value={restTime}
              onChange={(e) => setRestTime(parseInt(e.target.value) || 0)}
              className="mt-2 w-32"
              min="0"
              step="15"
            />
            <p className="mt-1 text-caption text-ink-subtle">
              <span className="font-num font-tabular">{Math.floor(restTime / 60)}:{(restTime % 60).toString().padStart(2, '0')}</span> minutes
            </p>
          </div>

          {/* Sets */}
          <div className="space-y-4">
            <Stack direction="row" align="center" justify="between">
              <h4 className="text-body font-semibold text-ink font-marker">Sets</h4>
              <Button size="sm" onClick={addSet}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Set</span>
              </Button>
            </Stack>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div
                  key={set.id}
                  className="rounded-lg bg-surface-subtle p-4"
                >
                  <Stack direction="row" align="center" justify="between" className="mb-3">
                    <h5 className="text-body-sm font-semibold text-ink font-marker">
                      Set <span className="font-num font-tabular">{index + 1}</span>
                    </h5>
                    <Stack direction="row" align="center" gap={1}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateSet(index)}
                        title="Duplicate set"
                      >
                        Copy
                      </Button>
                      {sets.length > 1 && (
                        <IconButton
                          aria-label="Remove set"
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => removeSet(index)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      )}
                    </Stack>
                  </Stack>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label size="sm" htmlFor={`reps-${set.id}`} className="font-marker">
                        Reps
                      </Label>
                      <Input
                        id={`reps-${set.id}`}
                        type="number"
                        value={set.reps}
                        onChange={(e) => updateSet(index, 'reps', parseInt(e.target.value) || 0)}
                        className="mt-1"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label size="sm" htmlFor={`weight-${set.id}`} className="font-marker">
                        Weight (lbs)
                      </Label>
                      <Input
                        id={`weight-${set.id}`}
                        type="number"
                        value={set.weight || 0}
                        onChange={(e) => updateSet(index, 'weight', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <Label size="sm" htmlFor={`status-${set.id}`} className="font-marker">
                        Status
                      </Label>
                      <Select
                        value={set.completed ? 'completed' : 'pending'}
                        onValueChange={(value) =>
                          updateSet(index, 'completed', value === 'completed')
                        }
                      >
                        <SelectTrigger id={`status-${set.id}`} className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {set.completed && (
                    <div className="mt-2 flex items-center text-caption text-success">
                      <span>✓ Completed: <span className="font-num font-tabular">{set.reps}</span> reps × <span className="font-num font-tabular">{set.weight || 0}</span> lbs</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <Stack
          direction="row"
          align="center"
          justify="between"
          gap={3}
          className="mt-6 border-t border-border pt-4"
        >
          <p className="text-body-sm text-ink-subtle">
            {hasChanges ? 'You have unsaved changes' : 'No changes made'}
          </p>
          <Stack direction="row" gap={3}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save Changes</span>
            </Button>
          </Stack>
        </Stack>
      </SheetContent>
    </Sheet>
  );
};
