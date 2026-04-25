import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAuth } from '../contexts/AuthContext';
import { endWorkout, setShowCompletionModal } from '../store/slices/workoutSlice';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { Trophy, Clock, Target, TrendingUp, X, Check, Edit3 } from 'lucide-react';

interface WorkoutCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkoutCompletionModal: React.FC<WorkoutCompletionModalProps> = ({
  isOpen,
  onClose
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { activeWorkout } = useAppSelector((state) => state.workout);
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !activeWorkout) return null;

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
      return { totalSets: 0, completedSets: 0, totalVolume: 0, totalReps: 0 };
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

    return { totalSets, completedSets, totalVolume, totalReps };
  };

  const handleCompleteWorkout = async () => {
    if (!activeWorkout || !user?.uid) {
      console.error('Missing required data for workout completion');
      return;
    }

    setIsCompleting(true);
    try {
      await WorkoutStorageService.saveCompletedWorkout(user.uid, activeWorkout);
      console.log('✅ Workout saved successfully');
      dispatch(endWorkout());
      dispatch(setShowCompletionModal(false));
      navigate('/profile', { state: { showWorkoutComplete: true } });
    } catch (error) {
      console.error('❌ Error saving workout:', error);

      // Show user-friendly error message
      alert('Failed to save workout. Your progress will still be ended. Please check your connection and try again.');

      // Still end the workout even if save fails to prevent user from being stuck
      dispatch(endWorkout());
      dispatch(setShowCompletionModal(false));
      navigate('/profile');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinueEditing = () => {
    dispatch(setShowCompletionModal(false));
  };

  const stats = calculateStats();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full mx-auto relative overflow-hidden">
        {/* Confetti Effect */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 rounded animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div className="relative bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-4">
            <Trophy className="w-16 h-16 mx-auto mb-2 text-yellow-300 animate-pulse" />
            <h2 className="text-2xl font-bold mb-1">Workout Complete!</h2>
            <p className="text-green-100">Congratulations on finishing your workout</p>
          </div>
        </div>

        {/* Workout Summary */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">{activeWorkout.name}</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <div className="text-sm text-gray-400">Duration</div>
              <div className="text-lg font-bold text-white">{formatTime(activeWorkout.duration)}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <div className="text-sm text-gray-400">Sets Completed</div>
              <div className="text-lg font-bold text-white">{stats.completedSets}/{stats.totalSets}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <div className="text-sm text-gray-400">Total Reps</div>
              <div className="text-lg font-bold text-white">{stats.totalReps.toLocaleString()}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
              <div className="text-sm text-gray-400">Volume</div>
              <div className="text-lg font-bold text-white">{stats.totalVolume.toLocaleString()} lbs</div>
            </div>
          </div>

          {/* Exercises Summary */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-white mb-3">Exercises Completed</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {activeWorkout.exercises.map((exercise, index) => {
                const completedSets = exercise.sets.filter(set => set.completed).length;
                return (
                  <div key={exercise.id} className="flex justify-between items-center bg-gray-700 rounded p-2">
                    <span className="text-white text-sm">{exercise.exercise.name}</span>
                    <span className="text-gray-400 text-xs">{completedSets}/{exercise.sets.length} sets</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleContinueEditing}
              className="flex-1 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors"
            >
              <Edit3 className="w-5 h-5" />
              <span>Continue Editing</span>
            </button>

            <button
              onClick={handleCompleteWorkout}
              disabled={isCompleting}
              className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
            >
              {isCompleting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              <span>{isCompleting ? 'Saving...' : 'Complete Workout'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};