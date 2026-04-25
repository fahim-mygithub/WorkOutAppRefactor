import { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarMonth, WorkoutCalendarDay } from '../../utils/statsCalculator';
import {
  getWorkoutColor,
  getWorkoutInitial,
  getWorkoutIntensity,
  getIntensityBorderStyle
} from '../../utils/workoutColors';

interface WorkoutCalendarProps {
  calendarData: CalendarMonth;
  isLoading: boolean;
  onDayClick: (day: WorkoutCalendarDay) => void;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
}

export function WorkoutCalendar({ calendarData, isLoading, onDayClick, onNavigateMonth }: WorkoutCalendarProps) {
  // Group calendar days into weeks for proper display
  const weeks = useMemo(() => {
    const grouped: WorkoutCalendarDay[][] = [];
    for (let i = 0; i < calendarData.days.length; i += 7) {
      grouped.push(calendarData.days.slice(i, i + 7));
    }
    return grouped;
  }, [calendarData.days]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary" size={20} />
            <h2 className="text-xl font-semibold">Calendar</h2>
          </div>
        </div>
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="grid grid-cols-7 gap-0 mb-4">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center py-3 text-sm font-medium">
                <div className="h-4 bg-muted rounded w-6 mx-auto"></div>
              </div>
            ))}
          </div>
          {/* Calendar skeleton */}
          <div className="border border-border rounded-lg overflow-hidden">
            {Array.from({ length: 6 }).map((_, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7">
                {Array.from({ length: 7 }).map((_, dayIndex) => (
                  <div key={dayIndex} className="aspect-square border-r border-b border-border last:border-r-0">
                    <div className="p-2">
                      <div className="h-4 bg-muted rounded w-8 mb-2"></div>
                      <div className="h-2 bg-muted rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6 mb-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="text-primary" size={20} />
          <h2 className="text-xl font-semibold">{calendarData.monthName} {calendarData.year}</h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigateMonth('prev')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onNavigateMonth('next')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <div
              key={day}
              className={`text-center py-3 text-sm font-medium text-muted-foreground ${
                i === 0 || i === 6 ? 'text-muted-foreground/70' : ''
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        <div className="border border-border rounded-lg overflow-hidden">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map((day, dayIndex) => (
                <CalendarDayCell
                  key={`${day.date.toDateString()}-${dayIndex}`}
                  day={day}
                  onClick={() => onDayClick(day)}
                  isLastRow={weekIndex === weeks.length - 1}
                  isLastColumn={dayIndex === 6}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 bg-muted/50 rounded-sm"></div>
          <span>Rest day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 bg-green-500 rounded-sm flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">L</span>
          </div>
          <span>Light workout</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 bg-blue-500 rounded-sm flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">M</span>
          </div>
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 bg-red-500 rounded-sm flex items-center justify-center ring-1 ring-white/50">
            <span className="text-[8px] font-bold text-white">H</span>
          </div>
          <span>Intense</span>
        </div>
      </div>
    </div>
  );
}

interface CalendarDayCellProps {
  day: WorkoutCalendarDay;
  onClick: () => void;
  isLastRow: boolean;
  isLastColumn: boolean;
}

function CalendarDayCell({ day, onClick, isLastRow, isLastColumn }: CalendarDayCellProps) {
  const hasWorkouts = day.workouts.length > 0;
  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;

  // Get workout indicators
  const workoutDots = day.workouts.slice(0, 3).map((workout, index) => {
    const color = getWorkoutColor(workout.name);
    const intensity = getWorkoutIntensity(
      workout.totalVolume,
      workout.duration,
      workout.totalSets
    );

    return {
      id: workout.id,
      color,
      intensity,
      name: workout.name
    };
  });

  const hasMoreWorkouts = day.workouts.length > 3;

  return (
    <button
      onClick={onClick}
      className={`
        aspect-square p-2 text-left transition-colors duration-200
        border-r border-b border-border
        hover:bg-muted/50
        ${isLastColumn ? 'border-r-0' : ''}
        ${isLastRow ? 'border-b-0' : ''}
        ${isWeekend ? 'bg-muted/20' : ''}
        ${day.isToday ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''}
        ${!day.isCurrentMonth ? 'opacity-40' : ''}
      `}
    >
      <div className="flex flex-col h-full">
        {/* Date number */}
        <div className={`
          text-sm font-medium mb-1
          ${day.isToday ? 'text-primary font-bold' : ''}
          ${!day.isCurrentMonth ? 'text-muted-foreground' : ''}
        `}>
          {day.dayNumber}
        </div>

        {/* Workout indicators */}
        <div className="flex-1 flex flex-col justify-start gap-0.5">
          {hasWorkouts && (
            <>
              {workoutDots.slice(0, 2).map((workout, index) => (
                <div
                  key={workout.id}
                  className={`
                    w-5 h-3 rounded-sm flex items-center justify-center text-[8px] font-bold text-white
                    ${workout.color}
                    ${workout.intensity === 'high' ? 'ring-1 ring-white/50' : ''}
                    ${workout.intensity === 'medium' ? 'opacity-90' : ''}
                    ${workout.intensity === 'low' ? 'opacity-75' : ''}
                  `}
                  title={workout.name}
                >
                  {getWorkoutInitial(workout.name)}
                </div>
              ))}

              {(day.workouts.length > 2) && (
                <div className="w-5 h-2 bg-muted-foreground/40 rounded-sm flex items-center justify-center">
                  <span className="text-[6px] text-muted-foreground font-medium">
                    +{day.workouts.length - 2}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Today indicator */}
        {day.isToday && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </button>
  );
}