import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Slash,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CalendarMonth, WorkoutCalendarDay } from '../../utils/statsCalculator';
import { getWorkoutIntensity } from '../../utils/workoutColors';
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_META,
  getMuscleGroup,
  type MuscleGroup,
} from './muscleGroup';
import { IconButton } from '../ui/icon-button';
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

// Map an intensity bucket to a fill width for the under-icon bar.
const INTENSITY_WIDTH: Record<'low' | 'medium' | 'high', string> = {
  low: 'w-1/4',
  medium: 'w-1/2',
  high: 'w-full',
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
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Slim control row — no big "This Week" title; the greeting above carries
          the context. Left = current range / month; right = nav + labeled toggle. */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="text-accent" size={18} aria-hidden="true" />
          {expanded ? (
            <h3 className="font-marker text-body text-ink">
              {calendarData.monthName}{' '}
              <span className="font-num font-tabular">{calendarData.year}</span>
            </h3>
          ) : (
            <span className="font-num font-tabular text-caption text-ink-muted">
              {formatWeekRange(currentWeek)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {expanded && (
            <>
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
            </>
          )}
          {/* Labeled toggle — visible "Month"/"Week" text keeps the month view
              discoverable now that it is hidden by default. */}
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-controls="home-calendar-grid"
            aria-label={expanded ? 'Collapse to week view' : 'Expand to month view'}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1',
              'font-marker text-caption uppercase tracking-wide text-ink-muted',
              'transition-colors hover:bg-surface-subtle hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            )}
          >
            {expanded ? 'Week' : 'Month'}
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Month view keeps a shared weekday header; the week strip puts the day
          label inside each square instead (see CalendarDayCell). */}
      {expanded && (
        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((day, i) => (
            <div
              key={day}
              className={cn(
                'text-center font-marker text-[10px] uppercase tracking-wide text-ink-subtle',
                (i === 0 || i === 6) && 'text-ink-subtle/70',
              )}
            >
              {day}
            </div>
          ))}
        </div>
      )}

      {/* Calendar weeks — the today row carries a constant key so it persists
          across expand/collapse (only the surrounding rows fade). */}
      <div id="home-calendar-grid" className="space-y-1.5">
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
                className="grid grid-cols-7 gap-1.5"
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
    </div>
  );
}

interface CalendarDayCellProps {
  day: WorkoutCalendarDay;
  /** Show the weekday label inside the cell (week strip) vs rely on the header row (month grid). */
  showWeekday: boolean;
  onClick: () => void;
}

// 'upcoming' (planned-not-done) from the wireframe needs a per-day plan signal
// that the current calendar data does not carry — future empty days are simply
// rest days here. The remaining four states are fully derivable from existing
// data, so we keep the data wiring intact and omit 'upcoming'.
type DayState = 'completed' | 'today' | 'rest' | 'missed';

function CalendarDayCell({ day, showWeekday, onClick }: CalendarDayCellProps) {
  const hasWorkouts = day.workouts.length > 0;

  // Derive the dominant muscle group + intensity from the existing day data.
  const primary = hasWorkouts ? day.workouts[0] : null;
  const group: MuscleGroup | null = primary
    ? getMuscleGroup(primary.name)
    : null;
  const meta = group ? MUSCLE_GROUP_META[group] : null;
  const intensity = primary
    ? getWorkoutIntensity(primary.totalVolume, primary.duration, primary.totalSets)
    : null;

  // Day-state vocabulary (wireframe): today > completed > missed > upcoming > rest.
  const state: DayState = day.isToday
    ? 'today'
    : hasWorkouts
      ? 'completed'
      : day.isPast
        ? 'missed'
        : 'rest';

  const Icon = meta?.icon ?? null;
  const extraCount = day.workouts.length - 1;
  const weekdayLabel = WEEKDAY_LABELS[day.date.getDay()];

  return (
    <button
      type="button"
      onClick={onClick}
      title={primary?.name}
      aria-label={`${weekdayLabel} ${day.date.toDateString()}${
        primary ? `, ${primary.name}` : day.isToday ? ', today' : ', rest day'
      }`}
      className={cn(
        'relative flex aspect-square flex-col rounded-md border p-1 text-left',
        'transition-colors duration-snap focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'bg-surface-raised border-ink/8 hover:bg-surface-subtle',
        day.isToday && 'bg-accent/8 ring-2 ring-accent border-accent',
        !day.isCurrentMonth && 'opacity-40',
      )}
    >
      {/* Top row: weekday label (week strip only) + date number, kept on one line. */}
      <div className="flex items-baseline justify-between gap-0.5 leading-none">
        {showWeekday && (
          <span
            className={cn(
              'font-marker text-[9px] uppercase leading-none',
              day.isToday ? 'text-accent' : 'text-ink-subtle',
            )}
          >
            {weekdayLabel}
          </span>
        )}
        <span
          className={cn(
            'font-num font-tabular text-caption leading-none',
            day.isToday ? 'text-accent font-semibold' : 'text-ink-subtle',
          )}
        >
          {day.dayNumber}
        </span>
      </div>

      {/* Center: muscle glyph or rest dot */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {Icon && meta ? (
          <span className="relative inline-flex items-center justify-center">
            <Icon
              size={20}
              aria-hidden="true"
              className={cn(
                meta.textClass,
                state === 'missed' && 'opacity-50',
              )}
            />
            {state === 'missed' && (
              <Slash
                size={20}
                aria-hidden="true"
                className="absolute inset-0 text-danger/85"
              />
            )}
          </span>
        ) : (
          // Rest day → subtle dot only.
          <span
            aria-hidden="true"
            className="h-1 w-1 rounded-full bg-ink-subtle/30"
          />
        )}

        {/* Intensity bar (non-rest, has intensity) */}
        {meta && intensity && (
          <span className="mt-1 flex h-0.5 w-5 overflow-hidden rounded-full">
            <span
              className={cn('h-full rounded-full', meta.barClass, INTENSITY_WIDTH[intensity])}
            />
          </span>
        )}
      </div>

      {/* Completed check badge (top-right) */}
      {state === 'completed' && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success ring-2 ring-surface-raised"
        />
      )}

      {/* Multi-session overflow indicator */}
      {extraCount > 0 && (
        <span className="absolute bottom-0.5 right-1 font-num font-tabular text-[8px] font-medium text-ink-subtle">
          +{extraCount}
        </span>
      )}
    </button>
  );
}
