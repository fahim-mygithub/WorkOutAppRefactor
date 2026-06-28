// ExerciseDeck — the swipeable card surface. The active exercise is a real card
// sitting on a peeking "deck" of the exercises still to come. Moving between
// exercise groups SLIDES; moving between the two halves of a superset FLIPS the
// card over (rotateY), so the alternating A/B rhythm reads as one card turning.
import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ExerciseDeckProps {
  /** Current exercise index — keyed so the card remounts + animates on change. */
  index: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Superset id of the current exercise; an unchanged id across a move → flip. */
  currentSupersetId?: string;
  /** Exercise groups still ahead (superset counts as one) — drives the peek stack. */
  cardsLeft: number;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 70;
const PEEK_STEP = 8; // px each stacked card peeks out by
const MAX_PEEK = 3;

export const ExerciseDeck: React.FC<ExerciseDeckProps> = ({
  index,
  canPrev,
  canNext,
  onPrev,
  onNext,
  currentSupersetId,
  cardsLeft,
  children,
}) => {
  const reduced = useReducedMotion() ?? false;
  const prevIndexRef = useRef(index);
  const prevSupersetRef = useRef(currentSupersetId);
  const flipDirRef = useRef(1);

  // Decide the transition for THIS render from the still-previous ref values.
  const indexChanged = index !== prevIndexRef.current;
  const isFlip = indexChanged && !!currentSupersetId && prevSupersetRef.current === currentSupersetId;
  const slideDir = index >= prevIndexRef.current ? 1 : -1;
  const flipDir = flipDirRef.current;

  useEffect(() => {
    prevIndexRef.current = index;
    prevSupersetRef.current = currentSupersetId;
    if (isFlip) flipDirRef.current = -flipDirRef.current; // alternate the flip each turn
  }, [index, currentSupersetId, isFlip]);

  const layers = Math.min(Math.max(cardsLeft, 0), MAX_PEEK);
  const cardInset = layers * PEEK_STEP;

  const initial = reduced
    ? { opacity: 0 }
    : isFlip
      ? { rotateY: flipDir * 90, opacity: 0 }
      : { x: slideDir * 56, opacity: 0 };

  return (
    <div className="relative min-h-0 flex-1" style={{ perspective: 1400 }}>
      {/* Peek stack — the exercises still to come, as a deck behind the active card.
          Rendered outer→inner so paint order stacks them; each peeks out PEEK_STEP
          more at the bottom-right. The active card (inset by layers*STEP) sits on top. */}
      {Array.from({ length: layers }).map((_, k) => {
        const inset = k * PEEK_STEP; // 0 = outermost (flush), grows inward
        const depth = layers - 1 - k; // 0 = closest behind the card
        return (
          <div
            key={k}
            aria-hidden="true"
            className="absolute left-0 top-0 rounded-xl border border-board-line/40 bg-surface-subtle"
            style={{ right: inset, bottom: inset, opacity: 1 - depth * 0.22 }}
          />
        );
      })}

      {/* Active card */}
      <motion.div
        key={index}
        initial={initial}
        animate={{ x: 0, rotateY: 0, opacity: 1 }}
        transition={{ duration: reduced ? 0.14 : isFlip ? 0.42 : 0.26, ease: [0.32, 0.72, 0, 1] }}
        drag={reduced ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD && canNext) onNext();
          else if (info.offset.x > SWIPE_THRESHOLD && canPrev) onPrev();
        }}
        style={{ right: cardInset, bottom: cardInset, transformStyle: 'preserve-3d' }}
        className="absolute left-0 top-0 z-10 overflow-hidden rounded-xl border border-board-line/30 bg-surface-raised shadow-e2 [touch-action:pan-y]"
      >
        {children}
      </motion.div>

      {/* Edge chevrons — desktop + accessibility fallback for the swipe */}
      {canPrev && (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous exercise"
          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-lg bg-surface-raised/80 py-3 pl-0.5 pr-1 text-ink-muted backdrop-blur-sm transition-colors hover:text-ink"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next exercise"
          className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-lg bg-surface-raised/80 py-3 pl-1 pr-0.5 text-ink-muted backdrop-blur-sm transition-colors hover:text-ink"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
};
