import React, { useState, useMemo } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Plus, Minus, Save, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Stack } from '../ui/stack';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface ManualExerciseLoggerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  exercises: Exercise[];
  isLoadingExercises?: boolean;
  exerciseError?: string | null;
}

interface ManualSet {
  id: string;
  reps: number;
  weight: number;
  unit: 'lbs' | 'kg';
}

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

  const updateSet = (setId: string, field: keyof ManualSet, value: any) => {
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
      <SheetContent className="max-w-2xl mx-auto">
        {/* Header */}
        <SheetTitle className="text-title mb-4">Log Manual Exercise</SheetTitle>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Exercise Selection */}
          <Stack gap={2}>
            <Label htmlFor="manual-exercise-search" required>
              Exercise
            </Label>
            <div className="relative">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle" />
                <Input
                  id="manual-exercise-search"
                  type="text"
                  placeholder="Search for an exercise..."
                  value={exerciseSearchTerm}
                  onChange={(e) => {
                    setExerciseSearchTerm(e.target.value);
                    setShowExerciseDropdown(true);
                    if (!e.target.value) {
                      setSelectedExercise(null);
                    }
                  }}
                  onFocus={() => setShowExerciseDropdown(true)}
                  className="pl-10"
                  required
                />
              </div>

              {/* Exercise Dropdown */}
              {showExerciseDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-surface-raised border border-border rounded-md shadow-e3 max-h-60 overflow-y-auto">
                  {filteredExercises && filteredExercises.length > 0 ? (
                    filteredExercises.map((exercise) => (
                      <button
                        key={exercise?.id || exercise?.name || Math.random()}
                        type="button"
                        onClick={() => handleExerciseSelect(exercise)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-subtle transition-colors duration-snap"
                      >
                        <div className="text-ink font-medium">{exercise?.name || 'Unknown Exercise'}</div>
                        <div className="text-body-sm text-ink-muted">
                          {exercise?.muscleGroups ? exercise.muscleGroups.join(', ') : 'Unknown muscles'} • {exercise?.equipment || 'Unknown equipment'}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-ink-muted">
                      {exerciseError ? (
                        <div className="text-danger">
                          <div>Error loading exercises</div>
                          <div className="text-caption mt-1">{exerciseError}</div>
                        </div>
                      ) : isLoadingExercises || !exercises || exercises.length === 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-ink-subtle border-t-transparent rounded-full animate-spin"></div>
                          Loading exercises...
                        </div>
                      ) : exerciseSearchTerm ? (
                        `No exercises found matching "${exerciseSearchTerm}"`
                      ) : (
                        'No exercises available'
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Stack>

          {/* Workout Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Stack gap={2}>
              <Label htmlFor="manual-workout-date" required>
                Workout Date
              </Label>
              <Input
                id="manual-workout-date"
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </Stack>

            <Stack gap={2}>
              <Label htmlFor="manual-workout-name">Workout Name</Label>
              <Input
                id="manual-workout-name"
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="e.g., Push Day, Home Workout"
              />
            </Stack>
          </div>

          {/* Sets */}
          <div>
            <Stack direction="row" align="center" justify="between" className="mb-3">
              <Label>Sets *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addSet}
                className="text-accent"
              >
                <Plus className="w-4 h-4" />
                Add Set
              </Button>
            </Stack>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div key={set.id} className="flex items-center gap-3 p-3 bg-surface-subtle rounded-md">
                  <span className="text-ink-muted font-medium min-w-12 text-body-sm">
                    Set {index + 1}:
                  </span>

                  <Input
                    type="number"
                    placeholder="Reps"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(set.id, 'reps', parseInt(e.target.value) || 0)}
                    min="1"
                    max="999"
                    size="sm"
                    className="w-20"
                    required
                  />

                  <span className="text-ink-muted text-body-sm">reps @</span>

                  <Input
                    type="number"
                    placeholder="Weight"
                    value={set.weight || ''}
                    onChange={(e) => updateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.5"
                    size="sm"
                    className="w-20"
                    required
                  />

                  <Select
                    value={set.unit}
                    onValueChange={(value) => updateSet(set.id, 'unit', value as 'lbs' | 'kg')}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lbs">lbs</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>

                  {sets.length > 1 && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove set ${index + 1}`}
                      onClick={() => removeSet(set.id)}
                      className="text-danger ml-auto"
                    >
                      <Minus className="w-4 h-4" />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <Stack gap={2}>
            <Label htmlFor="manual-notes">Notes (Optional)</Label>
            <Textarea
              id="manual-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this exercise..."
              rows={3}
              className="resize-none"
            />
          </Stack>

          {/* Submit Button */}
          <Stack direction="row" justify="end" gap={3} className="pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedExercise}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-accent-fg border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? 'Saving...' : 'Save Exercise'}
            </Button>
          </Stack>
        </form>
      </SheetContent>
    </Sheet>
  );
};
