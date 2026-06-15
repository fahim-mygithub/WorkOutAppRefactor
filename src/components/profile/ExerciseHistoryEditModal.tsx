import React, { useState, useEffect } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { Save, Plus, Minus, Search } from 'lucide-react';
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

interface ExerciseHistoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  exerciseHistory: ExerciseHistory;
  exercises: Exercise[];
}

interface EditableSet {
  id: string;
  reps: number;
  weight: number;
  unit: 'lbs' | 'kg';
}

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
  const [workoutDate, setWorkoutDate] = useState(exerciseHistory.workoutDate.split('T')[0]);
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

  const updateSet = (setId: string, field: keyof EditableSet, value: any) => {
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
      <SheetContent className="max-w-2xl mx-auto">
        {/* Header */}
        <SheetTitle className="text-title mb-4">Edit Exercise Entry</SheetTitle>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Exercise Selection */}
          <Stack gap={2}>
            <Label htmlFor="history-edit-exercise" required>
              Exercise
            </Label>
            <div className="relative">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle" />
                <Input
                  id="history-edit-exercise"
                  type="text"
                  placeholder="Search for an exercise..."
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
                  className="pl-10"
                  required
                />
              </div>

              {/* Exercise Dropdown */}
              {showExerciseDropdown && filteredExercises.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-surface-raised border border-border rounded-md shadow-e3 max-h-60 overflow-y-auto">
                  {filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleExerciseSelect(exercise)}
                      className="w-full text-left px-4 py-3 hover:bg-surface-subtle transition-colors duration-snap"
                    >
                      <div className="text-ink font-medium">{exercise.name}</div>
                      <div className="text-body-sm text-ink-muted">
                        {exercise.muscleGroups.join(', ')} • {exercise.equipment}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Stack>

          {/* Workout Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Stack gap={2}>
              <Label htmlFor="history-edit-date" required>
                Workout Date
              </Label>
              <Input
                id="history-edit-date"
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </Stack>

            <Stack gap={2}>
              <Label htmlFor="history-edit-name">Workout Name</Label>
              <Input
                id="history-edit-name"
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
            <Label htmlFor="history-edit-notes">Notes (Optional)</Label>
            <Textarea
              id="history-edit-notes"
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
              disabled={isLoading || !exerciseName}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-accent-fg border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </form>
      </SheetContent>
    </Sheet>
  );
};
