import { Link } from 'react-router-dom';
import type { WorkoutSummary } from '../../types/exerciseHistory';
import { Skeleton } from '../ui/skeleton';

interface HomeStatsProps {
  /** Most-recent-first or unordered; the latest by startTime is used. */
  workoutHistory: WorkoutSummary[];
  /** Consecutive training days (from useWorkoutStats). */
  streak: number;
  isLoading: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function relativeDay(date: Date, now = new Date()): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / DAY_MS);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const tileClass =
  'flex min-h-[96px] flex-col rounded-[20px] bg-surface-subtle p-4 text-left';

/**
 * Two quiet stat tiles under the week strip (Tempo): the last session and the
 * current streak. Numbers carry the weight; labels sit above in muted ink.
 */
export function HomeStats({ workoutHistory, streak, isLoading }: HomeStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-busy="true">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-24 rounded-[20px]" />
      </div>
    );
  }

  const last = [...workoutHistory].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  )[0];

  return (
    <div className="grid grid-cols-2 gap-3">
      {last ? (
        <Link
          to="/profile"
          className={`${tileClass} transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        >
          <span className="text-caption text-ink-muted">Last session</span>
          <span className="mt-1.5 truncate text-body font-semibold text-ink">{last.name}</span>
          <span className="mt-auto text-body-sm text-ink-muted">
            {relativeDay(new Date(last.startTime))}, {last.duration} min
          </span>
        </Link>
      ) : (
        <div className={tileClass}>
          <span className="text-caption text-ink-muted">Last session</span>
          <span className="mt-auto text-body-sm text-ink-muted">None yet</span>
        </div>
      )}

      <div className={tileClass}>
        <span className="text-caption text-ink-muted">Streak</span>
        <span className="mt-1.5 font-display font-tabular text-display leading-none text-ink">
          {streak}
          <span className="ml-1.5 font-sans text-body font-semibold tracking-normal text-ink-muted [font-stretch:100%]">
            day{streak === 1 ? '' : 's'}
          </span>
        </span>
        <span className="mt-auto text-body-sm text-ink-muted">
          {streak > 0 ? 'Keep it going' : 'Train today to start one'}
        </span>
      </div>
    </div>
  );
}
