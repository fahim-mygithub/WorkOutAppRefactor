import React, { useState, useMemo } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Search } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { SetListEditor, type EditableSetRow } from './SetListEditor';

interface ManualExerciseLoggerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  exercises: Exercise[];
  isLoadingExercises?: boolean;
  exerciseError?: string | null;
}

type ManualSet = EditableSetRow;

export const ManualExerciseLogger: React.FC<ManualExerciseLoggerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  exercises,
  isLoadingExercises = false,
  exerciseError = null
}) => {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutName, setWorkoutName] = useState('Manual Entry');
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState<ManualSet[]>([
    { id: '1', reps: 10, weight: 0, unit: 'lbs' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);

  // Filter exercises based on search term
  const filteredExercises = useMemo(() => {
    // Return empty array if exercises is not available
    if (!exercises || !Array.isArray(exercises)) {
      console.warn('Exercises array is not available:', exercises);
      return [];
    }

    if (!exerciseSearchTerm) return exercises.slice(0, 20); // Show first 20 exercises

    const searchTerm = exerciseSearchTerm.toLowerCase();
    return exercises
      .filter(exercise => {
        try {
          // Add null safety checks for all exercise properties
          return (
            (exercise?.name?.toLowerCase().includes(searchTerm)) ||
            (exercise?.muscleGroups && Array.isArray(exercise.muscleGroups) &&
              exercise.muscleGroups.some(muscle => muscle?.toLowerCase().includes(searchTerm))) ||
            (exercise?.equipment?.toLowerCase().includes(searchTerm))
          );
        } catch (error) {
          console.error('Error filtering exercise:', exercise, error);
          return false;
        }
      })
      .slice(0, 10); // Limit to 10 results for performance
  }, [exercises, exerciseSearchTerm]);

  const handleExerciseSelect = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setExerciseSearchTerm(exercise.name);
    setShowExerciseDropdown(false);
  };

  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    const newSet: ManualSet = {
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

  const updateSet = <K extends keyof ManualSet>(setId: string, field: K, value: ManualSet[K]) => {
    setSets(sets.map(set =>
      set.id === setId ? { ...set, [field]: value } : set
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedExercise || sets.length === 0 || !userId) {
      return;
    }

    setIsLoading(true);

    // Convert manual sets to PerformedSet format (moved outside try block)
    const performedSets = sets.map((set) => ({
      targetReps: set.reps,
      actualReps: set.reps,
      weight: set.weight,
      unit: set.unit,
      rest: 120, // Default rest time
      completed: true,
      timestamp: new Date(workoutDate).toISOString()
    }));

    // Validate and prepare exercise data
    const muscleGroups = Array.isArray(selectedExercise.muscleGroups)
      ? selectedExercise.muscleGroups.filter(muscle => muscle && muscle.trim())
      : [];

    const equipment = selectedExercise.equipment || 'Unknown';

    try {
      // Save the exercise performance
      await ExerciseHistoryService.saveExercisePerformance(userId, {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        workoutName: workoutName || 'Manual Entry',
        workoutDate: workoutDate,
        sets: performedSets,
        muscleGroups: muscleGroups,
        equipment: equipment,
        notes: notes.trim() || undefined
      });

      // Reset form
      setSelectedExercise(null);
      setExerciseSearchTerm('');
      setWorkoutDate(new Date().toISOString().split('T')[0]);
      setWorkoutName('Manual Entry');
      setNotes('');
      setSets([{ id: '1', reps: 10, weight: 0, unit: 'lbs' }]);

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving manual exercise:', error);
      console.error('Exercise data being saved:', {
        exerciseId: selectedExercise?.id,
        exerciseName: selectedExercise?.name,
        workoutDate,
        sets: performedSets,
        muscleGroups: muscleGroups,
        equipment: equipment
      });

      const errorMessage = error?.message || 'Failed to save exercise. Please try again.';
      alert(`Failed to save exercise: ${errorMessage}`);
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
        <SheetTitle className="text-title">Log an exercise</SheetTitle>
        <SheetDescription>Add a set you did outside a tracked session.</SheetDescription>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-6">
          {/* Exercise picker */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-exercise-search" required className="text-ink-muted">
              Exercise
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <Input
                id="manual-exercise-search"
                type="text"
                placeholder="Search exercises"
                value={exerciseSearchTerm}
                onChange={(e) => {
                  setExerciseSearchTerm(e.target.value);
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

              {showExerciseDropdown && (
                <div className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-surface-raised py-1 shadow-e3">
                  {filteredExercises && filteredExercises.length > 0 ? (
                    filteredExercises.map((exercise) => (
                      <button
                        key={exercise?.id || exercise?.name || Math.random()}
                        type="button"
                        onClick={() => handleExerciseSelect(exercise)}
                        className="flex min-h-touch-min w-full flex-col justify-center px-4 py-2 text-left transition-colors duration-snap hover:bg-surface-subtle/60 focus-visible:bg-surface-subtle/60 focus-visible:outline-none"
                      >
                        <span className="text-body font-semibold text-ink">{exercise?.name || 'Unknown exercise'}</span>
                        <span className="text-body-sm text-ink-muted">
                          {exercise?.muscleGroups ? exercise.muscleGroups.join(', ') : 'Unknown muscles'} · {exercise?.equipment || 'Unknown equipment'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-body-sm text-ink-muted">
                      {exerciseError ? (
                        <div className="text-danger">
                          <div>Couldn’t load exercises</div>
                          <div className="mt-1 text-caption">{exerciseError}</div>
                        </div>
                      ) : isLoadingExercises || !exercises || exercises.length === 0 ? (
                        'Loading exercises…'
                      ) : exerciseSearchTerm ? (
                        `No exercises match "${exerciseSearchTerm}"`
                      ) : (
                        'No exercises available'
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* When + where */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="manual-workout-date" required className="text-ink-muted">
                Date
              </Label>
              <Input
                id="manual-workout-date"
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="manual-workout-name" className="text-ink-muted">
                Workout name
              </Label>
              <Input
                id="manual-workout-name"
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
            <Label htmlFor="manual-notes" className="text-ink-muted">
              Notes (optional)
            </Label>
            <Textarea
              id="manual-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="xl" disabled={isLoading || !selectedExercise}>
              {isLoading ? 'Saving…' : 'Save exercise'}
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
