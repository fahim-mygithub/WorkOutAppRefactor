import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WorkoutStorageService, SavedWorkout } from '../../services/workoutStorageService';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { WorkoutSummary } from '../../types/exerciseHistory';

interface PastWorkout {
  id: string;
  name: string;
  date: string;
  exercises: string[];
  workoutText: string;
}

interface PastWorkoutsProps {
  onSelectWorkout: (workoutText: string, workoutName?: string) => void;
  className?: string;
  mode?: 'autofill' | 'history'; // 'autofill' for Build page, 'history' for general past workouts
  showSavedWorkouts?: boolean; // Whether to show saved workout templates
}

export const PastWorkouts: React.FC<PastWorkoutsProps> = ({
  onSelectWorkout,
  className = '',
  mode = 'history',
  showSavedWorkouts = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load saved workouts and completed workouts from Firebase
  useEffect(() => {
    const loadWorkouts = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const promises = [];

        // Load saved workouts if requested
        if (showSavedWorkouts) {
          promises.push(WorkoutStorageService.getUserWorkouts(user.uid, 10));
        } else {
          promises.push(Promise.resolve([]));
        }

        // Load completed workouts
        promises.push(ExerciseHistoryService.getWorkoutHistory(user.uid, 10));

        const [savedWorkoutsData, completedWorkoutsData] = await Promise.all(promises);

        setSavedWorkouts(savedWorkoutsData);
        setCompletedWorkouts(completedWorkoutsData);
      } catch (error) {
        console.error('Error loading workouts for PastWorkouts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkouts();
  }, [user?.uid, showSavedWorkouts]);

  // Convert saved workouts to PastWorkout format
  const convertedSavedWorkouts: PastWorkout[] = savedWorkouts.map(workout => {
    const safeDate = workout.updatedAt ?
      (workout.updatedAt instanceof Date ? workout.updatedAt : new Date(workout.updatedAt))
      : new Date();

    return {
      id: `saved-${workout.id}`,
      name: workout.name,
      date: safeDate.toISOString().split('T')[0],
      exercises: [
        ...workout.parsedWorkout.exercises.map(ex => ex.name),
        ...workout.parsedWorkout.supersets.flat().map(ex => ex.name)
      ],
      workoutText: workout.workoutText
    };
  });

  // Convert completed workouts to PastWorkout format
  const convertedCompletedWorkouts: PastWorkout[] = completedWorkouts.map(workout => {
    // Generate workout text from the completed workout
    const workoutText = workout.exercisesSummary
      .map(exercise => {
        const avgReps = exercise.sets > 0 ? Math.round(exercise.reps / exercise.sets) : 0;
        const avgWeight = exercise.reps > 0 ? Math.round(exercise.volume / exercise.reps) : 0;
        return `${exercise.sets}x${avgReps} ${exercise.exerciseName}${avgWeight > 0 ? ` @${avgWeight}lbs` : ''}`;
      })
      .join('\n');

    const safeEndDate = workout.endTime ?
      (workout.endTime instanceof Date ? workout.endTime : new Date(workout.endTime))
      : new Date();

    return {
      id: `completed-${workout.id}`,
      name: workout.name,
      date: safeEndDate.toISOString().split('T')[0],
      exercises: workout.exercisesSummary.map(ex => ex.exerciseName),
      workoutText
    };
  });

  // Combine all workouts and sort by date (most recent first)
  const allWorkouts = [...convertedSavedWorkouts, ...convertedCompletedWorkouts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleWorkoutSelect = (workout: PastWorkout) => {
    onSelectWorkout(workout.workoutText, workout.name);
    setIsExpanded(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-white">
            {mode === 'autofill' ? 'Saved Workouts & Templates' : 'Past Workouts'}
          </h3>
          {allWorkouts.length > 0 && (
            <span className="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded">
              {allWorkouts.length} workout{allWorkouts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {!isExpanded ? (
        <div className="text-sm text-gray-400">
          {mode === 'autofill'
            ? 'Click to view your saved workouts and use them as templates'
            : 'Click to view your previous workouts and use them as templates'
          }
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-700 h-20 rounded"></div>
              ))}
            </div>
          ) : allWorkouts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium mb-2">
                {mode === 'autofill' ? 'No Saved Workouts' : 'No Past Workouts'}
              </p>
              <p className="text-sm">
                {mode === 'autofill'
                  ? 'Save some workouts to see them here'
                  : 'Complete some workouts to see them here'
                }
              </p>
            </div>
          ) : (
            <>
              {allWorkouts.map((workout) => (
                <button
                  key={workout.id}
                  onClick={() => handleWorkoutSelect(workout)}
                  className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors-smooth text-left group hover-lift btn-press"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white group-hover:text-purple-300 transition-colors">
                        {workout.name}
                      </h4>
                      {workout.id.startsWith('saved-') && (
                        <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">
                          Template
                        </span>
                      )}
                      {workout.id.startsWith('completed-') && (
                        <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">
                          Completed
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(workout.date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{workout.exercises.length} exercises</span>
                  </div>

                  <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                    {workout.exercises.slice(0, 3).map((exercise, index) => (
                      <span
                        key={index}
                        className="bg-gray-800 px-2 py-1 rounded"
                      >
                        {exercise}
                      </span>
                    ))}
                    {workout.exercises.length > 3 && (
                      <span className="bg-gray-800 px-2 py-1 rounded">
                        +{workout.exercises.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-2 text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-all-smooth hover-scale">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {mode === 'autofill' ? 'Click to autofill workout' : 'Click to use as template'}
                  </div>
                </button>
              ))}

              {(savedWorkouts.length > 0 || completedWorkouts.length > 0) && (
                <div className="mt-4 p-3 bg-gray-900/40 border border-gray-600 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                      Showing {savedWorkouts.length} template{savedWorkouts.length !== 1 ? 's' : ''}
                      {savedWorkouts.length > 0 && completedWorkouts.length > 0 ? ' and ' : ''}
                      {completedWorkouts.length > 0 && `${completedWorkouts.length} completed workout${completedWorkouts.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};