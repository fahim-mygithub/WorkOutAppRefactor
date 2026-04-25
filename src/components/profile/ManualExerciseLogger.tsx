import React, { useState, useMemo } from 'react';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { X, Plus, Minus, Save, Search } from 'lucide-react';

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
    const performedSets = sets.map((set, index) => ({
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
          <h2 className="text-xl font-bold text-white">Log Manual Exercise</h2>
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
              {showExerciseDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredExercises && filteredExercises.length > 0 ? (
                    filteredExercises.map((exercise) => (
                      <button
                        key={exercise?.id || exercise?.name || Math.random()}
                        type="button"
                        onClick={() => handleExerciseSelect(exercise)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-600 transition-colors"
                      >
                        <div className="text-white font-medium">{exercise?.name || 'Unknown Exercise'}</div>
                        <div className="text-sm text-gray-400">
                          {exercise?.muscleGroups ? exercise.muscleGroups.join(', ') : 'Unknown muscles'} • {exercise?.equipment || 'Unknown equipment'}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-gray-400">
                      {exerciseError ? (
                        <div className="text-red-400">
                          <div>Error loading exercises</div>
                          <div className="text-xs mt-1">{exerciseError}</div>
                        </div>
                      ) : isLoadingExercises || !exercises || exercises.length === 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
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
              disabled={isLoading || !selectedExercise}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isLoading ? 'Saving...' : 'Save Exercise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};