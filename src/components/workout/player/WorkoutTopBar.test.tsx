import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkoutTopBar, ExerciseSegmentState } from './WorkoutTopBar';

// Mock WorkoutDurationTimer
vi.mock('../WorkoutDurationTimer', () => ({
  WorkoutDurationTimer: () => <span>00:15:30</span>,
}));

describe('WorkoutTopBar', () => {
  const defaultProps = {
    name: 'Push · Volume Dumbbell',
    overallCompletedSets: 2,
    overallTotalSets: 6,
    overallPercentage: 33,
    currentExerciseNumber: 1,
    totalExercises: 3,
    segments: ['done', 'current', 'todo'] as ExerciseSegmentState[],
    onEndWorkout: vi.fn(),
  };

  it('renders workout title, variant, and timer', () => {
    render(<WorkoutTopBar {...defaultProps} />);
    expect(screen.getByText('Push')).toBeInTheDocument();
    expect(screen.getByText(/Volume Dumbbell/)).toBeInTheDocument();
    expect(screen.getByText('00:15:30')).toBeInTheDocument();
  });

  it('calls onEndWorkout when End button is clicked', async () => {
    const onEndWorkout = vi.fn();
    render(<WorkoutTopBar {...defaultProps} onEndWorkout={onEndWorkout} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'End' }));
    expect(onEndWorkout).toHaveBeenCalledOnce();
  });

  it('renders view mode toggle when onViewModeChange is provided and fires on click', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();

    render(
      <WorkoutTopBar
        {...defaultProps}
        viewMode="cards"
        onViewModeChange={onViewModeChange}
      />
    );

    const cardsBtn = screen.getByRole('button', { name: 'Cards' });
    const listBtn = screen.getByRole('button', { name: 'List' });

    expect(cardsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(listBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(listBtn);
    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('calls onSelectExercise when a segment is clicked in list mode', async () => {
    const user = userEvent.setup();
    const onSelectExercise = vi.fn();

    render(
      <WorkoutTopBar
        {...defaultProps}
        viewMode="list"
        onSelectExercise={onSelectExercise}
      />
    );

    const segmentBtn = screen.getByRole('button', { name: 'Jump to exercise 2' });
    await user.click(segmentBtn);
    expect(onSelectExercise).toHaveBeenCalledWith(1);
  });
});
