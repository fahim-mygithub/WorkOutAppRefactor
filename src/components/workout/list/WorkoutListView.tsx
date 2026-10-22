import React, { useState } from 'react';
import { Check, Replace, Pencil, BookOpen, MessageCircle, Minus, Plus } from 'lucide-react';
import type { WorkoutExercise, ActiveWorkout } from '../../../types/exercise';
import type { ExerciseHistory } from '../../../types/exerciseHistory';
import type { InSessionDecision } from '@/types/progression';
import { IconButton } from '@/components/ui/icon-button';
import { Modal, ModalContent, ModalTitle, ModalDescription } from '@/components/ui/modal';
import { prescribedFloor } from '@/lib/progression/setPrescription';
import {
  groupWorkoutCards,
  getExerciseTag,
  WEIGHT_STEP,
  nudgeWeight,
  nudgeReps,
  nudgeTime,
} from './workoutCardUtils';
import './ledger.css';
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
  onUpdateSet?: (
    exerciseIndex: number,
    setIndex: number,
    reps: number,
    weight: number,
    time?: number,
  ) => void;
  onStartRest?: (duration: number) => void;
  onApplySuggestion?: (weight: number, exerciseId: string) => void;
  onKeepSuggestion?: () => void;
  onEditSets?: (exercise: WorkoutExercise) => void;
  onChangeExercise?: (exercise: WorkoutExercise) => void;
  onAskCoach?: (exercise: WorkoutExercise) => void;
  onFocusExercise?: (exerciseIndex: number) => void;
  recommendations?: Record<string, { recommendedWeight?: number; recommendedReps?: number }>;
}

export const WorkoutListView: React.FC<WorkoutListViewProps> = ({
  workout,
  appliedWeights,
  onCompleteSet,
  onUncompleteSet,
  onUpdateSet,
  onStartRest,
  onEditSets,
  onChangeExercise,
  onAskCoach,
  onFocusExercise,
  recommendations,
}) => {
  // Key of the currently open line for editing: `${cardId}-${lineIndex}`
  const [openLineKey, setOpenLineKey] = useState<string | null>(null);

  // Per-line edits: key -> { reps: number; weight: number; time?: number }
  const [lineEdits, setLineEdits] = useState<Record<string, { reps: number; weight: number; time?: number }>>({});

  // Instructions modal target exercise
  const [selectedInstructions, setSelectedInstructions] = useState<WorkoutExercise | null>(null);

  const exercises = workout.exercises ?? [];
  const cardGroups = groupWorkoutCards(exercises);

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-28 pt-2 space-y-3 [scrollbar-width:none]">
        {cardGroups.map((card, cardIndex) => {
          // Flatten lines: interleave sets across exercises in this card
          const maxSets = Math.max(
            ...card.exercises.map((e) => e.sets?.length ?? 0),
            0,
          );

          const lines: Array<{
            exercise: WorkoutExercise;
            exerciseIndex: number;
            setIndex: number;
            set: WorkoutExercise['sets'][number];
            side: number;
            tag: string;
            lineKey: string;
            currentReps: number;
            currentWeight: number;
            currentTime: number;
            unit: string;
            isTimed: boolean;
            isCompleted: boolean;
          }> = [];

          for (let round = 0; round < maxSets; round++) {
            card.exercises.forEach((ex, exInCardIdx) => {
              const set = ex.sets?.[round];
              if (!set) return;

              const exerciseIndex = card.exerciseIndices[exInCardIdx];
              const lineKey = `${ex.id || exerciseIndex}-s-${set.id || round}`;
              const isTimed = set.time != null && set.time > 0;

              // Resolve initial weight & reps
              let defaultWeight = 0;
              if (set.completed && set.weight !== undefined) {
                defaultWeight = set.weight;
              } else if (appliedWeights?.[ex.exercise.id] !== undefined) {
                defaultWeight = appliedWeights[ex.exercise.id];
              } else if (set.weight && set.weight > 0) {
                defaultWeight = set.weight;
              } else if (recommendations?.[ex.exercise.id]?.recommendedWeight !== undefined) {
                defaultWeight = recommendations[ex.exercise.id].recommendedWeight!;
              }

              let defaultReps = 8;
              if (isTimed) {
                defaultReps = set.reps ?? 0;
              } else if (set.completed && set.reps !== undefined) {
                defaultReps = set.reps;
              } else if (recommendations?.[ex.exercise.id]?.recommendedReps !== undefined) {
                defaultReps = recommendations[ex.exercise.id].recommendedReps!;
              } else if (set.reps !== undefined && set.reps > 0) {
                defaultReps = prescribedFloor(set);
              }

              const defaultTime = set.time ?? 0;

              const edited = lineEdits[lineKey];
              const currentReps = edited?.reps ?? defaultReps;
              const currentWeight = edited?.weight ?? defaultWeight;
              const currentTime = edited?.time ?? defaultTime;

              lines.push({
                exercise: ex,
                exerciseIndex,
                setIndex: round,
                set,
                side: exInCardIdx === 0 ? 0 : 1,
                tag: getExerciseTag(exInCardIdx),
                lineKey,
                currentReps,
                currentWeight,
                currentTime,
                unit: set.unit || 'lbs',
                isTimed,
                isCompleted: Boolean(set.completed),
              });
            });
          }

          const isCardDone = lines.length > 0 && lines.every((l) => l.isCompleted);

          const handleToggleLine = (lineKey: string) => {
            setOpenLineKey((prev) => (prev === lineKey ? null : lineKey));
          };

          const handleUpdateLine = (
            lineKey: string,
            exerciseIndex: number,
            setIndex: number,
            newReps: number,
            newWeight: number,
            isCompleted: boolean,
            newTime?: number,
          ) => {
            setLineEdits((prev) => ({
              ...prev,
              [lineKey]: {
                reps: newReps,
                weight: newWeight,
                ...(newTime !== undefined ? { time: newTime } : {}),
              },
            }));

            if (onUpdateSet) {
              onUpdateSet(exerciseIndex, setIndex, newReps, newWeight, newTime);
            } else if (isCompleted) {
              onCompleteSet(exerciseIndex, setIndex, newReps, newWeight, undefined);
            }
          };

          const handleLogCard = () => {
            if (lines.length === 0) return;
            setOpenLineKey(null);
            if (isCardDone) {
              // Undo all sets in this card
              lines.forEach((line) => {
                onUncompleteSet(line.exerciseIndex, line.setIndex);
              });
            } else {
              // Complete all not-yet-completed sets in this card in order
              lines.forEach((line) => {
                if (!line.isCompleted) {
                  onCompleteSet(
                    line.exerciseIndex,
                    line.setIndex,
                    line.currentReps,
                    line.currentWeight,
                    undefined,
                  );
                }
              });

              // Start exactly one rest timer using the first exercise's restTime
              const restDuration = card.firstExercise.restTime || 120;
              onStartRest?.(restDuration);
            }
          };

          return (
            <section
              key={card.id || cardIndex}
              id={`workout-card-${cardIndex}`}
              data-exercise-index={card.firstExerciseIndex}
              onPointerDownCapture={() => onFocusExercise?.(card.firstExerciseIndex)}
              onFocusCapture={() => onFocusExercise?.(card.firstExerciseIndex)}
              className={cn(
                'shrink-0 rounded-[22px] p-4 transition-colors duration-smooth',
                isCardDone
                  ? 'bg-surface/50 border border-accent-2/20'
                  : 'bg-surface-subtle border border-hairline/20',
              )}
            >
              {/* Card Header: title(s) + compact action buttons */}
              <div className="flex flex-col gap-1.5 pb-2.5 px-0.5">
                {card.exercises.map((ex, exInCardIdx) => {
                  const exTitle = ex.customTitle || ex.exercise.name;
                  const exerciseIndex = card.exerciseIndices[exInCardIdx];
                  const shapeClass = exInCardIdx === 0 ? 'rounded-full' : 'rounded-[3px]';

                  return (
                    <div
                      key={ex.id || exerciseIndex}
                      id={`workout-exercise-${exerciseIndex}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {card.isSuperset && (
                          <span
                            className={cn('shrink-0 w-2.5 h-2.5 bg-accent-2', shapeClass)}
                            aria-hidden="true"
                          />
                        )}
                        <h2
                          className={cn(
                            'text-[17px] font-extrabold font-display leading-tight truncate',
                            isCardDone ? 'text-accent-2' : 'text-ink',
                          )}
                        >
                          {exTitle}
                        </h2>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {ex.exercise.instructions && ex.exercise.instructions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedInstructions(ex)}
                            className="inline-flex items-center gap-1 text-caption font-semibold text-ink-muted hover:text-ink px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            aria-label={`How to perform ${exTitle}`}
                          >
                            <BookOpen size={13} aria-hidden="true" />
                            How to
                          </button>
                        )}
                        {onAskCoach && (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label={`Ask coach about ${exTitle}`}
                            onClick={() => {
                              onFocusExercise?.(exerciseIndex);
                              onAskCoach(ex);
                            }}
                          >
                            <MessageCircle size={15} />
                          </IconButton>
                        )}
                        {onChangeExercise && (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label={`Change exercise ${exTitle}`}
                            onClick={() => {
                              onFocusExercise?.(exerciseIndex);
                              onChangeExercise(ex);
                            }}
                          >
                            <Replace size={15} />
                          </IconButton>
                        )}
                        {onEditSets && (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit sets for ${exTitle}`}
                            onClick={() => {
                              onFocusExercise?.(exerciseIndex);
                              onEditSets(ex);
                            }}
                          >
                            <Pencil size={15} />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ledger Lines */}
              <div className="space-y-0">
                {lines.map((ln, lineIdx) => {
                  const isOpen = openLineKey === ln.lineKey;
                  const showRail = lineIdx < lines.length - 1;
                  const setNumber = ln.setIndex + 1;
                  const isWeighted = ln.currentWeight > 0;
                  const exTitle = ln.exercise.customTitle || ln.exercise.exercise.name;

                  // Label for accessibility (includes Information + tag in supersets)
                  const tagPrefix = card.isSuperset ? `${ln.tag} (${exTitle}): ` : '';
                  const accessibleLabel = ln.isTimed
                    ? `${tagPrefix}Set ${setNumber}: ${ln.currentTime} seconds. Tap to edit.`
                    : isWeighted
                      ? `${tagPrefix}Set ${setNumber}: ${ln.currentReps} reps, ${ln.currentWeight} ${ln.unit}. Tap to edit.`
                      : `${tagPrefix}Set ${setNumber}: ${ln.currentReps} reps. Tap to edit.`;

                  const nodeShape = ln.side === 0 ? 'rounded-full' : 'rounded-[4px]';

                  return (
                    <div key={ln.lineKey}>
                      <div className="flex items-stretch">
                        {/* Rail + Node */}
                        <div
                          className="shrink-0 w-[30px] flex flex-col items-center select-none"
                          aria-hidden="true"
                        >
                          <span
                            className={cn(
                              'mt-[15px] w-[18px] h-[18px] box-border flex items-center justify-center shrink-0 relative z-10 transition-colors duration-snap',
                              nodeShape,
                              ln.isCompleted
                                ? 'bg-accent-2 border-2 border-accent-2 text-surface'
                                : isOpen
                                  ? 'bg-surface-subtle border-2 border-accent ring-4 ring-accent/20'
                                  : 'bg-surface-subtle border-2 border-ink-subtle/50',
                            )}
                          >
                            {ln.isCompleted && (
                              <Check className="w-2.5 h-2.5 stroke-[4]" aria-hidden="true" />
                            )}
                          </span>
                          {showRail && (
                            <span
                              className={cn(
                                'flex-1 w-[2px] min-h-[8px] -mb-[15px] transition-colors duration-smooth',
                                isCardDone ? 'bg-accent-2/50' : 'bg-surface-raised',
                              )}
                            />
                          )}
                        </div>

                        {/* Line Button */}
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            aria-label={accessibleLabel}
                            aria-expanded={isOpen}
                            onClick={() => {
                              onFocusExercise?.(ln.exerciseIndex);
                              handleToggleLine(ln.lineKey);
                            }}
                            className={cn(
                              'w-full min-h-[48px] flex items-baseline border-0 bg-transparent py-3 text-left cursor-pointer transition-transform active:scale-[0.985]',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg',
                            )}
                          >
                            {card.isSuperset && (
                              <span className="shrink-0 w-6 text-caption font-bold text-ink-subtle truncate mr-1.5">
                                {ln.tag}
                              </span>
                            )}

                            {ln.isTimed ? (
                              <span
                                className={cn(
                                  'shrink-0 flex items-baseline gap-1',
                                  isCardDone ? 'text-accent-2' : 'text-ink',
                                )}
                              >
                                <span className="text-[22px] font-extrabold font-num font-tabular tracking-tight leading-none">
                                  {ln.currentTime}
                                </span>
                                <span className="text-[13px] font-semibold opacity-70">Sec</span>
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'shrink-0 flex items-baseline gap-1',
                                  isCardDone ? 'text-accent-2' : 'text-ink',
                                )}
                              >
                                <span className="text-[22px] font-extrabold font-num font-tabular tracking-tight leading-none">
                                  {ln.currentReps}
                                </span>
                                <span className="text-[13px] font-semibold opacity-70">Reps</span>
                              </span>
                            )}

                            {isWeighted && !ln.isTimed && (
                              <>
                                <span
                                  className={cn(
                                    'flex-1 h-0 mx-2.5 border-b-2 border-dotted',
                                    isCardDone ? 'border-accent-2/35' : 'border-surface-raised',
                                  )}
                                />
                                <span
                                  className={cn(
                                    'shrink-0 flex items-baseline gap-1',
                                    isCardDone ? 'text-accent-2' : 'text-ink',
                                  )}
                                >
                                  <span className="text-[22px] font-extrabold font-num font-tabular tracking-tight leading-none">
                                    {ln.currentWeight}
                                  </span>
                                  <span className="text-[13px] font-semibold opacity-70">
                                    {ln.unit}
                                  </span>
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Inline Stepper Editor */}
                      {isOpen && (
                        <div className="pl-[30px] pb-2">
                          <div className="ledger-reveal motion-reduce:animate-none flex gap-2 bg-surface rounded-2xl p-2 mb-2">
                            {ln.isTimed ? (
                              /* Timed set: ONLY Time Stepper */
                              <div className="flex-1 flex items-center justify-between bg-surface-subtle rounded-xl p-1">
                                <button
                                  type="button"
                                  aria-label="Decrease time"
                                  onClick={() =>
                                    handleUpdateLine(
                                      ln.lineKey,
                                      ln.exerciseIndex,
                                      ln.setIndex,
                                      ln.currentReps,
                                      ln.currentWeight,
                                      ln.isCompleted,
                                      nudgeTime(ln.currentTime, -1),
                                    )
                                  }
                                  className="h-[42px] w-[42px] rounded-[10px] bg-surface-raised text-ink hover:bg-surface-raised/80 flex items-center justify-center cursor-pointer transition-transform active:scale-95 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                  <Minus size={16} strokeWidth={2.6} aria-hidden="true" />
                                </button>
                                <div className="text-center">
                                  <div className="text-[20px] font-extrabold font-num font-tabular text-accent-2 leading-none">
                                    {ln.currentTime}
                                  </div>
                                  <div className="text-[10px] font-semibold text-ink-muted uppercase mt-0.5">
                                    sec
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  aria-label="Increase time"
                                  onClick={() =>
                                    handleUpdateLine(
                                      ln.lineKey,
                                      ln.exerciseIndex,
                                      ln.setIndex,
                                      ln.currentReps,
                                      ln.currentWeight,
                                      ln.isCompleted,
                                      nudgeTime(ln.currentTime, 1),
                                    )
                                  }
                                  className="h-[42px] w-[42px] rounded-[10px] bg-surface-raised text-ink hover:bg-surface-raised/80 flex items-center justify-center cursor-pointer transition-transform active:scale-95 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                  <Plus size={16} strokeWidth={2.6} aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              /* Regular set: Weight and Reps Steppers */
                              <>
                                {/* Weight Stepper */}
                                <div className="flex-1 flex items-center justify-between bg-surface-subtle rounded-xl p-1">
                                  <button
                                    type="button"
                                    aria-label="Decrease weight"
                                    onClick={() =>
                                      handleUpdateLine(
                                        ln.lineKey,
                                        ln.exerciseIndex,
                                        ln.setIndex,
                                        ln.currentReps,
                                        nudgeWeight(ln.currentWeight, -1, WEIGHT_STEP),
                                        ln.isCompleted,
                                      )
                                    }
                                    className="h-[42px] w-[42px] rounded-[10px] bg-surface-raised text-ink hover:bg-surface-raised/80 flex items-center justify-center cursor-pointer transition-transform active:scale-95 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    <Minus size={16} strokeWidth={2.6} aria-hidden="true" />
                                  </button>
                                  <div className="text-center">
                                    <div className="text-[20px] font-extrabold font-num font-tabular text-ink leading-none">
                                      {ln.currentWeight}
                                    </div>
                                    <div className="text-[10px] font-semibold text-ink-muted uppercase mt-0.5">
                                      {ln.unit}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label="Increase weight"
                                    onClick={() =>
                                      handleUpdateLine(
                                        ln.lineKey,
                                        ln.exerciseIndex,
                                        ln.setIndex,
                                        ln.currentReps,
                                        nudgeWeight(ln.currentWeight, 1, WEIGHT_STEP),
                                        ln.isCompleted,
                                      )
                                    }
                                    className="h-[42px] w-[42px] rounded-[10px] bg-surface-raised text-ink hover:bg-surface-raised/80 flex items-center justify-center cursor-pointer transition-transform active:scale-95 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    <Plus size={16} strokeWidth={2.6} aria-hidden="true" />
                                  </button>
                                </div>

                                {/* Reps Stepper */}
                                <div className="flex-1 flex items-center justify-between bg-surface-subtle rounded-xl p-1">
                                  <button
                                    type="button"
                                    aria-label="Decrease reps"
                                    onClick={() =>
                                      handleUpdateLine(
                                        ln.lineKey,
                                        ln.exerciseIndex,
                                        ln.setIndex,
                                        nudgeReps(ln.currentReps, -1),
                                        ln.currentWeight,
                                        ln.isCompleted,
                                      )
                                    }
                                    className="h-[42px] w-[42px] rounded-[10px] bg-surface-raised text-ink hover:bg-surface-raised/80 flex items-center justify-center cursor-pointer transition-transform active:scale-95 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    <Minus size={16} strokeWidth={2.6} aria-hidden="true" />
                                  </button>
                                  <div className="text-center">
                                    <div className="text-[20px] font-extrabold font-num font-tabular text-accent-2 leading-none">
                                      {ln.currentReps}
                                    </div>
                                    <div className="text-[10px] font-semibold text-ink-muted uppercase mt-0.5">
                                      reps
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label="Increase reps"
                                    onClick={() =>
                                      handleUpdateLine(
                                        ln.lineKey,
                                        ln.exerciseIndex,
                                        ln.setIndex,
                                        nudgeReps(ln.currentReps, 1),
                                        ln.currentWeight,
                                        ln.isCompleted,
                                      )
                                    }
                                    className="h-[42px] w-[42px] rounded-[10px] bg-surface-raised text-ink hover:bg-surface-raised/80 flex items-center justify-center cursor-pointer transition-transform active:scale-95 border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    <Plus size={16} strokeWidth={2.6} aria-hidden="true" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Button: Log workout / Logged. Tap to undo */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLogCard}
                  disabled={lines.length === 0}
                  className={cn(
                    'w-full min-h-[50px] rounded-[15px] font-extrabold text-[15px] cursor-pointer transition-transform active:scale-[0.985]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
                    isCardDone
                      ? 'border-2 border-accent-2/60 bg-transparent text-accent-2 hover:bg-accent-2/10'
                      : 'border-0 bg-accent text-accent-fg hover:bg-accent/90',
                  )}
                >
                  {isCardDone ? 'Logged. Tap to undo' : 'Log workout'}
                </button>
              </div>
            </section>
          );
        })}
      </div>

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
    </>
  );
};
