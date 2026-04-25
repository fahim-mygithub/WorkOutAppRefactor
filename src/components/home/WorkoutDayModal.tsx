import { Fragment } from 'react';
import { X, Clock, Target, Zap, Calendar, Play, BarChart3 } from 'lucide-react';
import type { WorkoutCalendarDay } from '../../utils/statsCalculator';
import {
  getWorkoutColor,
  getWorkoutTextColor,
  getWorkoutIntensity,
  getIntensityBorderStyle
} from '../../utils/workoutColors';

interface WorkoutDayModalProps {
  day: WorkoutCalendarDay | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkoutDayModal({ day, isOpen, onClose }: WorkoutDayModalProps) {
  if (!isOpen || !day) return null;

  const hasWorkouts = day.workouts.length > 0;
  const isToday = day.isToday;
  const isPast = day.isPast;

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4">
          <div
            className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-semibold">
                  {day.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {isToday && 'Today'}
                  {isPast && !isToday && 'Past workout'}
                  {!isPast && !isToday && 'Future'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {!hasWorkouts ? (
                <RestDayContent />
              ) : (
                <WorkoutDayContent workouts={day.workouts} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}

function RestDayContent() {
  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">😴</div>
      <h3 className="font-medium text-lg mb-2">Rest Day</h3>
      <p className="text-muted-foreground text-sm">
        Recovery is just as important as training. Your muscles grow during rest!
      </p>
    </div>
  );
}

interface WorkoutDayContentProps {
  workouts: Array<{
    id: string;
    name: string;
    duration: number;
    totalVolume: number;
    totalSets: number;
    exerciseCount: number;
  }>;
}

function WorkoutDayContent({ workouts }: WorkoutDayContentProps) {
  const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
  const totalVolume = workouts.reduce((sum, w) => sum + w.totalVolume, 0);
  const totalSets = workouts.reduce((sum, w) => sum + w.totalSets, 0);
  const totalExercises = workouts.reduce((sum, w) => sum + w.exerciseCount, 0);

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock size={16} />
            <span className="text-sm">Duration</span>
          </div>
          <div className="font-semibold">{formatDuration(totalDuration)}</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Target size={16} />
            <span className="text-sm">Volume</span>
          </div>
          <div className="font-semibold">{formatNumber(totalVolume)} lbs</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap size={16} />
            <span className="text-sm">Sets</span>
          </div>
          <div className="font-semibold">{totalSets}</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 size={16} />
            <span className="text-sm">Exercises</span>
          </div>
          <div className="font-semibold">{totalExercises}</div>
        </div>
      </div>

      {/* Individual Workouts */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          {workouts.length === 1 ? 'Workout Details' : 'Workouts'}
        </h4>
        {workouts.map((workout, index) => (
          <WorkoutCard key={`${workout.id}-${index}`} workout={workout} />
        ))}
      </div>
    </div>
  );
}

interface WorkoutCardProps {
  workout: {
    id: string;
    name: string;
    duration: number;
    totalVolume: number;
    totalSets: number;
    exerciseCount: number;
  };
}

function WorkoutCard({ workout }: WorkoutCardProps) {
  const workoutColor = getWorkoutColor(workout.name);
  const workoutTextColor = getWorkoutTextColor(workout.name);
  const intensity = getWorkoutIntensity(
    workout.totalVolume,
    workout.duration,
    workout.totalSets
  );
  const borderStyle = getIntensityBorderStyle(intensity);

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getIntensityLabel = (intensity: 'low' | 'medium' | 'high'): string => {
    switch (intensity) {
      case 'high': return 'High Intensity';
      case 'medium': return 'Moderate';
      case 'low': return 'Light';
      default: return '';
    }
  };

  return (
    <div className={`border-2 ${borderStyle} rounded-xl p-4 bg-card transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${workoutColor} rounded-lg flex items-center justify-center`}>
            <span className="text-white font-bold">
              {workout.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h5 className="font-medium">{workout.name}</h5>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={workoutTextColor}>{getIntensityLabel(intensity)}</span>
            </div>
          </div>
        </div>

        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <Play size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Duration</div>
          <div className="font-medium">{formatDuration(workout.duration)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Volume</div>
          <div className="font-medium">{formatNumber(workout.totalVolume)} lbs</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Sets</div>
          <div className="font-medium">{workout.totalSets}</div>
        </div>
      </div>
    </div>
  );
}