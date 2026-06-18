/**
 * board-showcase.tsx — DEV-ONLY verification harness for the whiteboard/chalkboard
 * theme. Renders the live /workout components with mock data, side-by-side in
 * LIGHT and DARK, with no auth / no router / no autoplaying video (those froze
 * the renderer when screenshotting the real route). Served at /board-showcase.html
 * in `vite dev`. Not wired into the app or the production build.
 *
 * Both columns wrap their subtree in a `.light` / `.dark` class — the token
 * blocks in tokens.css are defined on those selectors, so each column resolves
 * its own palette while sharing one document.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import '../App.css';
import '../styles/animations.css';
import '../styles/board.css';
import { StoreProvider } from '../providers/StoreProvider';
import { BoardFilters } from '../components/BoardFilters';
import { WorkoutHeader } from '../components/workout/WorkoutHeader';
import { SetInput } from '../components/SetInput';
import { SetList } from '../components/workout/SetList';
import { WorkoutNextActionBanner } from '../components/workout/WorkoutNextActionBanner';
import { RestTimer } from '../components/RestTimer';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const noop = () => {};

const mockSets = [
  { id: 's1', reps: 10, weight: 185, completed: true },
  { id: 's2', reps: 8, weight: 185, completed: true },
  { id: 's3', reps: 8, weight: 190, completed: false },
  { id: 's4', reps: 8, weight: 190, completed: false },
] as any[];

const BoardPanel: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-screen bg-surface p-4 space-y-6 text-ink">
    <p className="font-marker text-caption uppercase tracking-widest text-ink-subtle">
      {label}
    </p>

    <WorkoutHeader
      name="Push Day"
      overallCompletedSets={6}
      overallTotalSets={16}
      overallPercentage={38}
      currentExerciseNumber={2}
      totalExercises={5}
      currentExerciseCompletedSets={2}
      currentExerciseTotalSets={4}
      onEndWorkout={noop}
    />

    <Card elevation={1} className="space-y-5 p-6">
      <h2 className="font-marker text-display leading-none text-ink">
        Bench Press
      </h2>

      <WorkoutNextActionBanner
        restActive={false}
        restTimeRemaining={0}
        currentSetCompleted={false}
        currentSetNumber={3}
        hasNextSet
      />

      <div>
        <h3 className="mb-3 font-marker text-title text-ink">
          Current set{' '}
          <span className="font-num font-tabular text-accent">3</span>
          <span className="text-ink-subtle"> / </span>
          <span className="font-num font-tabular">4</span>
        </h3>
        <SetInput
          set={mockSets[2]}
          onComplete={noop}
          onUncomplete={noop}
          previousSet={mockSets[1]}
          allSets={mockSets}
        />
      </div>

      <SetList
        sets={mockSets}
        currentSetIndex={2}
        onJumpToSet={noop}
        onAddSet={noop}
      />
    </Card>

    {/* A completed-set entry to show that state too */}
    <Card elevation={1} className="space-y-3 p-6">
      <h3 className="font-marker text-title text-ink">Completed-set state</h3>
      <SetInput
        set={mockSets[0]}
        onComplete={noop}
        onUncomplete={noop}
        previousSet={null}
        allSets={mockSets}
      />
    </Card>

    <RestTimer />

    <WorkoutNextActionBanner
      restActive
      restTimeRemaining={90}
      currentSetCompleted={false}
      currentSetNumber={3}
      hasNextSet
    />

    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  </div>
);

const ShowcaseApp: React.FC = () => (
  <StoreProvider>
    <BoardFilters />
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <div className="light">
        <BoardPanel label="Whiteboard — light" />
      </div>
      <div className="dark">
        <BoardPanel label="Chalkboard — dark" />
      </div>
    </div>
  </StoreProvider>
);

const el = document.getElementById('board-root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ShowcaseApp />
    </React.StrictMode>,
  );
}
