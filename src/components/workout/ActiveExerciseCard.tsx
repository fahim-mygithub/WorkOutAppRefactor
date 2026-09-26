// ActiveExerciseCard — the main panel for a single (non-superset) active
// exercise: notes/title editor + nav controls, exercise video, previous
// performance, the mobile rest timer, optional weight-progression slider, the
// contextual status banner, the current-set input, the all-sets overview, and
// instructions. Extracted wholesale from WorkoutPage so the orchestrator only
// wires data + callbacks. All behavior is preserved 1:1; this is restyle +
// recompose only.
import React from 'react';
import { ChevronDown, Edit, SkipBack, SkipForward } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { DualViewVideo } from '../DualViewVideo';
import { ExerciseVideo } from '../ExerciseVideo';
import { SetInput } from '../SetInput';
import { RestTimer } from '../RestTimer';
import { PreviousPerformance } from './PreviousPerformance';
import { ExerciseNotesEditor } from './ExerciseNotesEditor';
import { WeightProgressionSlider } from './WeightProgressionSlider';
import { SetList } from './SetList';
import { WorkoutNextActionBanner } from './WorkoutNextActionBanner';
import type { WorkoutExercise, WorkoutSet } from '../../types/exercise';
import type { ExerciseHistory } from '../../types/exerciseHistory';
import type { ProgressionRecommendation } from '../../types/progression';

interface ActiveExerciseCardProps {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  totalExercises: number;
  currentSetIndex: number;
  currentSet?: WorkoutSet;
  previousPerformance: ExerciseHistory | null;
  isLoadingPrevious: boolean;
  isAnonymousUser: boolean;
  restActive: boolean;
  restTimeRemaining: number;
  // progression
  showProgressionSlider: boolean;
  recommendation?: ProgressionRecommendation | null;
  recommendedWeight?: number;
  recommendedReps?: number;
  onAcceptWeight: (weight: number) => void;
  // callbacks
  onUpdateTitle: (title: string) => void;
  onUpdateNotes: (notes: string) => void;
  onEditSets: () => void;
  onPreviousExercise: () => void;
  onNextExercise: () => void;
  onCompleteSet: (reps: number, weight: number) => void;
  onUncompleteSet: () => void;
  onJumpToSet: (index: number) => void;
  onAddSet: () => void;
}

export const ActiveExerciseCard: React.FC<ActiveExerciseCardProps> = ({
  exercise,
  exerciseIndex,
  totalExercises,
  currentSetIndex,
  currentSet,
  previousPerformance,
  isLoadingPrevious,
  isAnonymousUser,
  restActive,
  restTimeRemaining,
  showProgressionSlider,
  recommendation,
  recommendedWeight,
  recommendedReps,
  onAcceptWeight,
  onUpdateTitle,
  onUpdateNotes,
  onEditSets,
  onPreviousExercise,
  onNextExercise,
  onCompleteSet,
  onUncompleteSet,
  onJumpToSet,
  onAddSet,
}) => {
  const videoLinks = exercise.exercise.videoLinks ?? [];
  const instructions = exercise.exercise.instructions ?? [];
  const isFallback = exercise.exercise.id?.startsWith('fallback-');

  return (
    <Card elevation={1} className="p-5">
      {/* Header: notes/title editor + nav */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ExerciseNotesEditor
            exercise={exercise}
            onUpdateTitle={onUpdateTitle}
            onUpdateNotes={onUpdateNotes}
          />
        </div>
        <div className="flex shrink-0 gap-1.5">
          <IconButton
            variant="secondary"
            aria-label="Edit sets"
            title="Edit sets"
            onClick={onEditSets}
          >
            <Edit className="h-4 w-4" />
          </IconButton>
          <IconButton
            variant="secondary"
            aria-label="Previous exercise"
            onClick={onPreviousExercise}
            disabled={exerciseIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </IconButton>
          <IconButton
            variant="secondary"
            aria-label="Next exercise"
            onClick={onNextExercise}
            disabled={exerciseIndex === totalExercises - 1}
          >
            <SkipForward className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {/* Exercise Video */}
      {videoLinks.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-2xl">
          {videoLinks.length >= 2 ? (
            <DualViewVideo
              key={`workout-dual-${exercise.exercise.id}-${exerciseIndex}`}
              videoUrls={videoLinks}
              exerciseName={exercise.customTitle || exercise.exercise.name || ''}
              autoPlay
              muted
              compact
              instructions={instructions}
            />
          ) : (
            <ExerciseVideo
              key={`workout-single-${exercise.exercise.id}-${exerciseIndex}`}
              videoUrl={videoLinks[0] || ''}
              exerciseName={exercise.customTitle || exercise.exercise.name || ''}
              autoPlay
              muted
              compact
              fallbackVideoUrls={videoLinks.slice(1)}
              instructions={instructions}
            />
          )}
        </div>
      )}

      {/* Previous Performance — authenticated only */}
      {!isAnonymousUser && (
        <PreviousPerformance
          currentExercise={exercise}
          previousPerformance={
            isFallback
              ? null
              : exercise.exercise.id
                ? previousPerformance
                : null
          }
          isLoading={isLoadingPrevious && !isFallback}
        />
      )}

      {/* Rest Timer — mobile only */}
      <div className="mb-5 lg:hidden">
        <RestTimer />
      </div>

      {/* Weight Progression Slider — authenticated only */}
      {!isAnonymousUser &&
        showProgressionSlider &&
        recommendation &&
        recommendation.previousWeight &&
        recommendation.previousWeight > 0 && (
          <div className="mb-4">
            <WeightProgressionSlider
              previousWeight={recommendation.previousWeight}
              currentWeight={
                recommendation.recommendedWeight ?? recommendation.previousWeight
              }
              onWeightChange={onAcceptWeight}
              minIncrease={2.5}
              maxIncrease={10}
              action={recommendation.action}
              reasoning={recommendation.reasoning}
              deloadApplied={recommendation.deloadApplied}
            />
          </div>
        )}

      {/* Status banner */}
      <WorkoutNextActionBanner
        restActive={restActive}
        restTimeRemaining={restTimeRemaining}
        currentSetCompleted={!!currentSet?.completed}
        currentSetNumber={currentSetIndex + 1}
        hasNextSet={currentSetIndex < (exercise.sets.length || 0) - 1}
      />

      {/* Current Set */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-body-sm font-semibold text-ink-muted">
            Set{' '}
            <span className="font-display font-tabular text-title text-ink">
              {currentSetIndex + 1}
            </span>{' '}
            of{' '}
            <span className="font-num font-tabular text-ink">
              {exercise.sets.length || 0}
            </span>
          </h3>
          <div className="flex gap-1.5">
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Previous set"
              title="Previous set"
              onClick={() => onJumpToSet(Math.max(0, currentSetIndex - 1))}
              disabled={currentSetIndex === 0}
            >
              <SkipBack className="h-4 w-4" />
            </IconButton>
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Next set"
              title="Next set"
              onClick={() =>
                onJumpToSet(
                  Math.min(exercise.sets.length - 1, currentSetIndex + 1),
                )
              }
              disabled={currentSetIndex === (exercise.sets.length || 0) - 1}
            >
              <SkipForward className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <SetInput
          set={currentSet}
          onComplete={onCompleteSet}
          onUncomplete={onUncompleteSet}
          previousSet={
            currentSetIndex > 0
              ? exercise.sets?.[currentSetIndex - 1] || null
              : null
          }
          allSets={exercise.sets || []}
          recommendedWeight={recommendedWeight}
          recommendedReps={recommendedReps}
        />
      </div>

      {/* All Sets Overview */}
      <SetList
        sets={exercise.sets || []}
        currentSetIndex={currentSetIndex}
        previousPerformance={isFallback ? null : previousPerformance}
        onJumpToSet={onJumpToSet}
        onAddSet={onAddSet}
      />

      {/* Instructions — one tap away */}
      {instructions.length > 0 && (
        <details className="group mt-6 rounded-2xl bg-surface-raised/50">
          <summary
            className={cn(
              'flex min-h-touch-min cursor-pointer list-none items-center justify-between rounded-2xl px-4 text-body-sm font-semibold text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <span>How to do it</span>
            <ChevronDown
              className="h-4 w-4 text-ink-muted transition-transform duration-snap group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ol className="space-y-2 px-4 pb-4">
            {instructions.map((instruction, index) => (
              <li key={index} className="flex gap-2 text-body-sm text-ink-muted">
                <span className="font-num font-tabular font-semibold text-ink">
                  {index + 1}
                </span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Card>
  );
};
