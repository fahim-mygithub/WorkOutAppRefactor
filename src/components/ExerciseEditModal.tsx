import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { WorkoutExercise, WorkoutSet } from '../types/exercise';

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

  if (!isOpen || !exercise) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
          <div className="flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Edit Exercise
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {exercise.exercise.name}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {hasChanges && (
                  <button
                    onClick={handleReset}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Reset changes"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Rest Time */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rest Time (seconds)
                </label>
                <input
                  type="number"
                  value={restTime}
                  onChange={(e) => setRestTime(parseInt(e.target.value) || 0)}
                  className="w-32 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  step="15"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {Math.floor(restTime / 60)}:{(restTime % 60).toString().padStart(2, '0')} minutes
                </p>
              </div>

              {/* Sets */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-white">Sets</h4>
                  <button
                    onClick={addSet}
                    className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Set</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {sets.map((set, index) => (
                    <div key={set.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-white">Set {index + 1}</h5>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => duplicateSet(index)}
                            className="p-1 text-gray-400 hover:text-white transition-colors text-sm"
                            title="Duplicate set"
                          >
                            Copy
                          </button>
                          {sets.length > 1 && (
                            <button
                              onClick={() => removeSet(index)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                              title="Remove set"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Reps
                          </label>
                          <input
                            type="number"
                            value={set.reps}
                            onChange={(e) => updateSet(index, 'reps', parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white focus:ring-2 focus:ring-blue-500"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Weight (lbs)
                          </label>
                          <input
                            type="number"
                            value={set.weight || 0}
                            onChange={(e) => updateSet(index, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white focus:ring-2 focus:ring-blue-500"
                            min="0"
                            step="0.5"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Status
                          </label>
                          <select
                            value={set.completed ? 'completed' : 'pending'}
                            onChange={(e) => updateSet(index, 'completed', e.target.value === 'completed')}
                            className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      {set.completed && (
                        <div className="mt-2 flex items-center text-xs text-green-400">
                          <span>✓ Completed: {set.reps} reps × {set.weight || 0} lbs</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-700 px-6 py-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">
                  {hasChanges ? 'You have unsaved changes' : 'No changes made'}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition duration-200"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};