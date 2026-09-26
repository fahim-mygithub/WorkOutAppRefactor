import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Slash,
  Sparkles,
  CalendarPlus,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CalendarMonth, WorkoutCalendarDay } from '../../utils/statsCalculator';
import { usePlannedSchedule } from '../../hooks/usePlannedSchedule';
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_META,
  getMuscleGroup,
  type MuscleGroup,
} from './muscleGroup';
import { IconButton } from '../ui/icon-button';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

interface WorkoutCalendarProps {
  calendarData: CalendarMonth;
  isLoading: boolean;
  onDayClick: (day: WorkoutCalendarDay) => void;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  /** Snap the loaded month back to today's month — used when collapsing to the week view so the strip always shows the current week. */
  onResetToCurrentMonth: () => void;
  /** Dev/testing only: seed the expanded (month) state. Defaults to collapsed (week). */
  initialExpanded?: boolean;
}

// Dashed muscle-hue border for a planned (not-yet-done) day. Literal class
// strings keep Tailwind's JIT from purging them.
const PLANNED_BORDER: Record<'push' | 'pull' | 'legs', string> = {
  push: 'border-muscle-push',
  pull: 'border-muscle-pull',
  legs: 'border-muscle-legs',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "Jun 14 – 20" (same month), "Jun 28 – Jul 4" (straddling months), or
// "Dec 28, 2025 – Jan 3, 2026" (straddling the year). Subtitle for the week strip.
function formatWeekRange(week: WorkoutCalendarDay[]): string {
  if (week.length === 0) return '';
  const start = week[0].date;
  const end = week[week.length - 1].date;
  const crossYear = start.getFullYear() !== end.getFullYear();
  const startLabel = `${MONTH_ABBR[start.getMonth()]} ${start.getDate()}${
    crossYear ? `, ${start.getFullYear()}` : ''
  }`;
  const endLabel =
    start.getMonth() === end.getMonth() && !crossYear
      ? `${end.getDate()}`
      : `${MONTH_ABBR[end.getMonth()]} ${end.getDate()}${
          crossYear ? `, ${end.getFullYear()}` : ''
        }`;
  return `${startLabel} – ${endLabel}`;
}

export function WorkoutCalendar({
  calendarData,
  isLoading,
  onDayClick,
  onNavigateMonth,
  onResetToCurrentMonth,
  initialExpanded = false,
}: WorkoutCalendarProps) {
  // Collapsed = single week strip (default); expanded = full month grid.
  const [expanded, setExpanded] = useState(initialExpanded);
  const reduceMotion = useReducedMotion();
  const { hasActivePlan, autofillMonth } = usePlannedSchedule();
  const hasPlannedInView = useMemo(
    () => calendarData.days.some((d) => d.isCurrentMonth && d.planned),
    [calendarData.days],
  );

  // Group the (Sunday-aligned, complete-week-padded) month grid into rows.
  const weeks = useMemo(() => {
    const grouped: WorkoutCalendarDay[][] = [];
    for (let i = 0; i < calendarData.days.length; i += 7) {
      grouped.push(calendarData.days.slice(i, i + 7));
    }
    return grouped;
  }, [calendarData.days]);

  // The row containing today. Because month grids are padded to whole weeks,
  // today's full week is always present whenever today's month is loaded.
  const todayWeekIndex = useMemo(() => {
    const i = weeks.findIndex((w) => w.some((d) => d.isToday));
    return i >= 0 ? i : 0;
  }, [weeks]);

  const currentWeek = weeks[todayWeekIndex] ?? weeks[0] ?? [];
  const displayedWeeks = expanded ? weeks : currentWeek.length ? [currentWeek] : [];

  const handleToggle = () => {
    if (expanded) {
      // Collapsing: snap back to today's month so the strip is the current week,
      // even if the user paged to another month while expanded.
      setExpanded(false);
      onResetToCurrentMonth();
    } else {
      setExpanded(true);
    }
  };

  if (isLoading) {
    return (
      <div aria-busy="true">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Slim control row. The date label itself is the week/month toggle (a
          chevron hints at it) — no separate "Month"/"Week" button. Month nav
          (prev/next) only appears in the expanded month view. */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-controls="home-calendar-grid"
          aria-label={expanded ? 'Collapse to week view' : 'Expand to month view'}
          className={cn(
            'group -ml-2 inline-flex min-h-touch-min items-center gap-2 rounded-full px-2',
            'transition-colors hover:bg-surface-raised/60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          )}
        >
          <Calendar className="text-ink-muted group-hover:text-ink" size={18} aria-hidden="true" />
          {expanded ? (
            <h3 className="text-body font-semibold text-ink">
              {calendarData.monthName}{' '}
              <span className="font-num font-tabular">{calendarData.year}</span>
            </h3>
          ) : (
            <span className="font-num font-tabular text-body-sm text-ink-muted group-hover:text-ink">
              {formatWeekRange(currentWeek)}
            </span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-ink-subtle group-hover:text-ink" aria-hidden="true" />
          ) : (
            <ChevronDown size={16} className="text-ink-subtle group-hover:text-ink" aria-hidden="true" />
          )}
        </button>

        {expanded && (
          <div className="flex items-center gap-1">
            {hasActivePlan && !hasPlannedInView && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => autofillMonth(new Date(calendarData.year, calendarData.month, 1))}
              >
                <CalendarPlus size={14} />
                <span>Autofill</span>
              </Button>
            )}
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Previous month"
              onClick={() => onNavigateMonth('prev')}
            >
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Next month"
              onClick={() => onNavigateMonth('next')}
            >
              <ChevronRight size={18} />
            </IconButton>
          </div>
        )}
      </div>

      {/* Month view keeps a shared weekday header; the week strip puts the day
          label inside each square instead (see CalendarDayCell). */}
      {expanded && (
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((day) => (
            <div key={day} className="text-center text-caption text-ink-subtle">
              {day}
            </div>
          ))}
        </div>
      )}

      {/* Calendar weeks — the today row carries a constant key so it persists
          across expand/collapse (only the surrounding rows fade). */}
      <div id="home-calendar-grid" className="space-y-2">
        <AnimatePresence initial={false}>
          {displayedWeeks.map((week) => {
            const isTodayRow = week.some((d) => d.isToday);
            const rowKey = isTodayRow
              ? 'current-week'
              : week[0]?.date.toDateString() ?? 'row';
            return (
              <motion.div
                key={rowKey}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.32, 0.72, 0, 1] }}
                className="grid grid-cols-7 gap-1"
              >
                {week.map((day) => (
                  <CalendarDayCell
                    key={day.date.toDateString()}
                    day={day}
                    showWeekday={!expanded}
                    onClick={() => onDayClick(day)}
                  />
                ))}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Legend — only in the month view; the week strip stays uncluttered. */}
      {expanded && <Legend />}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
      {MUSCLE_GROUPS.map((group) => {
        const meta = MUSCLE_GROUP_META[group];
        const Icon = meta.icon;
        return (
          <div
            key={group}
            className="flex items-center gap-1.5 text-caption text-ink-muted"
          >
            <Icon size={14} className={meta.textClass} aria-hidden="true" />
            <span>{meta.label}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 text-caption text-ink-muted">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-ink-subtle"
        />
        <span>Planned</span>
      </div>
    </div>
  );
}

interface CalendarDayCellProps {
  day: WorkoutCalendarDay;
  /** Show the weekday label inside the cell (week strip) vs rely on the header row (month grid). */
  showWeekday: boolean;
  onClick: () => void;
}

// 'planned' is the revived "upcoming" state — now that WorkoutCalendarDay carries
// a per-day Charlie-Split plan signal (day.planned), future planned days render a
// ghosted glyph instead of collapsing to a rest dot.
type DayState = 'completed' | 'planned' | 'rest' | 'missed';

function CalendarDayCell({ day, showWeekday, onClick }: CalendarDayCellProps) {
  const hasWorkouts = day.workouts.length > 0;
  const planned = day.planned ?? null;
  const isPlannedActive = planned != null && planned.status === 'planned';

  // Muscle group: completed days derive from the session NAME; a
  // planned/missed day uses its plan's dayType directly (push/pull/legs).
  const primary = hasWorkouts ? day.workouts[0] : null;
  const group: MuscleGroup | null =
    hasWorkouts && primary
      ? getMuscleGroup(primary.name)
      : planned
        ? (planned.dayType as MuscleGroup)
        : null;
  const meta = group ? MUSCLE_GROUP_META[group] : null;
  const Icon = meta?.icon ?? null;
  const extraCount = day.workouts.length - 1;
  const weekdayLabel = WEEKDAY_LABELS[day.date.getDay()];

  // Tempo day vocabulary: a filled muscle-hue circle = done, a dashed hue ring
  // = planned, a raised circle = rest/missed, and an amber ring marks today on
  // top of whatever the day holds.
  const baseState: DayState = hasWorkouts
    ? 'completed'
    : !day.isPast && isPlannedActive
      ? 'planned'
      : day.isPast && !day.isToday
        ? 'missed'
        : 'rest';

  const circleClass = cn(
    'relative flex items-center justify-center rounded-full transition-colors duration-snap',
    showWeekday ? 'h-10 w-10' : 'h-9 w-9',
    baseState === 'completed' && meta
      ? meta.bgClass
      : baseState === 'planned' && planned
        ? cn('border-2 border-dashed bg-transparent', PLANNED_BORDER[planned.dayType])
        : 'bg-surface-raised group-hover:bg-surface-raised/70',
    day.isToday && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
  );

  return (
    <button
      type="button"
      onClick={onClick}
      title={primary?.name ?? (isPlannedActive && planned ? `Planned: ${planned.variantLabel}` : undefined)}
      aria-current={day.isToday ? 'date' : undefined}
      aria-label={`${weekdayLabel} ${day.date.toDateString()}${
        primary
          ? `, ${primary.name}${extraCount > 0 ? ` and ${extraCount} more` : ''}`
          : isPlannedActive && planned
            ? `, planned ${planned.dayType}`
            : day.isToday
              ? ', today'
              : ', rest day'
      }`}
      className={cn(
        'group flex min-h-touch-min flex-col items-center gap-1.5 rounded-2xl py-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        !day.isCurrentMonth && 'opacity-40',
      )}
    >
      <span className={circleClass}>
        {Icon && meta ? (
          <Icon
            size={showWeekday ? 20 : 18}
            aria-hidden="true"
            className={cn(
              baseState === 'completed' ? 'text-ink-inverse' : meta.textClass,
              baseState === 'missed' && 'opacity-45',
            )}
          />
        ) : showWeekday ? (
          <span
            className={cn(
              'font-num font-tabular text-body-sm',
              day.isToday ? 'font-bold text-accent' : 'text-ink-muted',
            )}
          >
            {day.dayNumber}
          </span>
        ) : (
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ink-subtle/50" />
        )}

        {baseState === 'missed' && Icon && (
          <Slash size={20} aria-hidden="true" className="absolute text-danger/80" />
        )}

        {/* 1RM-retest marker */}
        {day.planned?.isRetest && baseState !== 'completed' && (
          <span
            title="1RM test"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent ring-2 ring-surface"
          >
            <Sparkles size={9} className="text-accent-fg" aria-hidden="true" />
          </span>
        )}

        {/* Multi-session overflow */}
        {extraCount > 0 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-surface px-1 font-num font-tabular text-[10px] font-semibold leading-4 text-ink">
            +{extraCount}
          </span>
        )}
      </span>

      <span
        className={cn(
          'font-num font-tabular text-caption leading-none',
          day.isToday ? 'font-semibold text-accent' : 'text-ink-muted',
        )}
      >
        {showWeekday ? weekdayLabel : day.dayNumber}
      </span>
    </button>
  );
}
