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
import { Link2 } from 'lucide-react';

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

  return (
    <Card elevation={1} className="border-2 border-accent/30 p-6">
      {/* Superset Header */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-accent px-3 py-1">
            <Link2 className="h-4 w-4 text-accent-fg" />
            <span className="text-body-sm font-medium text-accent-fg">
              Superset (<span className="font-num font-tabular">{currentSupersetIndex + 1}/{exercises.length}</span>)
            </span>
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
        <div className="mb-6">
          {currentExercise.exercise.videoLinks.length >= 2 ? (
            <DualViewVideo
              key={`superset-dual-${currentExercise.exercise.id}-${currentSupersetIndex}`}
              videoUrls={currentExercise.exercise.videoLinks}
              exerciseName={currentExercise.customTitle || currentExercise.exercise.name}
              autoPlay={true}
              muted={true}
              compact={true}
              instructions={currentExercise.exercise.instructions}
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
              instructions={currentExercise.exercise.instructions}
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
      <div className="lg:hidden">
        <RestTimer />
      </div>

      {/* Current Set Information */}
      <div className="mb-6 rounded-lg bg-surface-subtle p-4">
        <h3 className="mb-2 text-title font-semibold text-ink font-marker">
          Current Set: <span className="font-num font-tabular">{currentSetIndex + 1} / {currentExercise.sets.length}</span>
        </h3>
        <p className="mb-3 text-body-sm text-ink-subtle">
          Complete this set, then switch to the next exercise in the superset
        </p>

        {/* Current Set Details */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-md bg-surface-raised p-2">
            <p className="text-caption text-ink-subtle font-marker">Target Reps</p>
            <p className="text-title font-bold text-ink font-num font-tabular">
              {currentExercise.sets[currentSetIndex]?.reps || 0}
            </p>
          </div>
          <div className="rounded-md bg-surface-raised p-2">
            <p className="text-caption text-ink-subtle font-marker">Weight</p>
            <p className="text-title font-bold text-ink">
              <span className="font-num font-tabular">{currentExercise.sets[currentSetIndex]?.weight || 0}</span> lbs
            </p>
          </div>
          <div className="rounded-md bg-surface-raised p-2">
            <p className="text-caption text-ink-subtle font-marker">Exercise</p>
            <p className="text-body-sm font-bold text-ink font-num font-tabular">
              {currentSupersetIndex + 1}/{exercises.length}
            </p>
          </div>
        </div>
      </div>

      {/* Set Input */}
      <div className="mb-6">
        <SetInput
          set={currentExercise.sets[currentSetIndex]}
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

      {/* Other Exercises in Superset Preview */}
      {otherExercises.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-3 flex items-center text-body font-semibold text-ink font-marker">
            <span className="mr-2">Next in Superset:</span>
            <div className="h-px flex-1 bg-border"></div>
          </h4>
          <div className="space-y-2">
            {otherExercises.map((exercise) => {
              const actualIndex = exercises.findIndex(ex => ex.id === exercise.id);
              return (
                <div
                  key={exercise.id}
                  className="flex items-center justify-between rounded-lg bg-surface-subtle p-3 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised">
                      <span className="text-body-sm font-medium text-ink font-num font-tabular">{actualIndex + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-ink">{exercise.exercise.name}</p>
                      <p className="text-body-sm text-ink-subtle">
                        <span className="font-num font-tabular">{exercise.sets.length}</span> sets
                      </p>
                    </div>
                  </div>
                  <div className="text-body-sm text-ink-subtle">
                    Waiting...
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Superset Progress */}
      <div className="rounded-lg bg-surface-subtle p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-body-sm text-ink-subtle font-marker">Superset Progress</span>
          <span className="text-body-sm font-medium text-accent">
            Set <span className="font-num font-tabular">{currentSetIndex + 1}</span> of <span className="font-num font-tabular">{currentExercise.sets.length}</span>
          </span>
        </div>
        <div className="flex gap-1">
          {exercises.map((exercise, index) => (
            <div
              key={exercise.id}
              className={cn(
                'h-2 flex-1 rounded-full',
                index === currentSupersetIndex
                  ? 'bg-accent'
                  : index < currentSupersetIndex
                    ? 'bg-success'
                    : 'bg-surface-raised',
              )}
            />
          ))}
        </div>
      </div>

      {/* Exercise Instructions */}
      {currentExercise.exercise.instructions.length > 0 && (
        <div className="mt-4 rounded-lg bg-surface-subtle p-4">
          <h4 className="mb-2 text-body font-semibold text-ink font-marker">Instructions</h4>
          <ol className="space-y-1">
            {currentExercise.exercise.instructions.map((instruction, index) => (
              <li key={index} className="text-body-sm text-ink-muted">
                <span className="font-medium text-accent font-num font-tabular">{index + 1}.</span> {instruction}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
};
