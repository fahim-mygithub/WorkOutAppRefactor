import React from 'react';
import { WorkoutExercise } from '../types/exercise';
import { ExerciseHistory } from '../types/exerciseHistory';
import { DualViewVideo } from './DualViewVideo';
import { ExerciseVideo } from './ExerciseVideo';
import { SetInput } from './SetInput';
import { PreviousPerformance } from './workout/PreviousPerformance';
import { RestTimer } from './RestTimer';
import { ExerciseNotesEditor } from './workout/ExerciseNotesEditor';
import { SetList } from './workout/SetList';
import { useAppDispatch } from '../store/hooks';
import { updateExerciseNotesAndTitle } from '../store/slices/workoutSlice';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';
import { ChevronDown, Link2 } from 'lucide-react';

interface SupersetExerciseCardProps {
  exercises: WorkoutExercise[];
  currentSupersetIndex: number;
  currentSetIndex: number;
  onCompleteSet: (reps: number, weight: number) => void;
  onUncompleteSet: () => void;
  onJumpToSet: (setIndex: number) => void;
  onAddSet: () => void;
  previousPerformances: Record<string, ExerciseHistory | null>;
}

export const SupersetExerciseCard: React.FC<SupersetExerciseCardProps> = ({
  exercises,
  currentSupersetIndex,
  currentSetIndex,
  onCompleteSet,
  onUncompleteSet,
  onJumpToSet,
  onAddSet,
  previousPerformances
}) => {
  const dispatch = useAppDispatch();
  const currentExercise = exercises[currentSupersetIndex];
  const otherExercises = exercises.filter((_, index) => index !== currentSupersetIndex);

  const currentSet = currentExercise.sets[currentSetIndex];
  const instructions = currentExercise.exercise.instructions;

  return (
    <Card elevation={1} className="p-5">
      {/* Superset header: position in the round, then the exercise title/notes */}
      <div className="mb-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-body-sm font-semibold text-ink">
            <Link2 className="h-4 w-4 text-accent-2" aria-hidden="true" />
            Superset{' '}
            <span className="font-num font-tabular">
              {currentSupersetIndex + 1} of {exercises.length}
            </span>
          </span>
          {/* Round progress: ice = done, amber = now */}
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {exercises.map((exercise, index) => (
              <div
                key={exercise.id}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  index === currentSupersetIndex
                    ? 'bg-accent'
                    : index < currentSupersetIndex
                      ? 'bg-accent-2'
                      : 'bg-surface-raised',
                )}
              />
            ))}
          </div>
        </div>
        <ExerciseNotesEditor
          exercise={currentExercise}
          onUpdateTitle={(title) => dispatch(updateExerciseNotesAndTitle({
            exerciseId: currentExercise.id,
            customTitle: title
          }))}
          onUpdateNotes={(notes) => dispatch(updateExerciseNotesAndTitle({
            exerciseId: currentExercise.id,
            notes: notes
          }))}
        />
      </div>

      {/* Current Exercise Video */}
      {currentExercise.exercise.videoLinks.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-2xl">
          {currentExercise.exercise.videoLinks.length >= 2 ? (
            <DualViewVideo
              key={`superset-dual-${currentExercise.exercise.id}-${currentSupersetIndex}`}
              videoUrls={currentExercise.exercise.videoLinks}
              exerciseName={currentExercise.customTitle || currentExercise.exercise.name}
              autoPlay={true}
              muted={true}
              compact={true}
              instructions={instructions}
            />
          ) : (
            <ExerciseVideo
              key={`superset-single-${currentExercise.exercise.id}-${currentSupersetIndex}`}
              videoUrl={currentExercise.exercise.videoLinks[0]}
              exerciseName={currentExercise.customTitle || currentExercise.exercise.name}
              autoPlay={true}
              muted={true}
              compact={true}
              fallbackVideoUrls={currentExercise.exercise.videoLinks.slice(1)}
              instructions={instructions}
            />
          )}
        </div>
      )}

      {/* Previous Performance Display */}
      <PreviousPerformance
        currentExercise={currentExercise}
        previousPerformance={previousPerformances[currentExercise.exercise.id]}
        isLoading={false}
      />

      {/* Rest Timer - Mobile only */}
      <div className="mb-5 lg:hidden">
        <RestTimer />
      </div>

      {/* Current set: the target in numbers, then the input */}
      <div className="mb-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-body-sm font-semibold text-ink-muted">
              Set{' '}
              <span className="font-display font-tabular text-title text-ink">{currentSetIndex + 1}</span>{' '}
              of <span className="font-num font-tabular text-ink">{currentExercise.sets.length}</span>
            </h3>
            <p className="text-caption text-ink-muted">
              Do this set, then move to the next exercise in the superset.
            </p>
          </div>
          <dl className="flex shrink-0 gap-4 text-right">
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-ink-muted">target reps</dt>
              <dd className="font-display font-tabular text-title text-ink">{currentSet?.reps || 0}</dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-ink-muted">lb</dt>
              <dd className="font-display font-tabular text-title text-ink">{currentSet?.weight || 0}</dd>
            </div>
          </dl>
        </div>
        <SetInput
          set={currentSet}
          onComplete={onCompleteSet}
          onUncomplete={onUncompleteSet}
          previousSet={currentSetIndex > 0 ? currentExercise.sets[currentSetIndex - 1] : null}
          allSets={currentExercise.sets}
        />
      </div>

      {/* All Sets Overview */}
      <div className="mb-6">
        <SetList
          sets={currentExercise.sets}
          currentSetIndex={currentSetIndex}
          previousPerformance={previousPerformances[currentExercise.exercise.id]}
          onJumpToSet={onJumpToSet}
          onAddSet={onAddSet}
        />
      </div>

      {/* Rest of the superset, as quiet rows */}
      {otherExercises.length > 0 && (
        <section aria-label="Next in superset" className="mb-2">
          <h4 className="mb-1 text-body-sm font-semibold text-ink-muted">Next in superset</h4>
          <ul className="divide-y divide-hairline">
            {otherExercises.map((exercise) => {
              const actualIndex = exercises.findIndex(ex => ex.id === exercise.id);
              return (
                <li key={exercise.id} className="flex min-h-touch-min items-center gap-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised font-num font-tabular text-body-sm font-semibold text-ink-muted">
                    {actualIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-ink">{exercise.exercise.name}</p>
                    <p className="text-caption text-ink-muted">
                      <span className="font-num font-tabular">{exercise.sets.length}</span> sets
                    </p>
                  </div>
                  <span className="text-caption text-ink-subtle">Waiting</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Instructions, one tap away */}
      {instructions.length > 0 && (
        <details className="group mt-4 rounded-2xl bg-surface-raised/50">
          <summary className="flex min-h-touch-min cursor-pointer list-none items-center justify-between rounded-2xl px-4 text-body-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <span>How to do it</span>
            <ChevronDown
              className="h-4 w-4 text-ink-muted transition-transform duration-snap group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ol className="space-y-2 px-4 pb-4">
            {instructions.map((instruction, index) => (
              <li key={index} className="flex gap-2 text-body-sm text-ink-muted">
                <span className="font-num font-tabular font-semibold text-ink">{index + 1}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Card>
  );
};
