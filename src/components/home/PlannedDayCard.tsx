/**
 * The planned-day "training card" — a centered, closable card (not a bottom
 * sheet) that previews a Charlie-Split day the way a coach's index card would:
 * a looping demo clip per movement, supersets braced together by a colored
 * chalk spine, the prescribed load + rep range, and what you did last time.
 * Each accessory can be rerolled in place.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
      className={cn('relative shrink-0 overflow-hidden rounded-lg', className)}
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
        <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink/70 text-[10px] font-bold leading-none text-surface-raised">
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
    <div className="flex items-start gap-3 py-2">
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
            featured ? 'font-marker text-title leading-tight' : 'text-body-sm font-semibold',
          )}
        >
          {slot.title}
        </h5>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-caption text-ink-subtle">{slot.equipment}</span>
          {slot.cues.map((cue) => (
            <span
              key={cue}
              className="rounded px-1 py-px text-[10px] font-medium text-ink-muted"
              style={{ backgroundColor: `hsl(${hue} / 0.13)` }}
            >
              {cue}
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1 text-caption">
          <History size={11} className="shrink-0 text-ink-subtle" aria-hidden="true" />
          {last ? (
            <span className="text-ink-muted">
              Last <span className="font-num font-tabular text-ink">{last}</span>
            </span>
          ) : (
            <span className="text-ink-subtle/70">No previous log</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="text-right">
          <div
            className={cn(
              'font-num font-tabular text-body-sm font-bold leading-tight',
              unseeded ? 'text-ink-subtle' : 'text-ink',
            )}
          >
            {load}
            {loadHasUnit(slot) && <span className="ml-0.5 text-caption font-normal text-ink-subtle">lb</span>}
          </div>
          <div className="font-num font-tabular text-caption text-ink-subtle">{formatScheme(slot)}</div>
        </div>
        {onReroll && (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={`Swap ${slot.title}`}
            onClick={onReroll}
          >
            <Shuffle size={15} />
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
      <section
        className="relative overflow-hidden rounded-xl bg-surface-subtle p-3 pl-4"
        style={{ backgroundColor: `hsl(${hue} / 0.07)` }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: `hsl(${hue})` }}
        />
        <p
          className="mb-1 text-[10px] font-mono font-semibold uppercase tracking-[0.14em]"
          style={{ color: `hsl(${hue})` }}
        >
          Main lift
        </p>
        <SlotRow slot={slot} hue={hue} reduced={reduced} featured />
      </section>
    );
  }

  if (group.kind === 'superset') {
    return (
      <section className="relative rounded-xl border border-board-line/25 bg-surface-subtle/50 py-2 pl-4 pr-2">
        {/* The brace: a colored chalk spine linking the paired movements. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: `hsl(${hue} / 0.6)` }}
        />
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.12em]"
            style={{ backgroundColor: `hsl(${hue} / 0.16)`, color: `hsl(${hue})` }}
          >
            Superset
          </span>
          {group.label && <span className="truncate text-caption text-ink-subtle">{group.label}</span>}
        </div>
        {group.slots.map((slot, i) => (
          <div key={slot.roleKey ?? i}>
            {i > 0 && <div className="ml-[68px] h-px bg-board-line/15" />}
            <SlotRow
              slot={slot}
              hue={hue}
              reduced={reduced}
              onReroll={slot.roleKey ? () => onReroll(slot) : undefined}
            />
          </div>
        ))}
      </section>
    );
  }

  // standalone accessory (e.g. the biceps finisher — straight sets, no superset)
  const slot = group.slots[0];
  return (
    <section className="rounded-xl border border-board-line/25 bg-surface-subtle/50 px-3 py-1">
      {group.label && (
        <p className="pt-1 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          {group.label}
        </p>
      )}
      <SlotRow
        slot={slot}
        hue={hue}
        reduced={reduced}
        onReroll={slot.roleKey ? () => onReroll(slot) : undefined}
      />
    </section>
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
        {/* Header — colored chalk band carries the day identity */}
        <header
          className="relative shrink-0 px-4 pb-3 pt-4"
          style={{ backgroundColor: `hsl(${hue} / 0.1)` }}
        >
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-2 top-2"
          >
            <X size={18} />
          </IconButton>

          <p className="text-caption font-mono uppercase tracking-wide text-ink-subtle">
            {day.isToday ? 'Today · Planned' : 'Planned'} · {dateLabel}
          </p>

          <div className="mt-1.5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `hsl(${hue})` }}
            >
              <Glyph size={24} className="text-ink-inverse" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <ModalTitle className="font-marker text-display leading-none text-ink">
                {meta.label}
              </ModalTitle>
              <p className="mt-0.5 truncate text-body-sm text-ink-muted">{planned.variantLabel}</p>
            </div>
            {planned.isRetest && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-caption font-medium"
                style={{ backgroundColor: `hsl(${hue} / 0.16)`, color: `hsl(${hue})` }}
              >
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
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
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
        <footer className="shrink-0 space-y-2 border-t border-board-line/20 bg-surface-raised px-4 pb-4 pt-3">
          <Button variant="primary" size="lg" className="w-full" onClick={handleStart}>
            <Play size={18} />
            <span>Start this workout</span>
          </Button>
          <button
            type="button"
            onClick={() => rerollAccessories(planned.dateKey)}
            className="flex w-full items-center justify-center gap-1.5 text-caption text-ink-subtle transition-colors hover:text-ink-muted"
          >
            <Shuffle size={13} />
            Shuffle all accessories
          </button>
        </footer>
      </ModalContent>
    </Modal>
  );
}
