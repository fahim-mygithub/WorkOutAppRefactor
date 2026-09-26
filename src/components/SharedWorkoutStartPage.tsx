import React from 'react';
import { Play } from 'lucide-react';
import { SharedWorkout } from '../services/sharedWorkoutService';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

interface SharedWorkoutStartPageProps {
  sharedWorkout: SharedWorkout;
  onStartWorkout: (workout: SharedWorkout) => void;
}

export const SharedWorkoutStartPage: React.FC<SharedWorkoutStartPageProps> = ({
  sharedWorkout,
  onStartWorkout
}) => {
  const { user } = useAuth();

  console.log('SharedWorkoutStartPage rendering:', {
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

  const summary = [
    { value: String(stats.totalExercises), label: 'exercises' },
    { value: String(stats.totalSets), label: 'sets' },
    { value: `~${stats.estimatedMinutes}`, label: 'min' },
  ];

  return (
    <div className="min-h-full bg-surface px-4 pb-6 pt-6">
      <div className="mx-auto flex max-w-xl flex-col">
        {/* Hero: context line, display title, one sentence. */}
        <p className="text-body-sm text-ink-muted">
          Shared by <span className="text-ink">{sharedWorkout.creatorName}</span>
          {' · '}
          {formatCreatedDate(new Date(sharedWorkout.metadata.createdAt))}
        </p>
        <h1 className="mt-1 break-words font-display text-display-lg text-ink">
          {sharedWorkout.workoutData.name}
        </h1>
        {sharedWorkout.workoutData.description && (
          <p className="mt-3 max-w-[40ch] text-body text-ink-muted">
            {sharedWorkout.workoutData.description}
          </p>
        )}

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {summary.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display font-tabular text-display text-ink">{s.value}</dd>
              <dd aria-hidden="true" className="text-body-sm text-ink-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-body-sm text-accent-2">
          <span className="font-num font-tabular">{sharedWorkout.metadata.viewCount}</span> views
          {' · '}
          <span className="font-num font-tabular">{sharedWorkout.metadata.useCount}</span> uses
        </p>

        {/* Exercise preview: rows on one subtle card, hairlines between. */}
        <section aria-labelledby="shared-exercises-heading" className="mt-6 rounded-3xl bg-surface-subtle px-4 py-2">
          <h2 id="shared-exercises-heading" className="pt-2 text-body-sm font-semibold text-ink-muted">
            Exercises
          </h2>
          <ol className="max-h-64 overflow-y-auto">
            {sharedWorkout.workoutData.exercises.map((exercise, index) => (
              <li
                key={exercise.id}
                className="flex min-h-touch-min items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-5 shrink-0 text-right font-num font-tabular text-body-sm text-ink-subtle">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-body text-ink">{exercise.exercise.name}</div>
                    {exercise.isSuperset && (
                      <div className="text-caption text-accent-2">Superset</div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-body-sm text-ink-muted">
                  <span className="font-num font-tabular">{exercise.sets.length}</span> set{exercise.sets.length !== 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-6 text-body-sm text-ink-muted">
          {user
            ? 'Your sets are tracked, and you can save the session to your history when you finish.'
            : "You can do this workout without an account, but it won't be saved. Sign up to keep your history."}
        </p>

        <Button size="xl" className="mt-4" onClick={() => onStartWorkout(sharedWorkout)}>
          <Play size={20} fill="currentColor" aria-hidden="true" />
          <span>Start workout</span>
        </Button>
      </div>
    </div>
  );
};
