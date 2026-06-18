import type { WorkoutSummary, ExerciseHistory, ExerciseStats } from '../types/exerciseHistory';

export interface WorkoutCalendarDay {
  date: Date;
  workouts: Array<{
    id: string;
    name: string;
    duration: number;
    totalVolume: number;
    totalSets: number;
    exerciseCount: number;
  }>;
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  dayNumber: number;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0-11 (JavaScript month format)
  monthName: string;
  days: WorkoutCalendarDay[];
}

export interface WeeklyStats {
  workoutsCompleted: number;
  totalVolume: number;
  totalDuration: number;
  mostTrainedMuscles: string[];
  streak: number;
  consistencyScore: number;
}

export interface MonthlyStats {
  workoutsCompleted: number;
  totalTrainingTime: number;
  volumeProgression: Array<{ date: Date; volume: number }>;
  consistencyScore: number;
  newExercisesTried: number;
  personalRecords: number;
}

export interface HighlightData {
  type: 'progression' | 'volume' | 'consistency' | 'strength' | 'endurance' | 'variety';
  title: string;
  description: string;
  value: string;
  icon: string;
  isAchievement: boolean;
  date?: Date;
}

// Generate proper calendar month data
export function generateCalendarData(
  workoutHistory: WorkoutSummary[],
  targetDate: Date = new Date()
): CalendarMonth {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get target month details
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Create a map of dates to workouts for quick lookup
  const workoutsByDate = new Map<string, WorkoutSummary[]>();

  workoutHistory.forEach(workout => {
    const workoutDate = new Date(workout.startTime);
    workoutDate.setHours(0, 0, 0, 0);
    const dateKey = workoutDate.toDateString();

    if (!workoutsByDate.has(dateKey)) {
      workoutsByDate.set(dateKey, []);
    }
    workoutsByDate.get(dateKey)!.push(workout);
  });

  // Get first day of the month and how many days in month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Get the day of week for the first day (0 = Sunday)
  const firstDayWeekday = firstDayOfMonth.getDay();

  // Calculate how many days from previous month to show
  const daysFromPrevMonth = firstDayWeekday;

  // Calculate how many days from next month to show (to fill grid)
  const totalCells = Math.ceil((daysInMonth + daysFromPrevMonth) / 7) * 7;
  const daysFromNextMonth = totalCells - daysInMonth - daysFromPrevMonth;

  const days: WorkoutCalendarDay[] = [];

  // Add days from previous month
  if (daysFromPrevMonth > 0) {
    // Day 0 of the current month === the last day of the previous month.
    // (Using `month - 1` here would land two months back and mis-size the
    // leading days by the difference, e.g. April's 30 instead of May's 31.)
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();

    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const date = new Date(year, month - 1, dayNum);
      date.setHours(0, 0, 0, 0);

      const dateKey = date.toDateString();
      const dayWorkouts = workoutsByDate.get(dateKey) || [];

      days.push({
        date,
        workouts: dayWorkouts.map(workout => ({
          id: workout.id,
          name: workout.name,
          duration: workout.duration,
          totalVolume: workout.totalVolume,
          totalSets: workout.totalSets,
          exerciseCount: workout.totalExercises
        })),
        isToday: date.getTime() === today.getTime(),
        isPast: date < today,
        isCurrentMonth: false,
        dayNumber: dayNum
      });
    }
  }

  // Add days from current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const dateKey = date.toDateString();
    const dayWorkouts = workoutsByDate.get(dateKey) || [];

    days.push({
      date,
      workouts: dayWorkouts.map(workout => ({
        id: workout.id,
        name: workout.name,
        duration: workout.duration,
        totalVolume: workout.totalVolume,
        totalSets: workout.totalSets,
        exerciseCount: workout.totalExercises
      })),
      isToday: date.getTime() === today.getTime(),
      isPast: date < today,
      isCurrentMonth: true,
      dayNumber: day
    });
  }

  // Add days from next month
  for (let day = 1; day <= daysFromNextMonth; day++) {
    const date = new Date(year, month + 1, day);
    date.setHours(0, 0, 0, 0);

    const dateKey = date.toDateString();
    const dayWorkouts = workoutsByDate.get(dateKey) || [];

    days.push({
      date,
      workouts: dayWorkouts.map(workout => ({
        id: workout.id,
        name: workout.name,
        duration: workout.duration,
        totalVolume: workout.totalVolume,
        totalSets: workout.totalSets,
        exerciseCount: workout.totalExercises
      })),
      isToday: date.getTime() === today.getTime(),
      isPast: date < today,
      isCurrentMonth: false,
      dayNumber: day
    });
  }

  return {
    year,
    month,
    monthName: monthNames[month],
    days
  };
}

// Calculate weekly stats
export function calculateWeeklyStats(
  workoutHistory: WorkoutSummary[],
  exerciseHistory: ExerciseHistory[]
): WeeklyStats {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weeklyWorkouts = workoutHistory.filter(
    workout => new Date(workout.startTime) >= oneWeekAgo
  );

  const weeklyExercises = exerciseHistory.filter(
    exercise => new Date(exercise.workoutDate) >= oneWeekAgo
  );

  // Calculate most trained muscle groups
  const muscleGroupCounts: Record<string, number> = {};
  weeklyExercises.forEach(exercise => {
    exercise.muscleGroups.forEach(muscle => {
      muscleGroupCounts[muscle] = (muscleGroupCounts[muscle] || 0) + 1;
    });
  });

  const mostTrainedMuscles = Object.entries(muscleGroupCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([muscle]) => muscle);

  // Calculate consistency score (days worked out / 7)
  const uniqueWorkoutDays = new Set(
    weeklyWorkouts.map(workout =>
      new Date(workout.startTime).toDateString()
    )
  ).size;

  return {
    workoutsCompleted: weeklyWorkouts.length,
    totalVolume: weeklyWorkouts.reduce((sum, w) => sum + w.totalVolume, 0),
    totalDuration: weeklyWorkouts.reduce((sum, w) => sum + w.duration, 0),
    mostTrainedMuscles,
    streak: calculateCurrentStreak(workoutHistory),
    consistencyScore: (uniqueWorkoutDays / 7) * 100
  };
}

// Calculate monthly stats
export function calculateMonthlyStats(
  workoutHistory: WorkoutSummary[],
  exerciseHistory: ExerciseHistory[]
): MonthlyStats {
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const monthlyWorkouts = workoutHistory.filter(
    workout => new Date(workout.startTime) >= oneMonthAgo
  );

  const monthlyExercises = exerciseHistory.filter(
    exercise => new Date(exercise.workoutDate) >= oneMonthAgo
  );

  // Generate volume progression data
  const volumeProgression = generateVolumeProgression(monthlyWorkouts);

  // Count unique exercises tried
  const uniqueExercises = new Set(monthlyExercises.map(e => e.exerciseId)).size;

  // Count personal records
  const personalRecords = monthlyExercises.reduce(
    (count, exercise) => {
      const hasAnyPR = exercise.personalRecords && (
        exercise.personalRecords.maxWeight ||
        exercise.personalRecords.maxReps ||
        exercise.personalRecords.maxVolume
      );
      return count + (hasAnyPR ? 1 : 0);
    },
    0
  );

  // Calculate consistency score (days worked out / 30)
  const uniqueWorkoutDays = new Set(
    monthlyWorkouts.map(workout =>
      new Date(workout.startTime).toDateString()
    )
  ).size;

  return {
    workoutsCompleted: monthlyWorkouts.length,
    totalTrainingTime: monthlyWorkouts.reduce((sum, w) => sum + w.duration, 0),
    volumeProgression,
    consistencyScore: (uniqueWorkoutDays / 30) * 100,
    newExercisesTried: uniqueExercises,
    personalRecords
  };
}

// Generate smart highlights based on user data
export function generateHighlights(
  workoutHistory: WorkoutSummary[],
  exerciseHistory: ExerciseHistory[],
  exerciseStats: ExerciseStats[]
): HighlightData[] {
  const highlights: HighlightData[] = [];

  // Check for sustained progression
  const progressionHighlight = checkProgressionHighlight(exerciseHistory);
  if (progressionHighlight) highlights.push(progressionHighlight);

  // Check for volume PRs
  const volumeHighlight = checkVolumeHighlight(workoutHistory);
  if (volumeHighlight) highlights.push(volumeHighlight);

  // Check for consistency achievements
  const consistencyHighlight = checkConsistencyHighlight(workoutHistory);
  if (consistencyHighlight) highlights.push(consistencyHighlight);

  // Check for strength milestones
  const strengthHighlight = checkStrengthHighlight(exerciseHistory);
  if (strengthHighlight) highlights.push(strengthHighlight);

  // Check for endurance achievements
  const enduranceHighlight = checkEnduranceHighlight(workoutHistory);
  if (enduranceHighlight) highlights.push(enduranceHighlight);

  // Check for variety achievements
  const varietyHighlight = checkVarietyHighlight(exerciseHistory);
  if (varietyHighlight) highlights.push(varietyHighlight);

  return highlights.slice(0, 4); // Return top 4 highlights
}

// Helper function to calculate current streak
function calculateCurrentStreak(workoutHistory: WorkoutSummary[]): number {
  if (workoutHistory.length === 0) return 0;

  const sortedWorkouts = workoutHistory
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(23, 59, 59, 999);

  for (const workout of sortedWorkouts) {
    const workoutDate = new Date(workout.startTime);
    workoutDate.setHours(23, 59, 59, 999);

    const daysDiff = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= streak + 1) {
      if (daysDiff <= 1 || daysDiff === streak + 1) {
        streak++;
        currentDate = workoutDate;
      }
    } else {
      break;
    }
  }

  return streak;
}

// Generate volume progression data for charts
function generateVolumeProgression(workouts: WorkoutSummary[]): Array<{ date: Date; volume: number }> {
  const sortedWorkouts = workouts.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return sortedWorkouts.map(workout => ({
    date: new Date(workout.startTime),
    volume: workout.totalVolume
  }));
}

// Check for progression highlights
function checkProgressionHighlight(exerciseHistory: ExerciseHistory[]): HighlightData | null {
  // Find exercises with 3+ consecutive sessions showing progression
  const exerciseProgressions: Record<string, ExerciseHistory[]> = {};

  exerciseHistory.forEach(history => {
    if (!exerciseProgressions[history.exerciseId]) {
      exerciseProgressions[history.exerciseId] = [];
    }
    exerciseProgressions[history.exerciseId].push(history);
  });

  for (const [exerciseId, sessions] of Object.entries(exerciseProgressions)) {
    const sortedSessions = sessions.sort(
      (a, b) => new Date(a.workoutDate).getTime() - new Date(b.workoutDate).getTime()
    );

    if (sortedSessions.length >= 3) {
      let consecutiveProgression = 0;
      for (let i = 1; i < sortedSessions.length; i++) {
        if (sortedSessions[i].totalVolume > sortedSessions[i-1].totalVolume) {
          consecutiveProgression++;
        } else {
          consecutiveProgression = 0;
        }

        if (consecutiveProgression >= 3) {
          return {
            type: 'progression',
            title: 'Progressive Overload Champion! 💪',
            description: `${consecutiveProgression + 1} sessions of steady progression on ${sortedSessions[0].exerciseName}`,
            value: `+${Math.round((sortedSessions[i].totalVolume / sortedSessions[i-consecutiveProgression].totalVolume - 1) * 100)}%`,
            icon: '📈',
            isAchievement: true,
            date: new Date(sortedSessions[i].workoutDate)
          };
        }
      }
    }
  }

  return null;
}

// Check for volume highlights
function checkVolumeHighlight(workoutHistory: WorkoutSummary[]): HighlightData | null {
  if (workoutHistory.length === 0) return null;

  const maxVolumeWorkout = workoutHistory.reduce((max, workout) =>
    workout.totalVolume > max.totalVolume ? workout : max
  );

  const isRecent = new Date(maxVolumeWorkout.startTime) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (isRecent) {
    return {
      type: 'volume',
      title: 'Volume Personal Record! 🏆',
      description: `Crushed your highest volume day with ${maxVolumeWorkout.name}`,
      value: `${maxVolumeWorkout.totalVolume.toLocaleString()} lbs`,
      icon: '🔥',
      isAchievement: true,
      date: new Date(maxVolumeWorkout.startTime)
    };
  }

  return null;
}

// Check for consistency highlights
function checkConsistencyHighlight(workoutHistory: WorkoutSummary[]): HighlightData | null {
  const streak = calculateCurrentStreak(workoutHistory);

  if (streak >= 7) {
    return {
      type: 'consistency',
      title: 'Consistency Champion! ⭐',
      description: `Amazing ${streak}-day workout streak!`,
      value: `${streak} days`,
      icon: '🔥',
      isAchievement: true
    };
  }

  return null;
}

// Check for strength highlights
function checkStrengthHighlight(exerciseHistory: ExerciseHistory[]): HighlightData | null {
  const recentPRs = exerciseHistory.filter(history => {
    const isRecent = new Date(history.workoutDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hasWeightPR = history.personalRecords?.maxWeight;
    return isRecent && hasWeightPR;
  });

  if (recentPRs.length > 0) {
    const strongestPR = recentPRs.reduce((max, history) => {
      const maxWeight = Math.max(...history.sets.map(set => set.weight));
      const currentMaxWeight = Math.max(...max.sets.map(set => set.weight));
      return maxWeight > currentMaxWeight ? history : max;
    });

    const maxWeight = Math.max(...strongestPR.sets.map(set => set.weight));

    return {
      type: 'strength',
      title: 'New Strength Milestone! 💪',
      description: `Personal record on ${strongestPR.exerciseName}`,
      value: `${maxWeight} lbs`,
      icon: '🏋️',
      isAchievement: true,
      date: new Date(strongestPR.workoutDate)
    };
  }

  return null;
}

// Check for endurance highlights
function checkEnduranceHighlight(workoutHistory: WorkoutSummary[]): HighlightData | null {
  if (workoutHistory.length === 0) return null;

  const longestWorkout = workoutHistory.reduce((max, workout) =>
    workout.duration > max.duration ? workout : max
  );

  const isRecent = new Date(longestWorkout.startTime) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isSignificant = longestWorkout.duration >= 90; // 90+ minutes

  if (isRecent && isSignificant) {
    return {
      type: 'endurance',
      title: 'Endurance Beast! 🦾',
      description: `Powered through your longest session ever`,
      value: `${longestWorkout.duration} min`,
      icon: '⏱️',
      isAchievement: true,
      date: new Date(longestWorkout.startTime)
    };
  }

  return null;
}

// Check for variety highlights
function checkVarietyHighlight(exerciseHistory: ExerciseHistory[]): HighlightData | null {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentExercises = exerciseHistory.filter(
    history => new Date(history.workoutDate) >= oneWeekAgo
  );

  const uniqueExercises = new Set(recentExercises.map(history => history.exerciseId)).size;

  if (uniqueExercises >= 10) {
    return {
      type: 'variety',
      title: 'Exercise Explorer! 🎯',
      description: `Tried ${uniqueExercises} different exercises this week`,
      value: `${uniqueExercises} exercises`,
      icon: '🎪',
      isAchievement: true
    };
  }

  return null;
}