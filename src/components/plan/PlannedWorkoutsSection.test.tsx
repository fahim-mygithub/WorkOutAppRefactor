import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import plannedWorkoutsReducer, { planAdded } from '../../store/slices/plannedWorkoutsSlice';
import workoutReducer from '../../store/slices/workoutSlice';
import userReducer from '../../store/slices/userSlice';
import trackedLiftsReducer from '../../store/slices/trackedLiftsSlice';
import { PlannedWorkoutsSection } from './PlannedWorkoutsSection';
import { toDateKey, addDaysKey } from '../../lib/dateKey';
import * as icsLib from '../../lib/ics';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('PlannedWorkoutsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => {
    const today = toDateKey(new Date());
    const yesterday = addDaysKey(today, -1);
    const tomorrow = addDaysKey(today, 1);

    const store = configureStore({
      reducer: {
        plannedWorkouts: plannedWorkoutsReducer,
        workout: workoutReducer,
        user: userReducer,
        trackedLifts: trackedLiftsReducer,
      },
    });

    // Add today plan
    store.dispatch(
      planAdded({
        id: 'plan-today',
        dateKey: today,
        name: 'Push Day Today',
        exercises: [
          {
            id: 'e-1',
            exercise: {
              id: 'bench',
              name: 'Bench Press',
              muscleGroup: 'Chest',
              muscleGroups: ['Chest'],
              equipment: 'Barbell',
              videoLinks: [],
              instructions: [],
              difficulty: 'Intermediate',
              force: null,
              grips: null,
              mechanic: null,
              searchKeywords: [],
              createdAt: '',
              updatedAt: '',
            },
            sets: [],
            restTime: 120,
          },
        ],
      }),
    );

    // Add missed plan
    store.dispatch(
      planAdded({
        id: 'plan-missed',
        dateKey: yesterday,
        name: 'Leg Day Missed',
        exercises: [],
      }),
    );

    // Add upcoming plan
    store.dispatch(
      planAdded({
        id: 'plan-upcoming',
        dateKey: tomorrow,
        name: 'Pull Day Tomorrow',
        exercises: [],
      }),
    );

    const utils = render(
      <Provider store={store}>
        <PlannedWorkoutsSection />
      </Provider>,
    );

    return { ...utils, store, today, yesterday, tomorrow };
  };

  it('renders today, missed, and upcoming plans', () => {
    setup();

    // Today section
    expect(screen.getByText('Planned today')).toBeInTheDocument();
    expect(screen.getByText('Push Day Today')).toBeInTheDocument();

    // Missed section
    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText('Leg Day Missed')).toBeInTheDocument();

    // Upcoming section
    expect(screen.getByText('Upcoming plans')).toBeInTheDocument();
    expect(screen.getByText('Pull Day Tomorrow')).toBeInTheDocument();
  });

  it('starts a today plan and navigates to /workout', () => {
    const { store } = setup();

    const startButtons = screen.getAllByRole('button', { name: /start/i });
    fireEvent.click(startButtons[0]);

    // Active workout started in store
    expect(store.getState().workout.activeWorkout?.name).toBe('Push Day Today');
    expect(mockNavigate).toHaveBeenCalledWith('/workout');
  });

  it('generates and downloads .ics file on Add to Calendar click', () => {
    const spy = vi.spyOn(icsLib, 'downloadIcsFile').mockImplementation(() => {});
    setup();

    const calendarBtns = screen.getAllByRole('button', { name: /calendar/i });
    fireEvent.click(calendarBtns[0]);

    expect(spy).toHaveBeenCalled();
  });

  it('skips a missed plan', () => {
    const { store } = setup();

    const skipBtn = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipBtn);

    const missed = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-missed');
    expect(missed?.status).toBe('skipped');
  });
});
