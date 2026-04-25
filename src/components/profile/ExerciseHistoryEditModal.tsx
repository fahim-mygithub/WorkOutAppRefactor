import React, { useState, useEffect } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { X, Save, Plus, Minus, Search } from 'lucide-react';

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

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Edit Exercise Entry</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Exercise Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Exercise *
            </label>
            <div className="relative">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
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
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Exercise Dropdown */}
              {showExerciseDropdown && filteredExercises.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => handleExerciseSelect(exercise)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-600 transition-colors"
                    >
                      <div className="text-white font-medium">{exercise.name}</div>
                      <div className="text-sm text-gray-400">
                        {exercise.muscleGroups.join(', ')} • {exercise.equipment}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Workout Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Workout Date *
              </label>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Workout Name
              </label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="e.g., Push Day, Home Workout"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Sets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">
                Sets *
              </label>
              <button
                type="button"
                onClick={addSet}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add Set</span>
              </button>
            </div>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div key={set.id} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                  <span className="text-gray-300 font-medium min-w-12 text-sm">
                    Set {index + 1}:
                  </span>

                  <input
                    type="number"
                    placeholder="Reps"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(set.id, 'reps', parseInt(e.target.value) || 0)}
                    min="1"
                    max="999"
                    className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />

                  <span className="text-gray-400 text-sm">reps @</span>

                  <input
                    type="number"
                    placeholder="Weight"
                    value={set.weight || ''}
                    onChange={(e) => updateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.5"
                    className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />

                  <select
                    value={set.unit}
                    onChange={(e) => updateSet(set.id, 'unit', e.target.value as 'lbs' | 'kg')}
                    className="px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>

                  {sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(set.id)}
                      className="p-1 text-red-600 hover:text-red-800 ml-auto"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this exercise..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !exerciseName}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};