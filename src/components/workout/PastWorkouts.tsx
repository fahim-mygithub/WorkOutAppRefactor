import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WorkoutStorageService, SavedWorkout } from '../../services/workoutStorageService';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Skeleton } from '@/components/ui/skeleton';

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
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-muscle-core" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-title font-medium text-ink">
            {mode === 'autofill' ? 'Saved Workouts & Templates' : 'Past Workouts'}
          </h3>
          {allWorkouts.length > 0 && (
            <span className="text-caption bg-muscle-core/15 text-muscle-core px-2 py-1 rounded">
              {allWorkouts.length} workout{allWorkouts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <IconButton
          variant="ghost"
          size="sm"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          title={isExpanded ? 'Collapse' : 'Expand'}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-smooth ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </IconButton>
      </div>

      {!isExpanded ? (
        <div className="text-body-sm text-ink-muted">
          {mode === 'autofill'
            ? 'Click to view your saved workouts and use them as templates'
            : 'Click to view your previous workouts and use them as templates'
          }
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : allWorkouts.length === 0 ? (
            <div className="text-center py-8 text-ink-muted">
              <svg className="w-12 h-12 mx-auto mb-4 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-body font-medium mb-2 text-ink">
                {mode === 'autofill' ? 'No Saved Workouts' : 'No Past Workouts'}
              </p>
              <p className="text-body-sm">
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
                  type="button"
                  onClick={() => handleWorkoutSelect(workout)}
                  className="w-full p-4 bg-surface-subtle hover:bg-surface-raised rounded-md transition-colors duration-smooth text-left group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-ink group-hover:text-accent transition-colors duration-snap">
                        {workout.name}
                      </h4>
                      {workout.id.startsWith('saved-') && (
                        <span className="text-caption bg-accent/15 text-accent px-2 py-1 rounded">
                          Template
                        </span>
                      )}
                      {workout.id.startsWith('completed-') && (
                        <span className="text-caption bg-success/15 text-success px-2 py-1 rounded">
                          Completed
                        </span>
                      )}
                    </div>
                    <span className="text-caption text-ink-subtle">
                      {formatDate(workout.date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-body-sm text-ink-muted mb-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{workout.exercises.length} exercises</span>
                  </div>

                  <div className="text-caption text-ink-subtle flex flex-wrap gap-1">
                    {workout.exercises.slice(0, 3).map((exercise, index) => (
                      <span
                        key={index}
                        className="bg-surface px-2 py-1 rounded"
                      >
                        {exercise}
                      </span>
                    ))}
                    {workout.exercises.length > 3 && (
                      <span className="bg-surface px-2 py-1 rounded">
                        +{workout.exercises.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-2 text-caption text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-smooth">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {mode === 'autofill' ? 'Click to autofill workout' : 'Click to use as template'}
                  </div>
                </button>
              ))}

              {(savedWorkouts.length > 0 || completedWorkouts.length > 0) && (
                <div className="mt-4 p-3 bg-surface-subtle border border-border rounded-md">
                  <div className="flex items-center gap-2 text-ink-muted text-body-sm">
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
    </Card>
  );
};
