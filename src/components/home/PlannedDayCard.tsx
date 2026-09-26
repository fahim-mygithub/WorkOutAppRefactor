/**
 * The planned-day "training card" — a centered, closable card (not a bottom
 * sheet) that previews a Charlie-Split day: a looping demo clip per movement,
 * supersets grouped on one subtle card with hairline rows, the prescribed load +
 * rep range as tabular numbers, and what you did last time. Each accessory can
 * be rerolled in place. One amber action: start the workout.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { X, Play, Shuffle, Dumbbell, Sparkles, History } from 'lucide-react';
import type { WorkoutCalendarDay } from '../../utils/statsCalculator';
import type { PlannedDay } from '../../types/schedule';
import { MUSCLE_GROUP_META } from './muscleGroup';
import { useExercises } from '../../hooks/useExercises';
import { usePlannedSchedule } from '../../hooks/usePlannedSchedule';
import { useStartPlannedDay } from '../../hooks/useStartPlannedDay';
import { useAppSelector } from '../../store/hooks';
import { ScheduleService } from '../../services/scheduleService';
import { transformVideoUrl } from '../../utils/videoHelpers';
import {
  buildPlanDetail,
  buildPerformedMap,
  type PlanGroup,
  type PlanSlot,
} from '../../lib/charlie/planDetail';
import type { Exercise } from '../../types/exercise';
import { Modal, ModalContent, ModalTitle, ModalDescription } from '../ui/modal';
import { IconButton } from '../ui/icon-button';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface PlannedDayCardProps {
  day: WorkoutCalendarDay;
  planned: PlannedDay;
  isOpen: boolean;
  onClose: () => void;
}

const SUPERSET_BADGE = ['A', 'B', 'C', 'D'];

/** Prescribed load headline — the working weight, BW(+added), a time hold, or an
 *  em dash for accessories whose load is set by feel on the first session. */
function formatLoad(slot: PlanSlot): string {
  if (slot.isTime) return `${slot.timeSeconds ?? 0}s`;
  if (slot.addedLoad) return slot.weight && slot.weight > 0 ? `BW+${slot.weight}` : 'BW';
  if (slot.weight && slot.weight > 0) return `${slot.weight}`;
  return '—';
}

/** Whether the load headline should carry a trailing "lb" unit. */
function loadHasUnit(slot: PlanSlot): boolean {
  if (slot.isTime) return false;
  return Boolean(slot.weight && slot.weight > 0);
}

/** Sets × reps band (or sets × hold for time-based work). */
function formatScheme(slot: PlanSlot): string {
  if (slot.isTime) return `${slot.setsCount} sets`;
  const reps = slot.repMin === slot.repMax ? `${slot.repMin}` : `${slot.repMin}–${slot.repMax}`;
  return `${slot.setsCount} × ${reps}`;
}

/** "4×5 · 185 lb" from the most recent logged session, or null. */
function formatLast(slot: PlanSlot): string | null {
  const last = slot.last;
  if (!last) return null;
  const perSet = last.sets > 0 ? Math.round(last.reps / last.sets) : last.reps;
  const wt = last.avgWeight ? ` · ${last.avgWeight} lb` : '';
  return `${last.sets}×${perSet}${wt}`;
}

/**
 * Looping muted demo clip. A hue-tinted glyph placeholder shows immediately so the
 * row never reads as a black box; the clip is lazy-loaded once near the viewport
 * (so 8 rows don't fetch at once), fades in when it has a frame, and pauses while
 * scrolled out. Reduced motion → the first frame stays paused as a poster.
 */
function ExerciseClip({
  exercise,
  className,
  badge,
  reduced,
  hue,
}: {
  exercise: Exercise;
  className?: string;
  badge?: string;
  reduced: boolean;
  hue: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const url = exercise.videoLinks?.[0] ? transformVideoUrl(exercise.videoLinks[0]) : '';

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !url) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setActivated(true);
        const v = videoRef.current;
        if (v && !reduced) {
          if (entry.isIntersecting) void v.play().catch(() => {});
          else v.pause();
        }
      },
      { rootMargin: '150px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url, reduced]);

  const showVideo = Boolean(url) && !errored && activated;

  return (
    <div
      ref={containerRef}
      className={cn('relative shrink-0 overflow-hidden rounded-xl', className)}
      style={{ backgroundColor: `hsl(${hue} / 0.09)` }}
    >
      {/* Placeholder — always behind the clip so loading never looks broken. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Dumbbell className="h-1/3 w-1/3" style={{ color: `hsl(${hue} / 0.5)` }} aria-hidden="true" />
      </div>
      {showVideo && (
        <video
          ref={videoRef}
          src={url}
          className={cn(
            'relative h-full w-full object-cover transition-opacity duration-300',
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
      {badge && (
        <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] font-bold leading-none text-ink-inverse">
          {badge}
        </span>
      )}
    </div>
  );
}

/** One movement row: clip + name/cues/last on the left, prescription + reroll right. */
function SlotRow({
  slot,
  hue,
  reduced,
  onReroll,
  featured = false,
}: {
  slot: PlanSlot;
  hue: string;
  reduced: boolean;
  onReroll?: () => void;
  featured?: boolean;
}) {
  const last = formatLast(slot);
  const badge = slot.position != null ? SUPERSET_BADGE[slot.position] : undefined;
  const load = formatLoad(slot);
  const unseeded = load === '—';
  return (
    <div className="flex items-start gap-3 py-3">
      <ExerciseClip
        exercise={slot.exercise}
        badge={badge}
        reduced={reduced}
        hue={hue}
        className={featured ? 'h-16 w-16' : 'h-14 w-14'}
      />

      <div className="min-w-0 flex-1">
        <h5
          className={cn(
            'truncate text-ink',
            featured ? 'text-title font-bold leading-tight' : 'text-body font-semibold',
          )}
        >
          {slot.title}
        </h5>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-caption text-ink-muted">{slot.equipment}</span>
          {slot.cues.map((cue) => (
            <span
              key={cue}
              className="rounded-full bg-surface-raised px-2 py-px text-caption text-ink-muted"
            >
              {cue}
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1 text-caption">
          <History size={12} className="shrink-0 text-ink-subtle" aria-hidden="true" />
          {last ? (
            <span className="text-ink-muted">
              Last <span className="font-num font-tabular text-ink">{last}</span>
            </span>
          ) : (
            <span className="text-ink-subtle">No previous log</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="text-right">
          <div
            className={cn(
              'font-display font-tabular text-title leading-tight',
              unseeded ? 'text-ink-subtle' : 'text-ink',
            )}
          >
            {load}
            {loadHasUnit(slot) && <span className="ml-0.5 text-caption font-normal text-ink-subtle">lb</span>}
          </div>
          <div className="font-num font-tabular text-body-sm text-ink-muted">{formatScheme(slot)}</div>
        </div>
        {onReroll && (
          <IconButton
            variant="ghost"
            size="md"
            aria-label={`Swap ${slot.title}`}
            onClick={onReroll}
          >
            <Shuffle size={16} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** Render a group: featured compound, braced superset, or a standalone accessory. */
function Group({
  group,
  hue,
  reduced,
  onReroll,
}: {
  group: PlanGroup;
  hue: string;
  reduced: boolean;
  onReroll: (slot: PlanSlot) => void;
}) {
  if (group.kind === 'compound') {
    const slot = group.slots[0];
    return (
      <section className="rounded-[20px] bg-surface-subtle px-4 pb-1 pt-3">
        <GroupLabel hue={hue}>Main lift</GroupLabel>
        <SlotRow slot={slot} hue={hue} reduced={reduced} featured />
      </section>
    );
  }

  if (group.kind === 'superset') {
    return (
      <section className="rounded-[20px] bg-surface-subtle px-4 pb-1 pt-3">
        <GroupLabel hue={hue} detail={group.label}>Superset</GroupLabel>
        <div className="divide-y divide-hairline">
          {group.slots.map((slot, i) => (
            <SlotRow
              key={slot.roleKey ?? i}
              slot={slot}
              hue={hue}
              reduced={reduced}
              onReroll={slot.roleKey ? () => onReroll(slot) : undefined}
            />
          ))}
        </div>
      </section>
    );
  }

  // standalone accessory (e.g. the biceps finisher — straight sets, no superset)
  const slot = group.slots[0];
  return (
    <section className="rounded-[20px] bg-surface-subtle px-4 pb-1 pt-3">
      {group.label && <GroupLabel hue={hue}>{group.label}</GroupLabel>}
      <SlotRow
        slot={slot}
        hue={hue}
        reduced={reduced}
        onReroll={slot.roleKey ? () => onReroll(slot) : undefined}
      />
    </section>
  );
}

/** Small sentence-case group label led by the day's muscle-hue dot. */
function GroupLabel({
  hue,
  detail,
  children,
}: {
  hue: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-body-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: `hsl(${hue})` }}
      />
      <span className="font-semibold text-ink">{children}</span>
      {detail && <span className="truncate">{detail}</span>}
    </p>
  );
}

export function PlannedDayCard({ day, planned, isOpen, onClose }: PlannedDayCardProps) {
  const reduced = useReducedMotion() ?? false;
  const { exercises } = useExercises();
  const { generatePlannedWorkout, rerollAccessory, rerollAccessories } = usePlannedSchedule();
  const startPlannedDay = useStartPlannedDay();
  const idKey = useAppSelector((s) => s.user.profile?.uid) ?? 'anon';

  const meta = MUSCLE_GROUP_META[planned.dayType];
  const Glyph = meta.icon;
  const hue = `var(--muscle-${planned.dayType})`;

  const performed = useMemo(
    () => buildPerformedMap(ScheduleService.getPerformedLocal(idKey)),
    [idKey],
  );

  // Full generated day (real catalog → real demo clips + superset wiring). Recomputes
  // when a reroll changes the persisted picks (generatePlannedWorkout's deps).
  const groups = useMemo<PlanGroup[]>(() => {
    const gen = generatePlannedWorkout(planned.dateKey, exercises);
    if (!gen) return [];
    return buildPlanDetail(planned.dayType, planned.cycleIndex, gen.exercises, performed);
  }, [generatePlannedWorkout, planned.dateKey, planned.dayType, planned.cycleIndex, exercises, performed]);

  const dateLabel = day.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleStart = () => {
    onClose();
    startPlannedDay(planned);
  };

  return (
    <Modal open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <ModalContent>
        {/* Header — context line + display title; the muscle hue is a single dot. */}
        <header className="relative shrink-0 px-5 pb-3 pt-5">
          <IconButton
            variant="ghost"
            size="md"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3"
          >
            <X size={20} />
          </IconButton>

          <p className="flex items-center gap-2 pr-12 text-body-sm text-ink-muted">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `hsl(${hue})` }}
            />
            <span className="truncate">
              {day.isToday ? 'Planned for today' : `Planned, ${dateLabel}`}
            </span>
          </p>

          <div className="mt-1 flex items-center gap-3 pr-12">
            <Glyph size={28} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <ModalTitle className="min-w-0 truncate leading-none">{meta.label}</ModalTitle>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-body text-ink-muted">{planned.variantLabel}</p>
            {planned.isRetest && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-raised px-2.5 py-1 text-caption text-accent-2">
                <Sparkles size={12} aria-hidden="true" />
                1RM test
              </span>
            )}
          </div>
          <ModalDescription className="sr-only">
            Planned {meta.label} workout for {dateLabel}: {planned.variantLabel}.
          </ModalDescription>
        </header>

        {/* Body — the prescription, scrollable */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-body-sm text-ink-muted">
              Building your session…
            </p>
          ) : (
            groups.map((group, i) => (
              <Group
                key={group.slots[0]?.roleKey ?? `${group.kind}-${i}`}
                group={group}
                hue={hue}
                reduced={reduced}
                onReroll={(slot) =>
                  slot.roleKey && rerollAccessory(planned.dateKey, slot.roleKey, slot.exerciseId)
                }
              />
            ))
          )}
        </div>

        {/* Footer — the one action that matters, plus a bulk reroll escape hatch */}
        <footer className="shrink-0 space-y-1 px-4 pb-4 pt-3">
          <Button variant="primary" size="xl" onClick={handleStart}>
            <Play size={20} fill="currentColor" aria-hidden="true" />
            <span>Start workout</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => rerollAccessories(planned.dateKey)}
          >
            <Shuffle size={16} aria-hidden="true" />
            Shuffle all accessories
          </Button>
        </footer>
      </ModalContent>
    </Modal>
  );
}
