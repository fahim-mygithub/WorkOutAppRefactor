import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import strengthMarkersReducer from '../../store/slices/strengthMarkersSlice';
import type { ExerciseHistory } from '../../types/exerciseHistory';
import { StrengthMarkers } from './StrengthMarkers';

const sampleHistory: ExerciseHistory[] = [
  {
    id: 'h1',
    userId: 'u1',
    exerciseId: 'bench-press',
    exerciseName: 'Barbell Bench Press',
    workoutDate: new Date('2026-11-10T10:00:00Z'),
    configuration: '3x8',
    muscleGroups: ['Chest'],
    equipment: 'Barbell',
    totalVolume: 4440,
    sets: [
      { setNumber: 1, targetReps: 8, actualReps: 8, weight: 185, unit: 'lbs', completed: true },
    ],
  },
  {
    id: 'h2',
    userId: 'u1',
    exerciseId: 'push-up',
    exerciseName: 'Push-Up',
    workoutDate: new Date('2026-11-10T10:20:00Z'),
    configuration: '3x20',
    muscleGroups: ['Chest'],
    equipment: 'Bodyweight',
    totalVolume: 0,
    sets: [
      { setNumber: 1, targetReps: 20, actualReps: 20, weight: 0, unit: 'lbs', completed: true },
    ],
  },
];

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: {
      strengthMarkers: strengthMarkersReducer,
    },
  });
  return {
    store,
    ...render(<Provider store={store}>{ui}</Provider>),
  };
}

describe('StrengthMarkers component', () => {
  it('shows empty state when no weighted sets are logged', async () => {
    const loader = vi.fn().mockResolvedValue([sampleHistory[1]]);
    renderWithStore(
      <StrengthMarkers userId="u1" historyLoader={loader} aiAvailable={false} />,
    );

    expect(await screen.findByText('No logged sets yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh with claude/i })).not.toBeInTheDocument();
  });

  it('lists weighted lifts with best set, e1RM, source label, and working weights without auto-calling AI', async () => {
    const loader = vi.fn().mockResolvedValue(sampleHistory);
    const aiReviewer = vi.fn();

    renderWithStore(
      <StrengthMarkers
        userId="u1"
        historyLoader={loader}
        aiAvailable={true}
        aiReviewer={aiReviewer}
      />,
    );

    expect(await screen.findByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Push-Up')).not.toBeInTheDocument();
    expect(screen.getByText('estimate')).toBeInTheDocument();
    expect(screen.getByText('234')).toBeInTheDocument();
    expect(screen.getByText(/185 × 8/)).toBeInTheDocument();
    expect(screen.getByText('Heavy (5-6)')).toBeInTheDocument();
    expect(screen.getByText('Moderate (8-10)')).toBeInTheDocument();
    expect(screen.getByText('Volume (12-15)')).toBeInTheDocument();

    // Never auto-call AI on load
    expect(aiReviewer).not.toHaveBeenCalled();
  });

  it('lets the user set and clear a stated max, updating e1RM and source label', async () => {
    const loader = vi.fn().mockResolvedValue(sampleHistory);
    renderWithStore(
      <StrengthMarkers userId="u1" historyLoader={loader} aiAvailable={false} />,
    );

    const rowButton = await screen.findByRole('button', { name: /Barbell Bench Press/i });
    fireEvent.click(rowButton);

    const input = await screen.findByLabelText(/Stated 1RM/i);
    fireEvent.change(input, { target: { value: '265' } });
    fireEvent.click(screen.getByRole('button', { name: /Save stated max/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('stated')).toBeInTheDocument();
    expect(screen.getByText('265')).toBeInTheDocument();

    // Re-open and clear stated max
    fireEvent.click(await screen.findByRole('button', { name: /Barbell Bench Press/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Clear stated max/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('estimate')).toBeInTheDocument();
    expect(screen.getByText('234')).toBeInTheDocument();
  });

  it('runs Claude review only when Refresh with Claude is clicked and shows Claude-reviewed source', async () => {
    const loader = vi.fn().mockResolvedValue(sampleHistory);
    const aiReviewer = vi.fn().mockResolvedValue({
      usedAi: true,
      reviews: {
        'bench-press': {
          exerciseKey: 'bench-press',
          e1RM: 242,
          note: 'Consistent 8-rep sets support ~242 lb.',
          reviewedAt: '2026-11-22T00:00:00Z',
          formulaE1RM: 234,
        },
      },
    });

    renderWithStore(
      <StrengthMarkers
        userId="u1"
        historyLoader={loader}
        aiAvailable={true}
        aiReviewer={aiReviewer}
      />,
    );

    const refreshBtn = await screen.findByRole('button', { name: /Refresh with Claude/i });
    expect(aiReviewer).not.toHaveBeenCalled();

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText('Claude-reviewed')).toBeInTheDocument();
    });
    expect(screen.getByText('242')).toBeInTheDocument();
    expect(screen.getByText('Consistent 8-rep sets support ~242 lb.')).toBeInTheDocument();
  });
});
