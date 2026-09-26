import React, { useState, useEffect } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Search } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { SetListEditor, type EditableSetRow } from './SetListEditor';
import { toIsoString } from './historyFormat';

interface ExerciseHistoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  exerciseHistory: ExerciseHistory;
  exercises: Exercise[];
}

type EditableSet = EditableSetRow;

export const ExerciseHistoryEditModal: React.FC<ExerciseHistoryEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  exerciseHistory,
  exercises
}) => {
  const [exerciseName, setExerciseName] = useState(exerciseHistory.exerciseName);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState(exerciseHistory.exerciseName);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(toIsoString(exerciseHistory.workoutDate).split('T')[0]);
  const [workoutName, setWorkoutName] = useState(exerciseHistory.workoutName || '');
  const [notes, setNotes] = useState(exerciseHistory.notes || '');
  const [sets, setSets] = useState<EditableSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize sets from exercise history
  useEffect(() => {
    if (exerciseHistory) {
      const editableSets = exerciseHistory.sets.map((set, index) => ({
        id: `${index}-${set.weight}-${set.actualReps}`,
        reps: set.actualReps,
        weight: set.weight,
        unit: set.unit || 'lbs'
      }));
      setSets(editableSets);

      // Find matching exercise in database
      const matchingExercise = exercises.find(ex => ex.name === exerciseHistory.exerciseName);
      if (matchingExercise) {
        setSelectedExercise(matchingExercise);
      }
    }
  }, [exerciseHistory, exercises]);

  // Filter exercises based on search term
  const filteredExercises = React.useMemo(() => {
    if (!exerciseSearchTerm) return exercises.slice(0, 20);

    const searchTerm = exerciseSearchTerm.toLowerCase();
    return exercises
      .filter(exercise =>
        exercise.name.toLowerCase().includes(searchTerm) ||
        exercise.muscleGroups.some(muscle => muscle.toLowerCase().includes(searchTerm)) ||
        exercise.equipment.toLowerCase().includes(searchTerm)
      )
      .slice(0, 10);
  }, [exercises, exerciseSearchTerm]);

  const handleExerciseSelect = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setExerciseName(exercise.name);
    setExerciseSearchTerm(exercise.name);
    setShowExerciseDropdown(false);
  };

  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    const newSet: EditableSet = {
      id: Date.now().toString(),
      reps: lastSet?.reps || 10,
      weight: lastSet?.weight || 0,
      unit: lastSet?.unit || 'lbs'
    };
    setSets([...sets, newSet]);
  };

  const removeSet = (setId: string) => {
    if (sets.length > 1) {
      setSets(sets.filter(set => set.id !== setId));
    }
  };

  const updateSet = <K extends keyof EditableSet>(setId: string, field: K, value: EditableSet[K]) => {
    setSets(sets.map(set =>
      set.id === setId ? { ...set, [field]: value } : set
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!exerciseName || sets.length === 0 || !userId) {
      return;
    }

    setIsLoading(true);

    try {
      // Convert editable sets to PerformedSet format
      const performedSets = sets.map((set) => ({
        targetReps: set.reps,
        actualReps: set.reps,
        weight: set.weight,
        unit: set.unit,
        rest: 120, // Default rest time
        completed: true,
        timestamp: new Date(workoutDate).toISOString()
      }));

      // Update the exercise history
      await ExerciseHistoryService.updateExerciseHistory(userId, exerciseHistory.id, {
        exerciseName,
        sets: performedSets,
        muscleGroups: selectedExercise?.muscleGroups || exerciseHistory.muscleGroups,
        equipment: selectedExercise?.equipment || exerciseHistory.equipment,
        notes: notes || undefined,
        workoutName: workoutName || undefined,
        workoutDate
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating exercise history:', error);
      alert('Failed to update exercise. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="mx-auto max-w-lg">
        <SheetTitle className="text-title">Edit entry</SheetTitle>
        <SheetDescription>Correct the exercise, date or sets for this log.</SheetDescription>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-6">
          {/* Exercise picker */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="history-edit-exercise" required className="text-ink-muted">
              Exercise
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <Input
                id="history-edit-exercise"
                type="text"
                placeholder="Search exercises"
                value={exerciseSearchTerm}
                onChange={(e) => {
                  setExerciseSearchTerm(e.target.value);
                  setExerciseName(e.target.value);
                  setShowExerciseDropdown(true);
                  if (!e.target.value) {
                    setSelectedExercise(null);
                  }
                }}
                onFocus={() => setShowExerciseDropdown(true)}
                className="pl-11 font-sans"
                autoComplete="off"
                required
              />

              {showExerciseDropdown && filteredExercises.length > 0 && (
                <div className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-surface-raised py-1 shadow-e3">
                  {filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleExerciseSelect(exercise)}
                      className="flex min-h-touch-min w-full flex-col justify-center px-4 py-2 text-left transition-colors duration-snap hover:bg-surface-subtle/60 focus-visible:bg-surface-subtle/60 focus-visible:outline-none"
                    >
                      <span className="text-body font-semibold text-ink">{exercise.name}</span>
                      <span className="text-body-sm text-ink-muted">
                        {exercise.muscleGroups.join(', ')} · {exercise.equipment}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* When + where */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="history-edit-date" required className="text-ink-muted">
                Date
              </Label>
              <Input
                id="history-edit-date"
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="history-edit-name" className="text-ink-muted">
                Workout name
              </Label>
              <Input
                id="history-edit-name"
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="e.g. Push day"
                className="font-sans"
              />
            </div>
          </div>

          <SetListEditor sets={sets} onAdd={addSet} onRemove={removeSet} onUpdate={updateSet} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="history-edit-notes" className="text-ink-muted">
              Notes (optional)
            </Label>
            <Textarea
              id="history-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="xl" disabled={isLoading || !exerciseName}>
              {isLoading ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
