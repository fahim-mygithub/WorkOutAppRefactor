import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import trackedLiftsReducer from '../../store/slices/trackedLiftsSlice';
import workoutReducer from '../../store/slices/workoutSlice';
import plannedWorkoutsReducer from '../../store/slices/plannedWorkoutsSlice';
import { CompletedWorkoutCard } from './CompletedWorkoutCard';
import { ExerciseHistoryService } from '../../services/exerciseHistoryService';
import { useExercises } from '../../hooks/useExercises';
import type { WorkoutSummary } from '../../types/exerciseHistory';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useExercises', () => ({
  useExercises: vi.fn(),
}));

vi.mock('../../services/exerciseHistoryService', () => ({
  ExerciseHistoryService: {
    getExerciseHistoryByWorkoutId: vi.fn(),
    deleteWorkoutHistory: vi.fn(),
  },
}));

describe('CompletedWorkoutCard', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(useExercises).mockReturnValue({
      exercises: [
        {
          id: 'bench',
          name: 'Bench Press',
          muscleGroup: 'Chest',
          muscleGroups: ['Chest'],
          equipment: 'Barbell',
          videoLinks: [],
          instructions: [],
          difficulty: 'Intermediate',
          force: 'Push',
          grips: null,
          mechanic: 'Compound',
          searchKeywords: [],
          createdAt: '',
        },
      ],
      isLoading: false,
      error: null,
    } as any);
  });

  afterEach(async () => {
    alertSpy.mockRestore();
    // Allow pending 10ms toast visibility timeouts to complete before jsdom teardown
    await new Promise((r) => setTimeout(r, 30));
  });

  const mockWorkout: WorkoutSummary = {
    id: 'workout-123',
    userId: 'user-456',
    name: 'Morning Chest Day',
    startTime: new Date('2026-10-20T10:00:00Z'),
    endTime: new Date('2026-10-20T11:00:00Z'),
    duration: 3600,
    totalExercises: 1,
    totalSets: 3,
    totalReps: 30,
    totalVolume: 3000,
    exercisesSummary: [
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        sets: 3,
        reps: 30,
        volume: 3000,
      },
    ],
  };

  const renderCard = (workout: WorkoutSummary = mockWorkout) => {
    const store = configureStore({
      reducer: {
        trackedLifts: trackedLiftsReducer,
        workout: workoutReducer,
        plannedWorkouts: plannedWorkoutsReducer,
      },
    });

    return render(
      <Provider store={store}>
        <MemoryRouter>
          <ul>
            <CompletedWorkoutCard workout={workout} userId="user-456" />
          </ul>
        </MemoryRouter>
      </Provider>,
    );
  };

  it('shows error toast and never calls alert when Use again -> Today lacks exercise details, and resets isLoadingStart with sheet open', async () => {
    vi.mocked(ExerciseHistoryService.getExerciseHistoryByWorkoutId).mockResolvedValue([]);

    renderCard();

    // Open detail sheet
    fireEvent.click(screen.getByText('Morning Chest Day'));

    // Click "Use again" to open Use again sheet
    const useAgainBtn = await screen.findByRole('button', { name: /use again/i });
    fireEvent.click(useAgainBtn);

    // Click "Today (start workout now)"
    const todayBtn = await screen.findByRole('button', { name: /today \(start workout now\)/i });
    fireEvent.click(todayBtn);

    // Verify alert was NOT called
    expect(alertSpy).not.toHaveBeenCalled();

    // Verify toast is shown with specific copy
    const toast = await screen.findByText(
      "This workout has no exercise details, so it can't be reused.",
    );
    expect(toast).toBeInTheDocument();

    // Verify sheet is still open and button is usable again (not stuck loading)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /today \(start workout now\)/i })).toBeEnabled();
    });
    expect(screen.getByRole('heading', { name: /use again/i })).toBeInTheDocument();
  });

  it('shows error toast and never calls alert when Use again -> Save plan lacks exercise details, and resets isLoadingStart with sheet open', async () => {
    vi.mocked(ExerciseHistoryService.getExerciseHistoryByWorkoutId).mockResolvedValue([]);

    renderCard();

    // Open detail sheet
    fireEvent.click(screen.getByText('Morning Chest Day'));

    // Click "Use again"
    const useAgainBtn = await screen.findByRole('button', { name: /use again/i });
    fireEvent.click(useAgainBtn);

    // Click "Save plan"
    const savePlanBtn = await screen.findByRole('button', { name: /save plan/i });
    fireEvent.click(savePlanBtn);

    // Verify alert was NOT called
    expect(alertSpy).not.toHaveBeenCalled();

    // Verify toast is shown with specific copy
    const toast = await screen.findByText(
      "This workout has no exercise details, so it can't be reused.",
    );
    expect(toast).toBeInTheDocument();

    // Verify sheet is still open and button is usable again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save plan/i })).toBeEnabled();
    });
    expect(screen.getByRole('heading', { name: /use again/i })).toBeInTheDocument();
  });

  it('shows info toast and never calls alert when exercise database is still loading', async () => {
    vi.mocked(useExercises).mockReturnValue({
      exercises: [],
      isLoading: true,
      error: null,
    } as any);

    renderCard();

    // Open detail sheet
    fireEvent.click(screen.getByText('Morning Chest Day'));

    // Click "Use again"
    const useAgainBtn = await screen.findByRole('button', { name: /use again/i });
    fireEvent.click(useAgainBtn);

    // Click "Today (start workout now)"
    const todayBtn = await screen.findByRole('button', { name: /today \(start workout now\)/i });
    fireEvent.click(todayBtn);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'Exercise database is still loading. Please wait a moment and try again.',
      ),
    ).toBeInTheDocument();

    // Click "Save plan"
    const savePlanBtn = await screen.findByRole('button', { name: /save plan/i });
    fireEvent.click(savePlanBtn);

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows error toast when starting workout encounters unexpected error', async () => {
    vi.mocked(ExerciseHistoryService.getExerciseHistoryByWorkoutId).mockRejectedValue(
      new Error('Network error'),
    );

    renderCard();

    // Open detail sheet
    fireEvent.click(screen.getByText('Morning Chest Day'));

    // Click "Use again"
    const useAgainBtn = await screen.findByRole('button', { name: /use again/i });
    fireEvent.click(useAgainBtn);

    // Click "Today (start workout now)"
    const todayBtn = await screen.findByRole('button', { name: /today \(start workout now\)/i });
    fireEvent.click(todayBtn);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Failed to start workout. Please try again.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /today \(start workout now\)/i })).toBeEnabled();
    });
  });

  it('shows error toast when planning workout encounters unexpected error', async () => {
    vi.mocked(ExerciseHistoryService.getExerciseHistoryByWorkoutId).mockRejectedValue(
      new Error('Network error'),
    );

    renderCard();

    // Open detail sheet
    fireEvent.click(screen.getByText('Morning Chest Day'));

    // Click "Use again"
    const useAgainBtn = await screen.findByRole('button', { name: /use again/i });
    fireEvent.click(useAgainBtn);

    // Click "Save plan"
    const savePlanBtn = await screen.findByRole('button', { name: /save plan/i });
    fireEvent.click(savePlanBtn);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Failed to plan workout. Please try again.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save plan/i })).toBeEnabled();
    });
  });

  it('shows error toast when delete fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(ExerciseHistoryService.deleteWorkoutHistory).mockRejectedValue(
      new Error('Delete error'),
    );

    renderCard();

    // Open detail sheet
    fireEvent.click(screen.getByText('Morning Chest Day'));

    // Click "Delete"
    const deleteBtn = await screen.findByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Failed to delete workout. Please try again.')).toBeInTheDocument();
  });
});
