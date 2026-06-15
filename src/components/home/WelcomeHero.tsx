import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, BookOpen, Calendar, Flame } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { LastWorkoutStats } from '../../hooks/useWorkoutStats';
import { Card, CardBody } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Stack } from '../ui/stack';
import { Button } from '../ui/button';

interface WelcomeHeroProps {
  lastWorkoutStats: LastWorkoutStats | null;
  currentStreak: number;
  isLoading: boolean;
}

export function WelcomeHero({ lastWorkoutStats, currentStreak, isLoading }: WelcomeHeroProps) {
  const user = useAppSelector(state => state.user.profile);

  // Generate personalized greeting based on time of day and user data
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? 'Good morning' :
      hour < 17 ? 'Good afternoon' :
      'Good evening';

    const firstName = user?.displayName?.split(' ')[0] || 'there';

    return {
      main: `${timeOfDay}, ${firstName}!`,
      sub: generateMotivationalMessage(lastWorkoutStats, currentStreak, hour)
    };
  }, [user?.displayName, lastWorkoutStats, currentStreak]);

  if (isLoading) {
    return (
      <Card className="mb-6" aria-busy="true">
        <CardBody className="p-6 pt-6">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="mb-6 h-5 w-80" />
          <Stack direction="row" gap={3} wrap>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-32" />
            ))}
          </Stack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardBody className="p-6 pt-6">
        {/* Greeting Section */}
        <div className="mb-6">
          <h1 className="mb-2 text-display font-bold text-ink">
            {greeting.main}
          </h1>
          <p className="text-body text-ink-muted">
            {greeting.sub}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <Stack direction="row" gap={3} wrap>
          {lastWorkoutStats && (
            <Button asChild variant="primary" size="md">
              <Link to="/workout">
                <Play size={18} />
                <span>Resume Last</span>
              </Link>
            </Button>
          )}

          <Button asChild variant="secondary" size="md">
            <Link to="/build">
              <Plus size={18} />
              <span>New Workout</span>
            </Link>
          </Button>

          <Button asChild variant="secondary" size="md">
            <Link to="/profile">
              <BookOpen size={18} />
              <span>My Workouts</span>
            </Link>
          </Button>

          <Button asChild variant="secondary" size="md">
            <Link to="/exercises">
              <Calendar size={18} />
              <span>Browse</span>
            </Link>
          </Button>
        </Stack>

        {/* Streak Indicator */}
        {currentStreak > 0 && (
          <div className="mt-4 border-t border-ink/10 pt-4">
            <Stack direction="row" gap={2} align="center" className="text-body-sm text-ink-muted">
              <Flame size={16} className="text-warning" aria-hidden="true" />
              <span>
                {currentStreak} day{currentStreak !== 1 ? 's' : ''} streak! Keep it going!
              </span>
            </Stack>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Helper function to generate motivational messages
function generateMotivationalMessage(
  lastWorkoutStats: LastWorkoutStats | null,
  currentStreak: number,
  hour: number
): string {
  if (!lastWorkoutStats) {
    return hour < 12
      ? "Ready to start your fitness journey today?"
      : "Let's get moving with your first workout!";
  }

  const daysSinceLastWorkout = Math.floor(
    (Date.now() - new Date(lastWorkoutStats.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Current streak messages
  if (currentStreak >= 7) {
    return `Amazing ${currentStreak}-day streak! You're unstoppable!`;
  }

  if (currentStreak >= 3) {
    return `Keep your ${currentStreak}-day streak alive! Let's make it ${currentStreak + 1}!`;
  }

  // Days since last workout messages
  if (daysSinceLastWorkout === 0) {
    return lastWorkoutStats.personalRecords > 0
      ? `Crushed that ${lastWorkoutStats.name} workout! Ready for more?`
      : `Great work on ${lastWorkoutStats.name}! How are you feeling?`;
  }

  if (daysSinceLastWorkout === 1) {
    return `Ready to beat yesterday's ${lastWorkoutStats.name} performance?`;
  }

  if (daysSinceLastWorkout <= 3) {
    return `Welcome back! Let's build on that ${lastWorkoutStats.name} workout.`;
  }

  if (daysSinceLastWorkout <= 7) {
    return `It's been a while! Let's get back into the rhythm.`;
  }

  // Long break encouragement
  return "Welcome back! Every day is a fresh start. Let's do this!";
}
