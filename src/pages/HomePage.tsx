import { useState } from 'react';
import { WelcomeHero } from '../components/home/WelcomeHero';
import { WorkoutCalendar } from '../components/home/WorkoutCalendar';
import { StatsGrid } from '../components/home/StatsGrid';
import { HighlightsCarousel } from '../components/home/HighlightsCarousel';
import { WorkoutDayModal } from '../components/home/WorkoutDayModal';
import { useWorkoutCalendar } from '../hooks/useWorkoutCalendar';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import { useHighlights } from '../hooks/useHighlights';
import type { WorkoutCalendarDay } from '../utils/statsCalculator';
import { Card, CardBody } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function HomePage() {
  const [selectedDay, setSelectedDay] = useState<WorkoutCalendarDay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch data using custom hooks
  const {
    calendarData,
    currentDate,
    isLoading: isCalendarLoading,
    error: calendarError,
    navigateMonth
  } = useWorkoutCalendar();

  const {
    weeklyStats,
    monthlyStats,
    lastWorkoutStats,
    isLoading: isStatsLoading,
    error: statsError
  } = useWorkoutStats();

  const {
    highlights,
    isLoading: isHighlightsLoading,
    error: highlightsError
  } = useHighlights();

  const handleDayClick = (day: WorkoutCalendarDay) => {
    setSelectedDay(day);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedDay(null), 300); // Delay to allow modal animation
  };

  // Show error state if there are critical errors
  if (calendarError || statsError || highlightsError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border border-danger/20 bg-danger/10 text-center">
          <CardBody className="p-6 pt-6">
            <h2 className="mb-2 text-title font-semibold text-danger">
              Unable to load dashboard
            </h2>
            <p className="mb-4 text-body-sm text-ink-muted">
              {calendarError || statsError || highlightsError || 'An unexpected error occurred'}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Welcome Section */}
      <WelcomeHero
        lastWorkoutStats={lastWorkoutStats}
        currentStreak={weeklyStats.streak}
        isLoading={isStatsLoading}
      />

      {/* Calendar Section */}
      <WorkoutCalendar
        calendarData={calendarData}
        isLoading={isCalendarLoading}
        onDayClick={handleDayClick}
        onNavigateMonth={navigateMonth}
      />

      {/* Stats Grid */}
      <StatsGrid
        weeklyStats={weeklyStats}
        monthlyStats={monthlyStats}
        lastWorkoutStats={lastWorkoutStats}
        isLoading={isStatsLoading}
      />

      {/* Highlights */}
      <HighlightsCarousel
        highlights={highlights}
        isLoading={isHighlightsLoading}
      />

      {/* Day Detail Modal */}
      <WorkoutDayModal
        day={selectedDay}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}