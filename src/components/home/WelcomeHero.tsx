import { Link } from 'react-router-dom';
import { Play, Flame } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { LastWorkoutStats } from '../../hooks/useWorkoutStats';
import { Skeleton } from '../ui/skeleton';
import { Stack } from '../ui/stack';
import { Button } from '../ui/button';

interface WelcomeHeroProps {
  lastWorkoutStats: LastWorkoutStats | null;
  currentStreak: number;
  /** Whether the user has any workout history — drives the returning-vs-new
   *  greeting. More reliable than lastWorkoutStats, which depends on exercise
   *  history (empty in demo mode). */
  hasHistory: boolean;
  isLoading: boolean;
}

/**
 * Greeting block for the merged Home module. Renders BARE (no Card) — HomePage
 * wraps this together with the calendar in a single board-card so the greeting
 * and the week strip read as one unit.
 */
export function WelcomeHero({ lastWorkoutStats, currentStreak, hasHistory, isLoading }: WelcomeHeroProps) {
  const user = useAppSelector(state => state.user.profile);
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  // One-line greeting: welcome returning lifters, nudge new ones to start.
  const greeting = hasHistory
    ? `Welcome back, ${firstName}!`
    : `Let's get started, ${firstName}!`;

  if (isLoading) {
    return (
      <div aria-busy="true">
        <Skeleton className="mb-5 h-8 w-3/4" />
        <Stack direction="row" gap={3} wrap>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-32" />
          ))}
        </Stack>
      </div>
    );
  }

  return (
    <div>
      {/* Greeting — single line; leads straight into the week calendar below it. */}
      <h1 className="mb-5 truncate font-marker text-title leading-snug text-ink">
        {greeting}
      </h1>

      {/* Resume Last — the only quick action kept (shows when a workout exists). */}
      {lastWorkoutStats && (
        <Stack direction="row" gap={3} wrap>
          <Button asChild variant="primary" size="md">
            <Link to="/workout">
              <Play size={18} />
              <span>Resume Last</span>
            </Link>
          </Button>
        </Stack>
      )}

      {/* Streak Indicator */}
      {currentStreak > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <Stack direction="row" gap={2} align="center" className="text-body-sm text-ink-muted">
            <Flame size={16} className="text-warning" aria-hidden="true" />
            <span>
              <span className="font-num font-tabular">{currentStreak}</span> day
              {currentStreak !== 1 ? 's' : ''} streak! Keep it going!
            </span>
          </Stack>
        </div>
      )}
    </div>
  );
}
