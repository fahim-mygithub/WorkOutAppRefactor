import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WorkoutStorageService, SavedWorkout } from '../../services/workoutStorageService';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { WorkoutSummary } from '../../types/exerciseHistory';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
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

  const title = mode === 'autofill' ? 'Saved and past workouts' : 'Past workouts';

  return (
    <Card className={className}>
      {/* The whole header row is the disclosure toggle. */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex min-h-touch-lg w-full items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="min-w-0">
          <span className="block text-body font-semibold text-ink">{title}</span>
          <span className="block text-body-sm text-ink-muted">
            {isLoading
              ? 'Loading'
              : allWorkouts.length > 0
                ? `${allWorkouts.length} to start from`
                : mode === 'autofill'
                  ? 'Reuse one as a starting point'
                  : 'Use a previous workout as a template'}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-ink-muted transition-transform duration-smooth ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-2">
          {isLoading ? (
            <div className="space-y-2 pb-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : allWorkouts.length === 0 ? (
            <div className="pb-4 pt-1">
              <p className="text-body font-semibold text-ink">
                {mode === 'autofill' ? 'No saved workouts yet' : 'No past workouts yet'}
              </p>
              <p className="mt-1 text-body-sm text-ink-muted">
                {mode === 'autofill'
                  ? 'Save a workout and it shows up here.'
                  : 'Finish a workout and it shows up here.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {allWorkouts.map((workout) => {
                const kind = workout.id.startsWith('saved-') ? 'Template' : 'Completed';
                return (
                  <li key={workout.id}>
                    <button
                      type="button"
                      onClick={() => handleWorkoutSelect(workout)}
                      aria-label={`${mode === 'autofill' ? 'Autofill' : 'Use'} ${workout.name}`}
                      className="group flex w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink group-hover:text-accent">
                          {workout.name}
                        </span>
                        <span className="block truncate text-body-sm text-ink-muted">
                          <span className={kind === 'Completed' ? 'text-accent-2' : undefined}>{kind}</span>
                          {' · '}
                          <span className="font-tabular">{workout.exercises.length}</span> exercise{workout.exercises.length !== 1 ? 's' : ''}
                          {' · '}
                          <span className="font-tabular">{formatDate(workout.date)}</span>
                        </span>
                        {workout.exercises.length > 0 && (
                          <span className="mt-0.5 block truncate text-caption text-ink-subtle">
                            {workout.exercises.slice(0, 3).join(', ')}
                            {workout.exercises.length > 3 && ` +${workout.exercises.length - 3}`}
                          </span>
                        )}
                      </span>
                      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};
