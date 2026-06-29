// ExercisePlayCard — one exercise, sized to fit the no-scroll player: the demo
// clip up top (with an Instructions button that opens a popup and a "last time"
// chip), the current-set input directly beneath, and tappable set pips. The clip
// flexes to fill whatever height is left after the fixed input, so the whole card
// fits without scrolling on small phones.
import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pencil, BookOpen, Dumbbell, History, Link2, Check } from 'lucide-react';
import type { WorkoutExercise, WorkoutSet } from '../../../types/exercise';
import type { ExerciseHistory } from '../../../types/exerciseHistory';
import { transformVideoUrl } from '../../../utils/videoHelpers';
import { SetInput } from '../../SetInput';
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
  onCompleteSet: (reps: number, weight: number) => void;
  onUncompleteSet: () => void;
  onJumpToSet: (index: number) => void;
}

/** A single looping muted clip that fills its box, with a glyph placeholder behind
 *  it so a slow/undecodable video never reads as a black rectangle. `contain`
 *  letterboxes the clip (full, uncropped) instead of cover-cropping it. */
function Clip({ url, reduced, contain = false }: { url: string; reduced: boolean; contain?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = url ? transformVideoUrl(url) : '';
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-subtle">
      <div className="absolute inset-0 flex items-center justify-center">
        <Dumbbell className="h-8 w-8 text-ink-subtle/40" aria-hidden="true" />
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
  if (!s.completed && s.repMin != null && s.repMax != null && s.repMin !== s.repMax) {
    return `${s.repMin}–${s.repMax}`;
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
  onCompleteSet,
  onUncompleteSet,
  onJumpToSet,
}) => {
  const reduced = useReducedMotion() ?? false;
  const [showInstructions, setShowInstructions] = useState(false);
  const videoLinks = exercise.exercise.videoLinks ?? [];
  const instructions = exercise.exercise.instructions ?? [];
  const title = exercise.customTitle || exercise.exercise.name;
  const sets = exercise.sets ?? [];

  return (
    <div className="relative flex h-full flex-col gap-2 px-4 pb-2 pt-2">
      {/* Superset edge label — signals this card alternates between two movements */}
      {supersetPartners.length > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 font-marker text-[10px] uppercase tracking-[0.3em] text-accent/70"
          style={{ writingMode: 'vertical-rl' }}
        >
          Superset
        </span>
      )}

      {/* Title + superset partner + edit */}
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-marker text-title leading-tight text-ink">{title}</h2>
          {supersetPartners.length > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-caption text-accent">
              <Link2 size={12} aria-hidden="true" />
              with {supersetPartners.join(' + ')}
            </span>
          )}
        </div>
        <IconButton variant="ghost" size="sm" aria-label="Edit sets" onClick={onEditSets}>
          <Pencil size={16} />
        </IconButton>
      </div>

      {/* Clip(s) — flex to fill remaining height. Tapping anywhere opens the
          instructions popup; the chip is the visible affordance for it. */}
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden rounded-xl border border-board-line/20',
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

        {/* instructions affordance */}
        {instructions.length > 0 && (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink/65 px-2.5 py-1 text-caption font-medium text-surface-raised backdrop-blur-sm">
            <BookOpen size={13} aria-hidden="true" />
            Instructions
          </span>
        )}
      </div>

      {/* Previous workout — what you actually logged last time for this exercise */}
      <div className="flex shrink-0 items-center gap-2 rounded-lg bg-surface-subtle px-2.5 py-1.5">
        <History size={12} className="shrink-0 text-ink-subtle" aria-hidden="true" />
        {previousPerformance && previousPerformance.sets?.length ? (
          <>
            <span className="shrink-0 font-marker text-[10px] uppercase tracking-wide text-ink-subtle">
              Last
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {previousPerformance.sets.map((s, i) => (
                <span key={i} className="shrink-0 font-num font-tabular text-caption text-ink-muted">
                  {s.weight > 0 ? (
                    <>
                      <span className="text-ink">{s.weight}</span>×{s.actualReps}
                    </>
                  ) : (
                    `${s.actualReps} reps`
                  )}
                </span>
              ))}
            </div>
          </>
        ) : (
          <span className="text-caption text-ink-subtle">First time — set your baseline today</span>
        )}
      </div>

      {/* Per-set overview — each set's reps×weight + status, tappable to jump */}
      <div className="flex shrink-0 items-stretch gap-1.5">
        {sets.map((s, i) => {
          const done = s.completed;
          const cur = i === currentSetIndex;
          return (
            <button
              key={s.id ?? i}
              type="button"
              aria-label={`Go to set ${i + 1}`}
              onClick={() => onJumpToSet(i)}
              className={cn(
                'flex-1 rounded-md border px-1 py-1 text-center leading-none transition-colors',
                done
                  ? 'border-success/40 bg-success/15'
                  : cur
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                    : 'border-board-line/25 bg-surface-subtle',
              )}
            >
              <div className="flex items-center justify-center gap-0.5 text-[10px] text-ink-subtle">
                {done && <Check size={9} className="text-success" aria-hidden="true" />}
                <span>Set {i + 1}</span>
              </div>
              <div
                className={cn(
                  'mt-0.5 font-num font-tabular text-caption',
                  done || cur ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {fmtSet(s)}
              </div>
            </button>
          );
        })}
      </div>

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

      {/* Instructions popup — the clip(s) shown in full (uncropped) and stacked,
          then the steps, all scrollable. */}
      <Modal open={showInstructions} onOpenChange={setShowInstructions}>
        <ModalContent>
          <div className="border-b border-board-line/20 px-4 pb-3 pt-4">
            <ModalTitle className="font-marker text-title text-ink">{title}</ModalTitle>
            <ModalDescription className="text-caption text-ink-subtle">
              How to perform this exercise
            </ModalDescription>
          </div>
          <div className="space-y-4 overflow-y-auto px-4 py-4">
            {videoLinks.length > 0 && (
              <div className="space-y-2">
                {videoLinks.map((url, i) => (
                  <div key={i} className="aspect-video w-full overflow-hidden rounded-lg border border-board-line/20">
                    <Clip url={url} reduced={reduced} contain />
                  </div>
                ))}
              </div>
            )}
            <ol className="space-y-3">
              {instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-body-sm text-ink-muted">
                  <span className="font-num font-bold text-accent">{i + 1}.</span>
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
