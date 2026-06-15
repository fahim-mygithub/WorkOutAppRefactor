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
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Stack } from '../ui/stack';

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
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card elevation={3} className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-title font-bold text-ink">Manage Workout History</h2>
          <IconButton
            variant="ghost"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </IconButton>
        </div>

        {confirmationStep === 'none' ? (
          <>
            {/* Controls */}
            <div className="p-6 border-b border-border">
              {/* Date Range Filter */}
              <div className="mb-4">
                <h3 className="text-body-sm font-medium text-ink-muted mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter by Date Range
                </h3>
                <div className="flex gap-3">
                  <Stack gap={1}>
                    <Label htmlFor="manager-start-date" size="sm">Start Date</Label>
                    <Input
                      id="manager-start-date"
                      type="date"
                      size="sm"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Stack>
                  <Stack gap={1}>
                    <Label htmlFor="manager-end-date" size="sm">End Date</Label>
                    <Input
                      id="manager-end-date"
                      type="date"
                      size="sm"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </Stack>
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button size="sm" onClick={exportWorkouts}>
                  <Download className="w-4 h-4" />
                  Export {selectedWorkouts.size > 0 ? `Selected (${selectedWorkouts.size})` : 'All'}
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedWorkouts.size === 0}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedWorkouts.size})
                </Button>

                <Button
                  size="sm"
                  onClick={handleDeleteByDateRange}
                  disabled={!startDate || !endDate}
                  className="bg-warning text-ink-inverse hover:bg-warning/90"
                >
                  <Calendar className="w-4 h-4" />
                  Delete Date Range
                </Button>

                <Button variant="danger" size="sm" onClick={handleDeleteAll}>
                  <AlertTriangle className="w-4 h-4" />
                  Delete All History
                </Button>
              </div>
            </div>

            {/* Workout List */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors duration-snap"
                  >
                    {selectedWorkouts.size === filteredWorkouts.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Select All
                  </button>
                </div>
                <div className="text-body-sm text-ink-muted">
                  {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''} shown
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className={`flex items-center gap-3 p-3 rounded-md border transition-colors duration-snap cursor-pointer ${
                      selectedWorkouts.has(workout.id)
                        ? 'bg-accent/10 border-accent'
                        : 'bg-surface-subtle border-border hover:bg-surface-raised'
                    }`}
                    onClick={() => handleSelectWorkout(workout.id)}
                  >
                    <div className="flex-shrink-0">
                      {selectedWorkouts.has(workout.id) ? (
                        <CheckSquare className="w-5 h-5 text-accent" />
                      ) : (
                        <Square className="w-5 h-5 text-ink-subtle" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-ink truncate">{workout.name}</h4>
                        <span className="text-body-sm text-ink-muted">{formatDate(workout.endTime)}</span>
                      </div>
                      <div className="text-body-sm text-ink-muted">
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
              <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
              <h3 className="text-body font-bold text-ink mb-4">
                {confirmationStep === 'bulk' && `Delete ${selectedWorkouts.size} Selected Workouts?`}
                {confirmationStep === 'all' && 'Delete ALL Workout History?'}
                {confirmationStep === 'range' && 'Delete Workouts in Date Range?'}
              </h3>

              {confirmationStep === 'all' ? (
                <div className="mb-6">
                  <p className="text-ink-muted mb-4">
                    This will permanently delete ALL {workouts.length} workout{workouts.length !== 1 ? 's' : ''} from your history.
                    This action cannot be undone.
                  </p>
                  <p className="text-danger text-body-sm mb-4">
                    Type "DELETE ALL WORKOUTS" to confirm:
                  </p>
                  <Input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="DELETE ALL WORKOUTS"
                    className="max-w-md mx-auto text-center"
                  />
                </div>
              ) : (
                <p className="text-ink-muted mb-6">
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

              <Stack direction="row" justify="center" gap={3}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirmationStep('none');
                    setConfirmationText('');
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => executeDelete(confirmationStep)}
                  disabled={isLoading || (confirmationStep === 'all' && confirmationText !== 'DELETE ALL WORKOUTS')}
                >
                  {isLoading ? 'Deleting...' : 'Delete Permanently'}
                </Button>
              </Stack>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
