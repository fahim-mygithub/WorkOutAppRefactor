import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('SetInput — optional RIR tap', () => {
  it('passes the tapped RIR through onComplete', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const set = { id: 's1', reps: 8, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={onComplete} onUncomplete={noop} />);

    await user.click(screen.getByRole('button', { name: 'RIR 2' }));
    await user.click(screen.getByRole('button', { name: /log set/i }));

    expect(onComplete).toHaveBeenCalledWith(8, 50, 2);
  });

  it('leaves RIR undefined when the lifter skips it (default)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const set = { id: 's1', reps: 8, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={onComplete} onUncomplete={noop} />);

    await user.click(screen.getByRole('button', { name: /log set/i }));

    expect(onComplete).toHaveBeenCalledWith(8, 50, undefined);
  });

  it('clears the RIR back to skipped when the active chip is tapped again', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const set = { id: 's1', reps: 8, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={onComplete} onUncomplete={noop} />);

    const chip = screen.getByRole('button', { name: 'RIR 2' });
    await user.click(chip); // select
    await user.click(chip); // toggle back off
    await user.click(screen.getByRole('button', { name: /log set/i }));

    expect(onComplete).toHaveBeenCalledWith(8, 50, undefined);
  });
});

describe('SetInput — Tempo steppers', () => {
  it('steps weight by 5 and reps by 1, and logs the stepped values', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const set = { id: 's1', reps: 8, weight: 50, completed: false };
    render(<SetInput set={set} onComplete={onComplete} onUncomplete={noop} />);

    await user.click(screen.getByRole('button', { name: /increase weight/i }));
    await user.click(screen.getByRole('button', { name: /increase weight/i }));
    await user.click(screen.getByRole('button', { name: /decrease reps/i }));
    expect(screen.getByLabelText('Weight')).toHaveValue(60);
    expect(screen.getByLabelText('Reps')).toHaveValue(7);

    await user.click(screen.getByRole('button', { name: /log set/i }));
    expect(onComplete).toHaveBeenCalledWith(7, 60, undefined);
  });

  it('never steps below zero', async () => {
    const user = userEvent.setup();
    const set = { id: 's1', reps: 1, weight: 0, completed: false };
    render(<SetInput set={set} onComplete={noop} onUncomplete={noop} />);

    await user.click(screen.getByRole('button', { name: /decrease weight/i }));
    await user.click(screen.getByRole('button', { name: /decrease reps/i }));
    await user.click(screen.getByRole('button', { name: /decrease reps/i }));
    expect(screen.getByLabelText('Weight')).toHaveValue(0);
    expect(screen.getByLabelText('Reps')).toHaveValue(0);
  });
});
