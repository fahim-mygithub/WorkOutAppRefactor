// WorkoutListView — non-interactive scrollable list view for the workout screen (Tempo).
// Displays all exercises for the workout in a single scrollable page, with inline steppers
// per set, collapsed summary rows for completed sets, superset badges, and in-session cue strips.
import React, { useState } from 'react';
import { Check, Replace, Pencil, History, Link2, BookOpen } from 'lucide-react';
import type { WorkoutExercise, ActiveWorkout } from '../../../types/exercise';
import type { ExerciseHistory } from '../../../types/exerciseHistory';
import type { InSessionDecision } from '@/types/progression';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Modal, ModalContent, ModalTitle, ModalDescription } from '@/components/ui/modal';
import { SetInput } from '../../SetInput';
import { InSessionSuggestion } from '../player/InSessionSuggestion';
import { cn } from '@/lib/utils';

export interface WorkoutListViewProps {
  workout: ActiveWorkout;
  previousPerformances?: Record<string, ExerciseHistory | null>;
  appliedWeights?: Record<string, number>;
  suggestion?: {
    exerciseIndex: number;
    setIndex: number;
    decision: InSessionDecision;
  } | null;
  onCompleteSet: (
    exerciseIndex: number,
    setIndex: number,
    reps: number,
    weight: number,
    rir?: number,
  ) => void;
  onUncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  onApplySuggestion?: (weight: number, exerciseId: string) => void;
  onKeepSuggestion?: () => void;
  onEditSets?: (exercise: WorkoutExercise) => void;
  onChangeExercise?: (exercise: WorkoutExercise) => void;
  onAskCoach?: (exercise: WorkoutExercise) => void;
  recommendations?: Record<string, { recommendedWeight?: number; recommendedReps?: number }>;
}

export const WorkoutListView: React.FC<WorkoutListViewProps> = ({
  workout,
  previousPerformances,
  appliedWeights,
  suggestion,
  onCompleteSet,
  onUncompleteSet,
  onApplySuggestion,
  onKeepSuggestion,
  onEditSets,
  onChangeExercise,
  onAskCoach,
  recommendations,
}) => {
  // Sets that the lifter has tapped to reopen for editing or undoing
  const [reopenedSets, setReopenedSets] = useState<Set<string>>(() => new Set());
  // Instructions modal target exercise
  const [selectedInstructions, setSelectedInstructions] = useState<WorkoutExercise | null>(null);

  const toggleReopenSet = (key: string) => {
    setReopenedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const exercises = workout.exercises ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 pt-2 space-y-4 [scrollbar-width:none]">
      {exercises.map((exercise, exerciseIndex) => {
        const title = exercise.customTitle || exercise.exercise.name;
        const sets = exercise.sets ?? [];
        const completedSets = sets.filter((s) => s.completed).length;

        // Superset partners in this workout
        const supersetPartners =
          exercise.isSuperset && exercise.supersetId
            ? exercises
                .filter((ex) => ex.supersetId === exercise.supersetId && ex.id !== exercise.id)
                .map((ex) => ex.customTitle || ex.exercise.name)
            : [];

        // Previous performance readout
        const prevPerf = previousPerformances?.[exercise.exercise.id] || null;
        const lastSets = prevPerf?.sets ?? [];
        const lastLine = lastSets
          .map((s) => (s.weight > 0 ? `${s.weight}×${s.actualReps}` : `${s.actualReps} reps`))
          .join(', ');

        const instructions = exercise.exercise.instructions ?? [];
        const overrideWeight = appliedWeights?.[exercise.exercise.id];
        const rec = recommendations?.[exercise.exercise.id];

        return (
          <Card
            key={exercise.id || exerciseIndex}
            id={`workout-exercise-${exerciseIndex}`}
            data-exercise-index={exerciseIndex}
            elevation={1}
            className="p-4 space-y-3"
          >
            {/* Header: name, progress, action buttons */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-num font-tabular text-body-sm font-semibold text-accent-2">
                  {completedSets} of {sets.length} sets done
                </p>
                <h2 className="mt-0.5 line-clamp-2 text-title font-bold text-ink">
                  {title}
                </h2>
                {supersetPartners.length > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-body-sm text-ink-muted">
                    <Link2 size={14} aria-hidden="true" className="text-accent-2" />
                    Superset with {supersetPartners.join(' + ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {onChangeExercise && (
                  <IconButton
                    variant="secondary"
                    size="sm"
                    aria-label={`Change exercise ${title}`}
                    onClick={() => onChangeExercise(exercise)}
                  >
                    <Replace size={16} />
                  </IconButton>
                )}
                {onEditSets && (
                  <IconButton
                    variant="secondary"
                    size="sm"
                    aria-label={`Edit sets for ${title}`}
                    onClick={() => onEditSets(exercise)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                )}
              </div>
            </div>

            {/* Context row: Last time + How to */}
            <div className="flex items-center justify-between gap-2 text-body-sm text-ink-muted">
              <p className="flex min-w-0 items-center gap-1.5">
                <History size={14} className="shrink-0" aria-hidden="true" />
                {lastLine ? (
                  <span className="truncate">
                    Last time <span className="font-num font-tabular text-ink">{lastLine}</span>
                  </span>
                ) : (
                  <span>First time. Today sets your baseline.</span>
                )}
              </p>
              {instructions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedInstructions(exercise)}
                  className="inline-flex shrink-0 items-center gap-1 text-caption font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                  aria-label={`How to perform ${title}`}
                >
                  <BookOpen size={13} aria-hidden="true" />
                  How to
                </button>
              )}
            </div>

            {/* Sets list */}
            <div className="space-y-2.5 pt-1">
              {sets.map((set, setIndex) => {
                const setKey = `${exercise.id || exerciseIndex}-s-${setIndex}`;
                const isReopened = reopenedSets.has(setKey);
                const isCompleted = set.completed;
                const hasSuggestion =
                  suggestion &&
                  suggestion.exerciseIndex === exerciseIndex &&
                  suggestion.setIndex === setIndex;

                const hasWeight = (set.weight ?? 0) > 0;
                const summaryText = hasWeight ? `${set.reps}×${set.weight} ✓` : `${set.reps} reps ✓`;

                return (
                  <div key={set.id || setIndex} className="space-y-1.5">
                    {isCompleted && !isReopened ? (
                      /* Collapsed summary row */
                      <button
                        type="button"
                        aria-label={`Set ${setIndex + 1}: ${summaryText} completed, tap to edit`}
                        onClick={() => toggleReopenSet(setKey)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-2xl bg-accent-2/10 px-4 py-3 text-body-sm font-semibold text-accent-2 transition-colors hover:bg-accent-2/15',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-2 text-accent-2-fg">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                          </span>
                          <span className="text-body font-medium text-ink">Set {setIndex + 1}</span>
                        </div>
                        <span className="font-num font-tabular text-body font-semibold text-accent-2">
                          {summaryText}
                        </span>
                      </button>
                    ) : isCompleted && isReopened ? (
                      /* Reopened completed set */
                      <div className="space-y-1.5 rounded-2xl bg-surface-raised/20 p-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-caption font-semibold text-ink-muted">
                            Set {setIndex + 1} (logged)
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReopenSet(setKey)}
                            className="text-caption font-semibold text-ink-muted hover:text-ink rounded px-1"
                          >
                            Collapse
                          </button>
                        </div>
                        <SetInput
                          compact
                          set={set}
                          onComplete={(reps, weight, rir) => {
                            onCompleteSet(exerciseIndex, setIndex, reps, weight, rir);
                            setReopenedSets((prev) => {
                              const next = new Set(prev);
                              next.delete(setKey);
                              return next;
                            });
                          }}
                          onUncomplete={() => {
                            onUncompleteSet(exerciseIndex, setIndex);
                            setReopenedSets((prev) => {
                              const next = new Set(prev);
                              next.delete(setKey);
                              return next;
                            });
                          }}
                          previousSet={setIndex > 0 ? sets[setIndex - 1] ?? null : null}
                          allSets={sets}
                          recommendedWeight={rec?.recommendedWeight}
                          overrideWeight={overrideWeight}
                          recommendedReps={rec?.recommendedReps}
                        />
                      </div>
                    ) : (
                      /* Uncompleted set stepper */
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="font-num font-tabular text-body-sm font-semibold text-accent-2">
                            Set {setIndex + 1} of {sets.length}
                          </span>
                        </div>
                        <SetInput
                          compact
                          set={set}
                          onComplete={(reps, weight, rir) => {
                            onCompleteSet(exerciseIndex, setIndex, reps, weight, rir);
                          }}
                          onUncomplete={() => {
                            onUncompleteSet(exerciseIndex, setIndex);
                          }}
                          previousSet={setIndex > 0 ? sets[setIndex - 1] ?? null : null}
                          allSets={sets}
                          recommendedWeight={rec?.recommendedWeight}
                          overrideWeight={overrideWeight}
                          recommendedReps={rec?.recommendedReps}
                        />
                      </div>
                    )}

                    {/* In-session cue strip under the set just logged */}
                    {hasSuggestion && (
                      <div className="mt-2">
                        <InSessionSuggestion
                          decision={suggestion.decision}
                          onApply={(w) => onApplySuggestion?.(w, exercise.exercise.id)}
                          onKeep={() => onKeepSuggestion?.()}
                          onAskCoach={onAskCoach ? () => onAskCoach(exercise) : undefined}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* Instructions Modal */}
      {selectedInstructions && (
        <Modal open={true} onOpenChange={(open) => !open && setSelectedInstructions(null)}>
          <ModalContent>
            <div className="px-5 pb-2 pt-5">
              <ModalTitle className="text-title">
                {selectedInstructions.customTitle || selectedInstructions.exercise.name}
              </ModalTitle>
              <ModalDescription>How to perform this exercise</ModalDescription>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 pb-5 pt-2">
              <ol className="space-y-3">
                {selectedInstructions.exercise.instructions?.map((step, i) => (
                  <li key={i} className="flex gap-3 text-body-sm text-ink-muted">
                    <span className="font-num font-tabular font-bold text-accent-2">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
};
