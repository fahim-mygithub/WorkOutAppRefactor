import React, { useState, useEffect } from 'react';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import {
  X,
  Trash2,
  Calendar,
  CheckSquare,
  Square,
  AlertTriangle,
  Download,
  Filter,
  RotateCcw
} from 'lucide-react';

interface WorkoutHistoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onHistoryUpdated: () => void;
  userId: string;
  initialWorkouts: WorkoutSummary[];
}

export const WorkoutHistoryManager: React.FC<WorkoutHistoryManagerProps> = ({
  isOpen,
  onClose,
  onHistoryUpdated,
  userId,
  initialWorkouts
}) => {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>(initialWorkouts);
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState<'none' | 'bulk' | 'all' | 'range'>('none');
  const [confirmationText, setConfirmationText] = useState('');

  useEffect(() => {
    setWorkouts(initialWorkouts);
    setSelectedWorkouts(new Set());
  }, [initialWorkouts]);

  const formatDate = (date: Date | string): string => {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(dateObj);
    } catch {
      return 'Invalid Date';
    }
  };

  const handleSelectAll = () => {
    if (selectedWorkouts.size === workouts.length) {
      setSelectedWorkouts(new Set());
    } else {
      setSelectedWorkouts(new Set(workouts.map(w => w.id)));
    }
  };

  const handleSelectWorkout = (workoutId: string) => {
    const newSelected = new Set(selectedWorkouts);
    if (newSelected.has(workoutId)) {
      newSelected.delete(workoutId);
    } else {
      newSelected.add(workoutId);
    }
    setSelectedWorkouts(newSelected);
  };

  const filterWorkoutsByDateRange = (): WorkoutSummary[] => {
    if (!startDate && !endDate) return workouts;

    return workouts.filter(workout => {
      const workoutDate = new Date(workout.endTime);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && workoutDate < start) return false;
      if (end && workoutDate > end) return false;
      return true;
    });
  };

  const handleBulkDelete = () => {
    if (selectedWorkouts.size === 0) return;
    setConfirmationStep('bulk');
  };

  const handleDeleteAll = () => {
    setConfirmationStep('all');
  };

  const handleDeleteByDateRange = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    setConfirmationStep('range');
  };

  const executeDelete = async (type: 'bulk' | 'all' | 'range') => {
    setIsLoading(true);
    try {
      switch (type) {
        case 'bulk':
          if (selectedWorkouts.size === 0) return;
          await ExerciseHistoryService.deleteMultipleWorkouts(userId, Array.from(selectedWorkouts));
          break;

        case 'all':
          if (confirmationText !== 'DELETE ALL WORKOUTS') {
            alert('Please type "DELETE ALL WORKOUTS" to confirm');
            return;
          }
          await ExerciseHistoryService.clearAllWorkoutHistory(userId);
          break;

        case 'range':
          if (!startDate || !endDate) return;
          await ExerciseHistoryService.clearWorkoutHistoryByDateRange(
            userId,
            new Date(startDate),
            new Date(endDate)
          );
          break;
      }

      setConfirmationStep('none');
      setConfirmationText('');
      setSelectedWorkouts(new Set());
      onHistoryUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting workouts:', error);
      alert('Failed to delete workouts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportWorkouts = () => {
    const dataToExport = selectedWorkouts.size > 0
      ? workouts.filter(w => selectedWorkouts.has(w.id))
      : workouts;

    const exportData = {
      exportDate: new Date().toISOString(),
      totalWorkouts: dataToExport.length,
      workouts: dataToExport.map(workout => ({
        name: workout.name,
        date: workout.endTime,
        duration: workout.duration,
        exercises: workout.totalExercises,
        sets: workout.totalSets,
        reps: workout.totalReps,
        volume: workout.totalVolume,
        notes: workout.notes,
        exerciseBreakdown: workout.exercisesSummary
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const filteredWorkouts = filterWorkoutsByDateRange();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Manage Workout History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {confirmationStep === 'none' ? (
          <>
            {/* Controls */}
            <div className="p-6 border-b border-gray-700">
              {/* Date Range Filter */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter by Date Range
                </h3>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportWorkouts}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export {selectedWorkouts.size > 0 ? `Selected (${selectedWorkouts.size})` : 'All'}
                </button>

                <button
                  onClick={handleBulkDelete}
                  disabled={selectedWorkouts.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedWorkouts.size})
                </button>

                <button
                  onClick={handleDeleteByDateRange}
                  disabled={!startDate || !endDate}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Delete Date Range
                </button>

                <button
                  onClick={handleDeleteAll}
                  className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Delete All History
                </button>
              </div>
            </div>

            {/* Workout List */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {selectedWorkouts.size === filteredWorkouts.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Select All
                  </button>
                </div>
                <div className="text-sm text-gray-400">
                  {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''} shown
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedWorkouts.has(workout.id)
                        ? 'bg-blue-900/30 border-blue-600'
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-650'
                    }`}
                    onClick={() => handleSelectWorkout(workout.id)}
                  >
                    <div className="flex-shrink-0">
                      {selectedWorkouts.has(workout.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-white truncate">{workout.name}</h4>
                        <span className="text-sm text-gray-400">{formatDate(workout.endTime)}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {workout.totalExercises} exercises • {workout.totalSets} sets • {workout.totalVolume.toLocaleString()} lbs
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Confirmation Step */
          <div className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-4">
                {confirmationStep === 'bulk' && `Delete ${selectedWorkouts.size} Selected Workouts?`}
                {confirmationStep === 'all' && 'Delete ALL Workout History?'}
                {confirmationStep === 'range' && 'Delete Workouts in Date Range?'}
              </h3>

              {confirmationStep === 'all' ? (
                <div className="mb-6">
                  <p className="text-gray-300 mb-4">
                    This will permanently delete ALL {workouts.length} workout{workouts.length !== 1 ? 's' : ''} from your history.
                    This action cannot be undone.
                  </p>
                  <p className="text-red-400 text-sm mb-4">
                    Type "DELETE ALL WORKOUTS" to confirm:
                  </p>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="DELETE ALL WORKOUTS"
                    className="w-full max-w-md px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              ) : (
                <p className="text-gray-300 mb-6">
                  {confirmationStep === 'bulk' &&
                    `This will permanently delete ${selectedWorkouts.size} selected workout${selectedWorkouts.size !== 1 ? 's' : ''}.`
                  }
                  {confirmationStep === 'range' &&
                    `This will permanently delete all workouts between ${formatDate(startDate)} and ${formatDate(endDate)}.`
                  }
                  <br />
                  This action cannot be undone.
                </p>
              )}

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setConfirmationStep('none');
                    setConfirmationText('');
                  }}
                  disabled={isLoading}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executeDelete(confirmationStep)}
                  disabled={isLoading || (confirmationStep === 'all' && confirmationText !== 'DELETE ALL WORKOUTS')}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {isLoading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};