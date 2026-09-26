import { useState } from 'react';
import { WelcomeHero } from '../components/home/WelcomeHero';
import { WorkoutCalendar } from '../components/home/WorkoutCalendar';
import { TodayWorkout } from '../components/home/TodayWorkout';
import { HomeStats } from '../components/home/HomeStats';
import { BodyMuscleMap } from '../components/home/BodyMuscleMap';
import { WorkoutDayModal } from '../components/home/WorkoutDayModal';
import { useWorkoutCalendar } from '../hooks/useWorkoutCalendar';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import type { WorkoutCalendarDay } from '../utils/statsCalculator';
import { Card, CardBody } from '../components/ui/card';
import { Button } from '../components/ui/button';

/**
 * Home (Tempo "Today"): a quiet context line, one hero that answers "what now?",
 * the week at a glance, two stat tiles, then browse-by-muscle below the fold.
 */
export default function HomePage() {
  const [selectedDay, setSelectedDay] = useState<WorkoutCalendarDay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    calendarData,
    workoutHistory,
    isLoading: isCalendarLoading,
    error: calendarError,
    navigateMonth,
    goToMonth
  } = useWorkoutCalendar();

  const {
    weeklyStats,
    isLoading: isStatsLoading,
    error: statsError
  } = useWorkoutStats();

  const handleDayClick = (day: WorkoutCalendarDay) => {
    setSelectedDay(day);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedDay(null), 300); // Delay to allow modal animation
  };

  if (calendarError || statsError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <Card>
          <CardBody className="p-6 pt-6">
            <h2 className="mb-2 text-title text-ink">Couldn’t load your dashboard</h2>
            <p className="mb-5 text-body-sm text-ink-muted">
              {calendarError || statsError || 'Check your connection and try again.'}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-10 pt-5">
      <WelcomeHero />

      <TodayWorkout workoutHistory={workoutHistory} isLoading={isCalendarLoading} />

      <section aria-label="Calendar" className="border-t border-hairline pt-5">
        <WorkoutCalendar
          calendarData={calendarData}
          isLoading={isCalendarLoading}
          onDayClick={handleDayClick}
          onNavigateMonth={navigateMonth}
          onResetToCurrentMonth={() => goToMonth(new Date())}
        />
        <div className="mt-5">
          <HomeStats
            workoutHistory={workoutHistory}
            streak={weeklyStats.streak}
            isLoading={isStatsLoading || isCalendarLoading}
          />
        </div>
      </section>

      <Card>
        <CardBody className="p-5 pt-5">
          <BodyMuscleMap />
        </CardBody>
      </Card>

      <WorkoutDayModal
        day={selectedDay}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
