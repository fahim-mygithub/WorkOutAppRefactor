import { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Slash } from 'lucide-react';
import type { CalendarMonth, WorkoutCalendarDay } from '../../utils/statsCalculator';
import { getWorkoutIntensity } from '../../utils/workoutColors';
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_META,
  getMuscleGroup,
  type MuscleGroup,
} from './muscleGroup';
import { Card, CardBody, CardHeader } from '../ui/card';
import { IconButton } from '../ui/icon-button';
import { Skeleton } from '../ui/skeleton';
import { Stack } from '../ui/stack';
import { cn } from '../../lib/utils';

interface WorkoutCalendarProps {
  calendarData: CalendarMonth;
  isLoading: boolean;
  onDayClick: (day: WorkoutCalendarDay) => void;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
}

// Map an intensity bucket to a fill width for the under-icon bar.
const INTENSITY_WIDTH: Record<'low' | 'medium' | 'high', string> = {
  low: 'w-1/4',
  medium: 'w-1/2',
  high: 'w-full',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WorkoutCalendar({
  calendarData,
  isLoading,
  onDayClick,
  onNavigateMonth,
}: WorkoutCalendarProps) {
  // Group calendar days into weeks for proper display.
  const weeks = useMemo(() => {
    const grouped: WorkoutCalendarDay[][] = [];
    for (let i = 0; i < calendarData.days.length; i += 7) {
      grouped.push(calendarData.days.slice(i, i + 7));
    }
    return grouped;
  }, [calendarData.days]);

  if (isLoading) {
    return (
      <Card className="mb-6" aria-busy="true">
        <CardHeader className="flex items-center justify-between">
          <Stack direction="row" gap={2} align="center">
            <Calendar className="text-accent" size={20} />
            <h2 className="text-title font-semibold text-ink">Calendar</h2>
          </Stack>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-7 gap-2 mb-3">
            {WEEKDAY_LABELS.map((_, i) => (
              <Skeleton key={i} className="h-4 w-6 mx-auto" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[1/1.15] rounded-md" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      {/* Calendar Header */}
      <CardHeader className="flex items-center justify-between">
        <Stack direction="row" gap={3} align="center">
          <Calendar className="text-accent" size={20} />
          <h2 className="text-title font-semibold text-ink">
            {calendarData.monthName} {calendarData.year}
          </h2>
        </Stack>

        <Stack direction="row" gap={1} align="center">
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
        </Stack>
      </CardHeader>

      <CardBody>
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAY_LABELS.map((day, i) => (
            <div
              key={day}
              className={cn(
                'text-center text-caption font-mono text-ink-subtle',
                (i === 0 || i === 6) && 'text-ink-subtle/70',
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        <div className="space-y-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2">
              {week.map((day, dayIndex) => (
                <CalendarDayCell
                  key={`${day.date.toDateString()}-${dayIndex}`}
                  day={day}
                  onClick={() => onDayClick(day)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend — muscle-group hues */}
        <Legend />
      </CardBody>
    </Card>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
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
  onClick: () => void;
}

// 'upcoming' (planned-not-done) from the wireframe needs a per-day plan signal
// that the current calendar data does not carry — future empty days are simply
// rest days here. The remaining four states are fully derivable from existing
// data, so we keep the data wiring intact and omit 'upcoming'.
type DayState = 'completed' | 'today' | 'rest' | 'missed';

function CalendarDayCell({ day, onClick }: CalendarDayCellProps) {
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

  return (
    <button
      type="button"
      onClick={onClick}
      title={primary?.name}
      aria-label={`${day.date.toDateString()}${
        primary ? `, ${primary.name}` : day.isToday ? ', today' : ', rest day'
      }`}
      className={cn(
        'relative flex aspect-[1/1.15] flex-col rounded-md border p-1.5 text-left',
        'transition-colors duration-snap focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'bg-surface-raised border-ink/8 hover:bg-surface-subtle',
        day.isToday && 'bg-accent/8 ring-2 ring-accent border-accent',
        !day.isCurrentMonth && 'opacity-40',
      )}
    >
      {/* Date label (top row) */}
      <span
        className={cn(
          'text-caption font-mono leading-none',
          day.isToday ? 'text-accent font-semibold' : 'text-ink-subtle',
        )}
      >
        {day.dayNumber}
      </span>

      {/* Center: muscle glyph or rest dot */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {Icon && meta ? (
          <span className="relative inline-flex items-center justify-center">
            <Icon
              size={26}
              aria-hidden="true"
              className={cn(
                meta.textClass,
                state === 'missed' && 'opacity-50',
              )}
            />
            {state === 'missed' && (
              <Slash
                size={26}
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
          <span className="mt-1 flex h-0.5 w-6 overflow-hidden rounded-full">
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
        <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-medium text-ink-subtle">
          +{extraCount}
        </span>
      )}
    </button>
  );
}
