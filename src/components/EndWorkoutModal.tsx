import React, { useState } from 'react';
import { Clock, Target, TrendingUp, Trophy, AlertTriangle, Save, X, ArrowLeft } from 'lucide-react';
import { ActiveWorkout } from '../types/exercise';

interface EndWorkoutModalProps {
  isOpen: boolean;
  activeWorkout: ActiveWorkout;
  onClose: () => void;
  onEndWithoutSaving: () => void;
  onSaveAndEnd: () => void;
  isAnonymousUser?: boolean;
  isSharedWorkout?: boolean;
}

export const EndWorkoutModal: React.FC<EndWorkoutModalProps> = ({
  isOpen,
  activeWorkout,
  onClose,
  onEndWithoutSaving,
  onSaveAndEnd,
  isAnonymousUser = false,
  isSharedWorkout = false
}) => {
  const [isEnding, setIsEnding] = useState(false);

  if (!isOpen) return null;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const calculateStats = () => {
    if (!activeWorkout || !activeWorkout.exercises) {
      return { totalSets: 0, completedSets: 0, totalVolume: 0, totalReps: 0, completionPercentage: 0 };
    }

    const totalSets = activeWorkout.exercises.reduce((total, ex) => total + (ex.sets?.length || 0), 0);
    const completedSets = activeWorkout.exercises.reduce((total, ex) =>
      total + (ex.sets?.filter(set => set.completed).length || 0), 0
    );
    const totalVolume = activeWorkout.exercises.reduce((total, ex) =>
      total + (ex.sets || [])
        .filter(set => set.completed)
        .reduce((setTotal, set) => setTotal + ((set.weight || 0) * (set.reps || 0)), 0), 0
    );
    const totalReps = activeWorkout.exercises.reduce((total, ex) =>
      total + (ex.sets || [])
        .filter(set => set.completed)
        .reduce((setTotal, set) => setTotal + (set.reps || 0), 0), 0
    );
    const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    return { totalSets, completedSets, totalVolume, totalReps, completionPercentage };
  };

  const handleEndWithoutSaving = async () => {
    setIsEnding(true);
    try {
      await onEndWithoutSaving();
    } finally {
      setIsEnding(false);
    }
  };

  const handleSaveAndEnd = async () => {
    setIsEnding(true);
    try {
      await onSaveAndEnd();
    } finally {
      setIsEnding(false);
    }
  };

  const stats = calculateStats();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full mx-auto relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">End Workout</h2>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-200 text-sm mt-1">Choose how you'd like to finish your workout</p>
        </div>

        {/* Workout Summary */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{activeWorkout.name}</h3>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-blue-400" />
              <div className="text-xs text-gray-400">Duration</div>
              <div className="text-sm font-bold text-white">{formatTime(activeWorkout.duration)}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <Target className="w-5 h-5 mx-auto mb-1 text-green-400" />
              <div className="text-xs text-gray-400">Sets Complete</div>
              <div className="text-sm font-bold text-white">{stats.completedSets}/{stats.totalSets}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-purple-400" />
              <div className="text-xs text-gray-400">Total Reps</div>
              <div className="text-sm font-bold text-white">{stats.totalReps.toLocaleString()}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
              <div className="text-xs text-gray-400">Volume</div>
              <div className="text-sm font-bold text-white">{stats.totalVolume.toLocaleString()} lbs</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Workout Progress</span>
              <span>{stats.completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isAnonymousUser ? (
              // Anonymous user buttons
              <>
                {/* End Session (only option for anonymous users) */}
                <button
                  onClick={handleEndWithoutSaving}
                  disabled={isEnding}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                  <span>End Session</span>
                </button>

                {/* Anonymous user notice */}
                <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3">
                  <p className="text-yellow-200 text-xs text-center">
                    💡 Sign up to save your workout progress and track your fitness journey!
                  </p>
                </div>

                {/* Continue Workout */}
                <button
                  onClick={onClose}
                  disabled={isEnding}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Continue Workout</span>
                </button>
              </>
            ) : (
              // Authenticated user buttons
              <>
                {/* Save and End */}
                <button
                  onClick={handleSaveAndEnd}
                  disabled={isEnding}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                >
                  {isEnding ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  <span>{isEnding ? 'Saving...' : 'Save to Profile'}</span>
                </button>

                {/* End Without Saving */}
                <button
                  onClick={handleEndWithoutSaving}
                  disabled={isEnding}
                  className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span>End Without Saving</span>
                </button>

                {/* Warning text for end without saving */}
                <p className="text-xs text-gray-400 text-center">
                  ⚠️ Ending without saving will lose all workout progress
                </p>

                {/* Continue Workout */}
                <button
                  onClick={onClose}
                  disabled={isEnding}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Continue Workout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};