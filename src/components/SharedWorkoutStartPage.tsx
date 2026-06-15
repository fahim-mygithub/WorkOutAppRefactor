import React from 'react';
import { Play, Users, Clock, Target, User } from 'lucide-react';
import { SharedWorkout } from '../services/sharedWorkoutService';
import { useAuth } from '../contexts/AuthContext';

interface SharedWorkoutStartPageProps {
  sharedWorkout: SharedWorkout;
  onStartWorkout: (workout: SharedWorkout) => void;
}

export const SharedWorkoutStartPage: React.FC<SharedWorkoutStartPageProps> = ({
  sharedWorkout,
  onStartWorkout
}) => {
  const { user } = useAuth();

  console.log('🏁 SharedWorkoutStartPage rendering:', {
    workoutName: sharedWorkout.workoutData.name,
    user: user?.uid || 'anonymous',
    exerciseCount: sharedWorkout.workoutData.exercises.length
  });

  const formatCreatedDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const calculateWorkoutStats = () => {
    const exercises = sharedWorkout.workoutData.exercises;
    const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0);
    const totalExercises = exercises.length;

    // Estimate duration based on sets and exercises
    const estimatedMinutes = Math.round((totalSets * 2) + (totalExercises * 1.5) + 10); // rough estimate

    return { totalExercises, totalSets, estimatedMinutes };
  };

  const stats = calculateWorkoutStats();

  return (
    <div className="min-h-full bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Ready to Start Workout?</h1>
          <p className="text-gray-400">
            You're about to start a shared workout
          </p>
        </div>

        {/* Workout Info Card */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {sharedWorkout.workoutData.name}
            </h2>
            {sharedWorkout.workoutData.description && (
              <p className="text-gray-400 text-sm">
                {sharedWorkout.workoutData.description}
              </p>
            )}
          </div>

          {/* Creator Info */}
          <div className="flex items-center justify-center space-x-2 mb-6 text-gray-300">
            <User className="w-4 h-4" />
            <span className="text-sm">Created by <span className="font-medium">{sharedWorkout.creatorName}</span></span>
            <span className="text-gray-500">•</span>
            <span className="text-sm">{formatCreatedDate(sharedWorkout.metadata.createdAt)}</span>
          </div>

          {/* Workout Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <div className="text-lg font-bold text-white">{stats.totalExercises}</div>
              <div className="text-xs text-gray-400">Exercises</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center">
                <span className="text-green-400 font-bold text-lg">×</span>
              </div>
              <div className="text-lg font-bold text-white">{stats.totalSets}</div>
              <div className="text-xs text-gray-400">Total Sets</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <div className="text-lg font-bold text-white">{stats.estimatedMinutes}m</div>
              <div className="text-xs text-gray-400">Estimated</div>
            </div>
          </div>

          {/* Popularity Stats */}
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-400 mb-6">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{sharedWorkout.metadata.viewCount} views</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <Play className="w-4 h-4" />
              <span>{sharedWorkout.metadata.useCount} uses</span>
            </div>
          </div>

          {/* Exercise Preview */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Exercises in this workout:</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sharedWorkout.workoutData.exercises.map((exercise, index) => (
                <div key={exercise.id} className="flex items-center justify-between bg-gray-700 rounded p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-white font-medium">{exercise.exercise.name}</div>
                      {exercise.isSuperset && (
                        <div className="text-xs text-purple-400">Superset</div>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Anonymous User Notice */}
          {!user && (
            <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-yellow-500 rounded-full flex-shrink-0 mt-0.5">
                  <span className="block w-full h-full rounded-full bg-yellow-500"></span>
                </div>
                <div className="text-sm">
                  <p className="text-yellow-200 font-medium mb-1">Anonymous Session</p>
                  <p className="text-yellow-300">
                    You can perform this workout, but your progress won't be saved.
                    <span className="font-medium"> Sign up to track your workouts!</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={() => onStartWorkout(sharedWorkout)}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-lg"
          >
            <Play className="w-6 h-6" />
            <span>Start Workout</span>
          </button>
        </div>

        {/* Note for authenticated users */}
        {user && (
          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Your progress will be tracked and can be saved to your profile when you finish.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};