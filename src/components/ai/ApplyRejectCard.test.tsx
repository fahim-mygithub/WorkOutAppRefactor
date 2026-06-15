import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ApplyRejectCard,
  type AiToolProposal,
} from '@/components/ai/ApplyRejectCard';

const proposal: AiToolProposal = {
  id: 'tool-1',
  tool: 'add_exercise',
  summary: 'Add Bench Press: 3 sets of 10',
  detail: 'Targets chest, triceps.',
  input: { name: 'Bench Press', sets: 3, reps: 10 },
};

describe('ApplyRejectCard', () => {
  it('renders the tool name, summary, detail and input preview', () => {
    render(
      <ApplyRejectCard
        proposal={proposal}
        onApply={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('add_exercise')).toBeInTheDocument();
    expect(
      screen.getByText('Add Bench Press: 3 sets of 10'),
    ).toBeInTheDocument();
    expect(screen.getByText('Targets chest, triceps.')).toBeInTheDocument();
    const preview = screen.getByTestId('apply-reject-input');
    expect(preview.textContent).toContain('Bench Press');
  });

  it('omits the input preview when no input is supplied', () => {
    render(
      <ApplyRejectCard
        proposal={{ id: 'p', tool: 't', summary: 's' }}
        onApply={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.queryByTestId('apply-reject-input')).not.toBeInTheDocument();
  });

  it('calls onApply with the proposal when Apply is clicked', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ApplyRejectCard
        proposal={proposal}
        onApply={onApply}
        onReject={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(proposal);
  });

  it('calls onReject with the proposal when Reject is clicked', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(
      <ApplyRejectCard
        proposal={proposal}
        onApply={() => {}}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith(proposal);
  });

  it('uncontrolled: locks to "Applied" after Apply and hides the buttons', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ApplyRejectCard
        proposal={proposal}
        onApply={onApply}
        onReject={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /apply/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reject/i }),
    ).not.toBeInTheDocument();
    // Cannot fire twice.
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('controlled decision renders resolved state and disables further clicks', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(
      <ApplyRejectCard
        proposal={proposal}
        decision="rejected"
        onApply={() => {}}
        onReject={onReject}
      />,
    );
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reject/i }),
    ).not.toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
  });

  it('does not fire callbacks when disabled', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ApplyRejectCard
        proposal={proposal}
        disabled
        onApply={onApply}
        onReject={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('exposes the decision via data-decision attribute', async () => {
    const user = userEvent.setup();
    render(
      <ApplyRejectCard
        proposal={proposal}
        onApply={() => {}}
        onReject={() => {}}
      />,
    );
    const card = screen.getByTestId('apply-reject-card');
    expect(card).toHaveAttribute('data-decision', 'pending');
    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(card).toHaveAttribute('data-decision', 'applied');
  });

  it('forwards ref to the root element', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ApplyRejectCard
        ref={ref}
        proposal={proposal}
        onApply={() => {}}
        onReject={() => {}}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute('data-testid', 'apply-reject-card');
  });
});
