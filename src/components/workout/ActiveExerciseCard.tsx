// ActiveExerciseCard — the main panel for a single (non-superset) active
// exercise: notes/title editor + nav controls, exercise video, previous
// performance, the mobile rest timer, optional weight-progression slider, the
// contextual status banner, the current-set input, the all-sets overview, and
// instructions. Extracted wholesale from WorkoutPage so the orchestrator only
// wires data + callbacks. All behavior is preserved 1:1; this is restyle +
// recompose only.
import React from 'react';
import { Edit, SkipBack, SkipForward } from 'lucide-react';
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
    <Card elevation={1} className="p-6">
      {/* Header: notes/title editor + nav */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex-1">
          <ExerciseNotesEditor
            exercise={exercise}
            onUpdateTitle={onUpdateTitle}
            onUpdateNotes={onUpdateNotes}
          />
        </div>
        <div className="ml-4 flex gap-2">
          <IconButton
            variant="primary"
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
        <div className="mb-6">
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
      <div className="lg:hidden">
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
          <h3 className="font-marker text-title text-ink">
            Current set{' '}
            <span className="font-num font-tabular text-accent">
              {currentSetIndex + 1}
            </span>
            <span className="text-ink-subtle"> / </span>
            <span className="font-num font-tabular">
              {exercise.sets.length || 0}
            </span>
          </h3>
          <div className="flex gap-2">
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Previous set"
              title="Previous Set"
              onClick={() => onJumpToSet(Math.max(0, currentSetIndex - 1))}
              disabled={currentSetIndex === 0}
            >
              <SkipBack className="h-4 w-4" />
            </IconButton>
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Next set"
              title="Next Set"
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

      {/* Instructions */}
      {instructions.length > 0 && (
        <div className={cn('mt-6 rounded-lg bg-surface-subtle p-6')}>
          <h3 className="mb-3 font-marker text-title text-ink">
            <span className="marker-underline">Instructions</span>
          </h3>
          <ol className="space-y-2">
            {instructions.map((instruction, index) => (
              <li key={index} className="text-body-sm text-ink-muted">
                <span className="font-num font-bold text-accent">
                  {index + 1}.
                </span>{' '}
                {instruction}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
};
