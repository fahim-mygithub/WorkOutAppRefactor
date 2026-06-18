/**
 * home-calendar-showcase.tsx — DEV-ONLY verification harness for the reworked
 * Home calendar (week strip by default, expand to full month). Renders the real
 * WorkoutCalendar with mock workout data, side-by-side in LIGHT and DARK, and in
 * BOTH the collapsed (week) and expanded (month, via `initialExpanded`) states.
 * The live expand/collapse toggle also works interactively on each instance.
 *
 * Served at /home-calendar-showcase.html in `vite dev`. Not wired into the app
 * or the production build. Mirrors board-showcase.tsx: each column wraps its
 * subtree in a `.light` / `.dark` class so the tokens.css palette blocks resolve
 * per column while sharing one document.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import '../App.css';
import '../styles/animations.css';
import '../styles/board.css';
import { BoardFilters } from '../components/BoardFilters';
import { WorkoutCalendar } from '../components/home/WorkoutCalendar';
import { BodyMuscleMap } from '../components/home/BodyMuscleMap';
import { Card, CardBody } from '../components/ui/card';
import { generateCalendarData } from '../utils/statsCalculator';

const noop = () => {};

// Build mock workout summaries spread across the current month so both the week
// strip (today's week) and the month grid show muscle glyphs + intensities.
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const d = now.getDate();

const mockNames = ['Push Day', 'Pull Day', 'Leg Day', 'Core & Cardio', 'Full Body', 'Mobility Flow'];

// Day-of-month numbers to seed (clamped to valid days), including recent days in
// today's week and several earlier in the month for the expanded view.
const seedDays = Array.from(
  new Set([d, d - 1, d - 3, d - 5, 3, 6, 9, 12, 15, 18].filter((n) => n >= 1 && n <= 28)),
);

const mockHistory = seedDays.map((dayNum, i) => {
  const start = new Date(y, m, dayNum, 18, 0, 0);
  return {
    id: `mock-${dayNum}`,
    userId: 'demo',
    name: mockNames[i % mockNames.length],
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60 * 1000),
    duration: 45 + (i % 4) * 12,
    totalExercises: 4 + (i % 3),
    totalSets: 14 + (i % 5) * 2,
    totalReps: 120 + i * 7,
    totalVolume: 8000 + i * 850,
    exercisesSummary: [],
  };
}) as any[];

const calendarData = generateCalendarData(mockHistory, now);

const Column: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => (
  <div className={theme}>
    <div className="min-h-screen bg-surface p-4 space-y-6 text-ink">
      <p className="font-marker text-caption uppercase tracking-widest text-ink-subtle">
        {theme === 'light' ? 'Whiteboard — light' : 'Chalkboard — dark'}
      </p>

      <div>
        <p className="mb-2 font-marker text-body-sm text-ink-muted">Merged module — collapsed (week)</p>
        <Card>
          <CardBody className="space-y-5 p-6 pt-6">
            <h1 className="font-marker text-title leading-snug text-ink">
              Here are your Workouts for this week, Fahim!
            </h1>
            <WorkoutCalendar
              calendarData={calendarData}
              isLoading={false}
              onDayClick={noop}
              onNavigateMonth={noop}
              onResetToCurrentMonth={noop}
            />
          </CardBody>
        </Card>
      </div>

      <div>
        <p className="mb-2 font-marker text-body-sm text-ink-muted">Expanded (month)</p>
        <Card>
          <CardBody className="space-y-5 p-6 pt-6">
            <h1 className="font-marker text-title leading-snug text-ink">
              Here are your Workouts for this week, Fahim!
            </h1>
            <WorkoutCalendar
              calendarData={calendarData}
              isLoading={false}
              onDayClick={noop}
              onNavigateMonth={noop}
              onResetToCurrentMonth={noop}
              initialExpanded
            />
          </CardBody>
        </Card>
      </div>

      <div>
        <p className="mb-2 font-marker text-body-sm text-ink-muted">
          Muscle map (front + back; toggle shows below md)
        </p>
        <Card>
          <CardBody className="p-6 pt-6">
            <BodyMuscleMap />
          </CardBody>
        </Card>
      </div>
    </div>
  </div>
);

const ShowcaseApp: React.FC = () => (
  <MemoryRouter>
    <BoardFilters />
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <Column theme="light" />
      <Column theme="dark" />
    </div>
  </MemoryRouter>
);

const el = document.getElementById('calendar-root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ShowcaseApp />
    </React.StrictMode>,
  );
}
