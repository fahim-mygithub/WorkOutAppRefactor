import React, { useState, useEffect } from 'react';
import { ExerciseHistory } from '../../types/exerciseHistory';
import { Exercise } from '../../types/exercise';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { ExerciseHistoryEditModal } from './ExerciseHistoryEditModal';
import { X, Edit, Trash2, Calendar, Weight, BarChart3, Trophy, Plus } from 'lucide-react';

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  configuration: string;
  key: string;
  entries: ExerciseHistory[];
  lastPerformed: string;
  timesPerformed: number;
  maxWeight: number;
  totalVolume: number;
  avgVolume: number;
  hasPersonalRecords: boolean;
}

interface ExerciseHistoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  userId: string;
  exerciseGroup: ExerciseGroup;
  exercises: Exercise[];
}

export const ExerciseHistoryDetailModal: React.FC<ExerciseHistoryDetailModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  userId,
  exerciseGroup,
  exercises
}) => {
  const [detailedEntries, setDetailedEntries] = useState<ExerciseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExerciseHistory | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load detailed entries when modal opens
  useEffect(() => {
    if (isOpen && exerciseGroup) {
      loadDetailedEntries();
    }
  }, [isOpen, exerciseGroup, userId]);

  const loadDetailedEntries = async () => {
    setIsLoading(true);
    try {
      const entries = await ExerciseHistoryService.getExerciseHistory(userId, {
        exerciseName: exerciseGroup.exerciseName,
        configuration: exerciseGroup.configuration,
        limit: 50
      });
      setDetailedEntries(entries);
    } catch (error) {
      console.error('Error loading detailed exercise history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (entry: ExerciseHistory) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (entry: ExerciseHistory) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${entry.exerciseName} entry from ${new Date(entry.workoutDate).toLocaleDateString()}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await ExerciseHistoryService.deleteExerciseHistory(userId, entry.id);

      // Refresh the entries
      await loadDetailedEntries();

      // Refresh the parent component
      onRefresh();

      // If this was the last entry, close the modal
      if (detailedEntries.length <= 1) {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting exercise history:', error);
      alert('Failed to delete exercise entry. Please try again.');
    }
  };

  const handleEditSuccess = async () => {
    setIsEditModalOpen(false);
    setEditingEntry(null);

    // Refresh the entries
    await loadDetailedEntries();

    // Refresh the parent component
    onRefresh();
  };

  const formatDate = (dateString: string): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const formatWeight = (weight: number, unit: string = 'lbs'): string => {
    return `${weight} ${unit}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-white">
                {exerciseGroup.exerciseName}
              </h2>
              <p className="text-blue-400 font-medium">
                {exerciseGroup.configuration}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="p-6 border-b border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{exerciseGroup.timesPerformed}</div>
                <div className="text-gray-400 text-sm">Times Performed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{formatWeight(exerciseGroup.maxWeight)}</div>
                <div className="text-gray-400 text-sm">Max Weight</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{exerciseGroup.totalVolume.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">Total Volume</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{exerciseGroup.avgVolume.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">Avg Volume</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-700 h-24 rounded-lg"></div>
                ))}
              </div>
            ) : detailedEntries.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-100">
                    Performance History ({detailedEntries.length} entries)
                  </h3>
                </div>

                {detailedEntries.map((entry) => (
                  <div key={entry.id} className="bg-gray-700 rounded-lg p-4">
                    {/* Entry Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-white">
                              {formatDate(entry.workoutDate)}
                            </span>
                            {entry.personalRecords && Object.keys(entry.personalRecords).length > 0 && (
                              <Trophy className="h-4 w-4 text-yellow-500" aria-label="Personal Record" />
                            )}
                          </div>
                          {entry.workoutName && (
                            <div className="text-sm text-gray-400">
                              Workout: {entry.workoutName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-600 rounded transition-colors"
                          title="Edit entry"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-600 rounded transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Sets Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Sets & Reps</h4>
                        <div className="space-y-1">
                          {entry.sets.map((set, setIndex) => (
                            <div key={setIndex} className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Set {setIndex + 1}:</span>
                              <span className="text-gray-200">
                                {set.actualReps} reps × {formatWeight(set.weight, set.unit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Total Volume:</span>
                          <span className="text-gray-200">{entry.totalVolume?.toLocaleString() ?? '0'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Max Weight:</span>
                          <span className="text-gray-200">
                            {formatWeight(Math.max(...entry.sets.map(s => s.weight)), entry.sets[0]?.unit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Total Reps:</span>
                          <span className="text-gray-200">
                            {entry.sets.reduce((total, set) => total + set.actualReps, 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <div className="mt-3 p-2 bg-gray-600 rounded text-sm">
                        <span className="text-gray-400">Notes: </span>
                        <span className="text-gray-300">{entry.notes}</span>
                      </div>
                    )}

                    {/* Personal Records */}
                    {entry.personalRecords && Object.keys(entry.personalRecords).length > 0 && (
                      <div className="mt-3 p-2 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-600/30 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-400">Personal Records</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          {entry.personalRecords?.maxWeight && (
                            <div className="text-yellow-300">
                              Weight PR: {formatWeight(entry.personalRecords.maxWeight.weight ?? 0)}
                            </div>
                          )}
                          {entry.personalRecords?.maxReps && (
                            <div className="text-blue-300">
                              Reps PR: {entry.personalRecords.maxReps.reps ?? 0} reps
                            </div>
                          )}
                          {entry.personalRecords?.maxVolume && (
                            <div className="text-green-300">
                              Volume PR: {entry.personalRecords.maxVolume.volume?.toLocaleString() ?? '0'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  No entries found
                </h3>
                <p className="text-gray-400">
                  No performance history available for this exercise configuration.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <ExerciseHistoryEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingEntry(null);
          }}
          onSuccess={handleEditSuccess}
          userId={userId}
          exerciseHistory={editingEntry}
          exercises={exercises}
        />
      )}
    </>
  );
};