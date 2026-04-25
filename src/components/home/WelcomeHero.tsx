import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, BookOpen, Calendar } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { LastWorkoutStats } from '../../hooks/useWorkoutStats';

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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-8 bg-white/20 rounded mb-2 w-64"></div>
          <div className="h-5 bg-white/20 rounded mb-6 w-80"></div>
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-white/20 rounded-lg w-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-6 text-white">
      {/* Greeting Section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {greeting.main}
        </h1>
        <p className="text-blue-100 text-sm md:text-base opacity-90">
          {greeting.sub}
        </p>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {lastWorkoutStats && (
          <Link
            to="/workout"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 transition-all duration-200 hover:scale-105"
          >
            <Play size={18} />
            <span className="font-medium">Resume Last</span>
          </Link>
        )}

        <Link
          to="/build"
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 transition-all duration-200 hover:scale-105"
        >
          <Plus size={18} />
          <span className="font-medium">New Workout</span>
        </Link>

        <Link
          to="/profile"
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 transition-all duration-200 hover:scale-105"
        >
          <BookOpen size={18} />
          <span className="font-medium">My Workouts</span>
        </Link>

        <Link
          to="/exercises"
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-3 transition-all duration-200 hover:scale-105"
        >
          <Calendar size={18} />
          <span className="font-medium">Browse</span>
        </Link>
      </div>

      {/* Streak Indicator */}
      {currentStreak > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center gap-2 text-sm text-blue-100">
            <div className="flex">
              {Array.from({ length: Math.min(currentStreak, 7) }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-yellow-400 rounded-full mr-1 animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
              {currentStreak > 7 && (
                <span className="ml-1 font-medium">+{currentStreak - 7}</span>
              )}
            </div>
            <span>
              {currentStreak} day{currentStreak !== 1 ? 's' : ''} streak! Keep it going! 🔥
            </span>
          </div>
        </div>
      )}
    </div>
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
    return `Amazing ${currentStreak}-day streak! You're unstoppable! 💪`;
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