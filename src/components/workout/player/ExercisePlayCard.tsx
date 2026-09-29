// ExercisePlayCard — one exercise, sized to fit the no-scroll player (Tempo):
// set position + display-voice name, the demo clip (secondary; flexes into the
// leftover height and opens instructions), set chips (ice = done, amber ring =
// current), one "last time" line, then the big-stepper set input.
import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pencil, BookOpen, Dumbbell, History, Link2, Check, Replace, MessageCircle } from 'lucide-react';
import type { WorkoutExercise, WorkoutSet } from '../../../types/exercise';
import type { ExerciseHistory } from '../../../types/exerciseHistory';
import type { InSessionDecision } from '@/types/progression';
import { formatRepRange } from '@/lib/progression/setPrescription';
import { transformVideoUrl } from '../../../utils/videoHelpers';
import { SetInput } from '../../SetInput';
import { InSessionSuggestion } from './InSessionSuggestion';
import { IconButton } from '@/components/ui/icon-button';
import { Modal, ModalContent, ModalTitle, ModalDescription } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

interface ExercisePlayCardProps {
  exercise: WorkoutExercise;
  currentSetIndex: number;
  currentSet?: WorkoutSet;
  /** Names of the other movements in this exercise's superset (empty if none). */
  supersetPartners: string[];
  previousPerformance: ExerciseHistory | null;
  recommendedWeight?: number;
  recommendedReps?: number;
  onEditSets: () => void;
  /** Swap which movement this is (when the typed name was matched wrong). */
  onChangeExercise?: () => void;
  onCompleteSet: (reps: number, weight: number, rir?: number) => void;
  onUncompleteSet: () => void;
  onJumpToSet: (index: number) => void;
  /** Live cue shown under the input after a logged set (null = nothing to show). */
  suggestion?: InSessionDecision | null;
  onApplySuggestion?: (weight: number) => void;
  onKeepSuggestion?: () => void;
  /** Ask coach about the miss behind the current suggestion (AI usable only). */
  onAskCoach?: () => void;
  /** Open the coach about this exercise with no seed — the user types
   *  ("can't do this", "find an alternative"). AI usable only. */
  onAskCoachGeneral?: () => void;
}

/** A single looping muted clip that fills its box, with a glyph placeholder behind
 *  it so a slow/undecodable video never reads as a black rectangle. `contain`
 *  letterboxes the clip (full, uncropped) instead of cover-cropping it. */
function Clip({ url, reduced, contain = false }: { url: string; reduced: boolean; contain?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = url ? transformVideoUrl(url) : '';
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-raised">
      <div className="absolute inset-0 flex items-center justify-center">
        <Dumbbell className="h-8 w-8 text-ink-subtle/60" aria-hidden="true" />
      </div>
      {src && !errored && (
        <video
          src={src}
          className={cn(
            'relative h-full w-full transition-opacity duration-300',
            contain ? 'object-contain' : 'object-cover',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          muted
          loop
          autoPlay={!reduced}
          playsInline
          preload="auto"
          disablePictureInPicture
          onLoadedData={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

/** Reps cell: the prescribed range ("10–15") for a not-yet-logged set with a real
 *  range, otherwise the single (logged or fixed) rep count. */
function fmtReps(s: WorkoutSet): string {
  if (!s.completed) {
    const range = formatRepRange(s);
    if (range) return range;
  }
  return `${s.reps}`;
}

/** Compact per-set readout: "8×70" (or "10–15×70" for a prescribed range), a time
 *  hold, or just reps when bodyweight. */
function fmtSet(s: WorkoutSet): string {
  if (s.time != null) return `${s.time}s`;
  const reps = fmtReps(s);
  if (s.weight && s.weight > 0) return `${reps}×${s.weight}`;
  return reps;
}

export const ExercisePlayCard: React.FC<ExercisePlayCardProps> = ({
  exercise,
  currentSetIndex,
  currentSet,
  supersetPartners,
  previousPerformance,
  recommendedWeight,
  recommendedReps,
  onEditSets,
  onChangeExercise,
  onCompleteSet,
  onUncompleteSet,
  onJumpToSet,
  suggestion,
  onApplySuggestion,
  onKeepSuggestion,
  onAskCoach,
  onAskCoachGeneral,
}) => {
  const reduced = useReducedMotion() ?? false;
  const [showInstructions, setShowInstructions] = useState(false);
  const videoLinks = exercise.exercise.videoLinks ?? [];
  const instructions = exercise.exercise.instructions ?? [];
  const title = exercise.customTitle || exercise.exercise.name;
  const sets = exercise.sets ?? [];
  const showSuggestion = Boolean(suggestion && onApplySuggestion && onKeepSuggestion);

  const lastSets = previousPerformance?.sets ?? [];
  const lastLine = lastSets
    .map((s) => (s.weight > 0 ? `${s.weight}×${s.actualReps}` : `${s.actualReps} reps`))
    .join(', ');

  return (
    <div className="relative flex h-full flex-col gap-3 px-4 pb-4 pt-4">
      {/* Where you are + what it is. Set position in ice (information), the
          movement name in the display voice. */}
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-num font-tabular text-body-sm font-semibold text-accent-2">
            Set {Math.min(currentSetIndex + 1, Math.max(sets.length, 1))} of {sets.length}
          </p>
          <h2 className="mt-1 line-clamp-2 font-display text-[28px] leading-[1.05] text-ink">
            {title}
          </h2>
          {supersetPartners.length > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-body-sm text-ink-muted">
              <Link2 size={14} aria-hidden="true" className="text-accent-2" />
              Superset with {supersetPartners.join(' + ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {onChangeExercise && (
            <IconButton variant="secondary" size="md" aria-label="Change exercise" onClick={onChangeExercise}>
              <Replace size={18} />
            </IconButton>
          )}
          <IconButton variant="secondary" size="md" aria-label="Edit sets" onClick={onEditSets}>
            <Pencil size={18} />
          </IconButton>
        </div>
      </div>

      {/* Clip(s) — secondary: flexes into whatever height is left. Tapping
          opens the instructions sheet. */}
      <div
        className={cn(
          'relative min-h-[88px] flex-1 overflow-hidden rounded-2xl bg-surface-raised',
          instructions.length > 0 && 'cursor-pointer',
        )}
        onClick={instructions.length > 0 ? () => setShowInstructions(true) : undefined}
        role={instructions.length > 0 ? 'button' : undefined}
        aria-label={instructions.length > 0 ? `Show instructions for ${title}` : undefined}
      >
        {videoLinks.length >= 2 ? (
          // Two clips stack vertically (full-width landscape rows) rather than
          // side-by-side — a tall, narrow column cover-crops the movement out of
          // frame, whereas a wide row keeps the whole exercise visible.
          <div className="grid h-full grid-rows-2 gap-px">
            <Clip url={videoLinks[0]} reduced={reduced} />
            <Clip url={videoLinks[1]} reduced={reduced} />
          </div>
        ) : (
          <Clip url={videoLinks[0] ?? ''} reduced={reduced} />
        )}

        {instructions.length > 0 && (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-3 py-1.5 text-caption font-semibold text-ink backdrop-blur-sm">
            <BookOpen size={13} aria-hidden="true" />
            How to
          </span>
        )}
      </div>

      {/* Sets as chips: ice = done, amber ring = current. Tap to jump. */}
      <div className="-mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {sets.map((s, i) => {
          const done = s.completed;
          const cur = i === currentSetIndex;
          return (
            <button
              key={s.id ?? i}
              type="button"
              aria-label={`Go to set ${i + 1}${done ? ', done' : ''}`}
              aria-current={cur ? 'step' : undefined}
              onClick={() => onJumpToSet(i)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 font-num font-tabular text-body-sm transition-colors duration-snap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                done
                  ? 'bg-accent-2/15 text-accent-2'
                  : cur
                    ? 'bg-surface-raised text-ink ring-2 ring-inset ring-accent'
                    : 'bg-surface-raised text-ink-muted',
              )}
            >
              {done && <Check size={13} strokeWidth={3} aria-hidden="true" />}
              {fmtSet(s)}
            </button>
          );
        })}
      </div>

      {/* Last time — one quiet line. */}
      <p className="flex shrink-0 items-center gap-2 text-body-sm text-ink-muted">
        <History size={14} className="shrink-0" aria-hidden="true" />
        {lastLine ? (
          <span className="min-w-0 truncate">
            Last time <span className="font-num font-tabular text-ink">{lastLine}</span>
          </span>
        ) : (
          <span>First time. Today sets your baseline.</span>
        )}
      </p>

      {/* Current set input — compact */}
      <div className="shrink-0">
        <SetInput
          compact
          set={currentSet}
          onComplete={onCompleteSet}
          onUncomplete={onUncompleteSet}
          previousSet={currentSetIndex > 0 ? sets[currentSetIndex - 1] ?? null : null}
          allSets={sets}
          recommendedWeight={recommendedWeight}
          recommendedReps={recommendedReps}
        />
      </div>

      {/* Live in-session cue — sits right under the input; the flex clip above
          absorbs its height so the card still fits without scrolling. */}
      {suggestion && onApplySuggestion && onKeepSuggestion && (
        <div className="shrink-0">
          <InSessionSuggestion
            decision={suggestion}
            onApply={onApplySuggestion}
            onKeep={onKeepSuggestion}
            onAskCoach={onAskCoach}
          />
        </div>
      )}
      {/* The quiet always-there way in: one caption-size link, hidden while the
          suggestion (which carries its own Ask coach) is up. The flex clip
          above absorbs its height. */}
      {onAskCoachGeneral && !showSuggestion && (
        <button
          type="button"
          onClick={onAskCoachGeneral}
          className="-my-1 inline-flex shrink-0 items-center gap-1.5 self-center rounded-full px-2 py-1 text-caption font-semibold text-ink-muted transition-colors duration-snap hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <MessageCircle size={13} aria-hidden="true" />
          Ask coach
        </button>
      )}

      {/* Instructions popup — the clip(s) shown in full (uncropped) and stacked,
          then the steps, all scrollable. */}
      <Modal open={showInstructions} onOpenChange={setShowInstructions}>
        <ModalContent>
          <div className="px-5 pb-2 pt-5">
            <ModalTitle className="text-title">{title}</ModalTitle>
            <ModalDescription>How to perform this exercise</ModalDescription>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 pb-5 pt-2">
            {videoLinks.length > 0 && (
              <div className="space-y-2">
                {videoLinks.map((url, i) => (
                  <div key={i} className="aspect-video w-full overflow-hidden rounded-2xl">
                    <Clip url={url} reduced={reduced} contain />
                  </div>
                ))}
              </div>
            )}
            <ol className="space-y-3">
              {instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-body-sm text-ink-muted">
                  <span className="font-num font-tabular font-bold text-accent-2">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};
