import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import trackedLifts, { trackedLiftsHydrated } from '../store/slices/trackedLiftsSlice';
import user from '../store/slices/userSlice';
import ai from '../store/slices/aiSlice';
import BuildWizardPage from './BuildWizardPage';
import { buildTrackedWorkout, type LiftGoals } from '../lib/trackedLiftProgression';
import type { TrackedLift, TrackedLiftsData } from '../types/trackedLifts';

vi.mock('../hooks/useExercises', () => ({
  useExercises: () => ({ exercises: [], isLoading: false }),
}));
vi.mock('../hooks/usePlannedSchedule', () => ({
  usePlannedSchedule: () => ({ activateCharlieSplit: vi.fn(), autofillMonth: vi.fn() }),
}));

const bench: TrackedLift = {
  id: 'bench',
  name: 'Bench Press',
  category: 'Push',
  load: { kind: 'weight', value: 200, unit: 'lb' },
  target: { kind: 'reps', min: 5 },
  progression: true,
};
const squat: TrackedLift = {
  id: 'squat',
  name: 'Front Squat',
  category: 'Legs',
  load: { kind: 'weight', value: 250, unit: 'lb' },
  target: { kind: 'reps', min: 3 },
  progression: true,
};
const seal: TrackedLift = {
  id: 'seal',
  name: 'Seal Row',
  category: 'Pull',
  load: { kind: 'weight', value: 160, unit: 'lb' },
  target: { kind: 'reps', min: 8 },
};

/** Captures the navigation state the chooser hands to /build/custom. */
let navState: unknown;
function BuildCustomStub() {
  navState = useLocation().state;
  return <div>custom builder</div>;
}

function renderWizard(data: TrackedLiftsData) {
  const store = configureStore({ reducer: { trackedLifts, user, ai } });
  store.dispatch(trackedLiftsHydrated(data));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/build']}>
        <Routes>
          <Route path="/build" element={<BuildWizardPage />} />
          <Route path="/build/custom" element={<BuildCustomStub />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

describe('BuildWizardPage per-lift goal', () => {
  beforeEach(() => {
    navState = undefined;
  });

  it('gives each selected progression lift its own Volume / Strength toggle', async () => {
    const u = userEvent.setup();
    renderWizard({ categories: ['Push', 'Legs', 'Pull'], lifts: [bench, squat, seal] });

    // A lift without progression gets no toggle.
    await u.click(await screen.findByRole('checkbox', { name: /Seal Row/ }));
    expect(screen.queryByRole('radiogroup', { name: 'Seal Row goal' })).not.toBeInTheDocument();

    await u.click(screen.getByRole('checkbox', { name: /Bench Press/ }));
    await u.click(screen.getByRole('checkbox', { name: /Front Squat/ }));
    const benchGoal = screen.getByRole('radiogroup', { name: 'Bench Press goal' });
    const squatGoal = screen.getByRole('radiogroup', { name: 'Front Squat goal' });

    // Choosing Strength for bench also moves the global last goal, so set squat to Volume explicitly.
    await u.click(within(squatGoal).getByRole('radio', { name: /Volume/ }));
    await u.click(within(benchGoal).getByRole('radio', { name: /Strength/ }));
    expect(within(benchGoal).getByRole('radio', { name: /Strength/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(squatGoal).getByRole('radio', { name: /Volume/ })).toHaveAttribute('aria-checked', 'true');

    await u.click(screen.getByRole('button', { name: /Build workout/ }));
    const state = navState as { goals: Record<string, string>; trackedLifts: TrackedLift[] };
    expect(state.goals).toEqual({ bench: 'strength', squat: 'volume' });

    // The per-lift map drives the sets: strength ramp for bench, volume for squat.
    const built = buildTrackedWorkout(state.trackedLifts, state.goals as LiftGoals);
    const [benchEx, squatEx] = built.exercises;
    expect(benchEx.tracked).toEqual({ liftId: 'bench', goal: 'strength' });
    expect(benchEx.sets.map((s) => s.reps)).toEqual([3, 3, 3, 3]);
    expect(squatEx.tracked).toEqual({ liftId: 'squat', goal: 'volume' });
    expect(squatEx.sets[0].reps).toEqual({ min: 8, max: 12 });
  });

  it('defaults each lift to its own last goal, else the global last goal', async () => {
    const u = userEvent.setup();
    renderWizard({
      categories: ['Push', 'Legs'],
      lifts: [{ ...bench, lastGoal: 'strength' }, squat],
      lastGoal: 'volume',
    });
    await u.click(await screen.findByRole('checkbox', { name: /Bench Press/ }));
    await u.click(screen.getByRole('checkbox', { name: /Front Squat/ }));

    expect(
      within(screen.getByRole('radiogroup', { name: 'Bench Press goal' })).getByRole('radio', { name: /Strength/ }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      within(screen.getByRole('radiogroup', { name: 'Front Squat goal' })).getByRole('radio', { name: /Volume/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the single-goal state shape when no lift is flagged for progression', async () => {
    const u = userEvent.setup();
    renderWizard({ categories: ['Pull'], lifts: [seal] });
    await u.click(await screen.findByRole('checkbox', { name: /Seal Row/ }));
    await u.click(screen.getByRole('button', { name: /Build workout/ }));
    const state = navState as { goals?: unknown; goal?: unknown };
    expect(state.goals).toBeUndefined();
    expect(state.goal).toBeUndefined();
  });
});
