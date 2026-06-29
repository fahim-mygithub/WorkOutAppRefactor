import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetInput } from '@/components/SetInput';

const noop = () => {};

describe('SetInput — prescribed rep range', () => {
  it('renders the range "10–15" (not the single configured rep count) when repMin ≠ repMax', () => {
    const set = { id: 's1', reps: 13, repMin: 10, repMax: 15, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={noop} onUncomplete={noop} />);

    expect(screen.getByText('10–15')).toBeInTheDocument();
    // The midpoint/configured "13" must not leak into the UI — the range governs.
    expect(screen.queryByText('13')).not.toBeInTheDocument();
  });

  it('defaults the editable Reps input to the range floor (repMin)', () => {
    const set = { id: 's1', reps: 13, repMin: 10, repMax: 15, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={noop} onUncomplete={noop} />);

    expect(screen.getByLabelText('Reps')).toHaveValue(10);
  });

  it('shows no range hint when repMin equals repMax (single target)', () => {
    const set = { id: 's1', reps: 8, repMin: 8, repMax: 8, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={noop} onUncomplete={noop} />);

    expect(screen.queryByText('8–8')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toHaveValue(8);
  });
});
