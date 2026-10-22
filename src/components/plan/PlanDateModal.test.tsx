import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PlanDateModal } from './PlanDateModal';
import { toDateKey, addDaysKey } from '../../lib/dateKey';

describe('PlanDateModal', () => {
  const today = toDateKey(new Date());
  const yesterday = addDaysKey(today, -1);
  const tomorrow = addDaysKey(today, 1);

  it('sets min attribute to today and defaults past initialDateKey to tomorrow', () => {
    const onConfirm = vi.fn();
    render(
      <PlanDateModal
        open={true}
        onOpenChange={vi.fn()}
        title="Move Workout"
        initialDateKey={yesterday}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText(/choose date/i) as HTMLInputElement;
    expect(input.getAttribute('min')).toBe(today);
    // Should NOT default to the past date
    expect(input.value).toBe(tomorrow);
  });

  it('disables submit if a past date is set and prevents confirmation', () => {
    const onConfirm = vi.fn();
    render(
      <PlanDateModal
        open={true}
        onOpenChange={vi.fn()}
        title="Schedule Workout"
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText(/choose date/i);
    fireEvent.change(input, { target: { value: yesterday } });

    const submitBtn = screen.getByRole('button', { name: /save plan/i });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(submitBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('allows selecting today or a future date and confirms', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <PlanDateModal
        open={true}
        onOpenChange={onOpenChange}
        title="Schedule Workout"
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByLabelText(/choose date/i);
    const dayAfterTomorrow = addDaysKey(today, 2);
    fireEvent.change(input, { target: { value: dayAfterTomorrow } });

    const submitBtn = screen.getByRole('button', { name: /save plan/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(onConfirm).toHaveBeenCalledWith(dayAfterTomorrow);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
