import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UndoToast, UNDO_MS } from './UndoToast';

afterEach(() => {
  vi.useRealTimers();
});

describe('UndoToast', () => {
  it('shows the message as a status', () => {
    render(<UndoToast message="Remaining sets at 205 lb" onUndo={() => {}} onDone={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Remaining sets at 205 lb');
  });

  it('undoes on tap', async () => {
    const onUndo = vi.fn();
    const onDone = vi.fn();
    const u = userEvent.setup();
    render(<UndoToast message="Remaining sets at 205 lb" onUndo={onUndo} onDone={onDone} />);
    await u.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('closes itself after 8 seconds', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<UndoToast message="x" onUndo={() => {}} onDone={onDone} />);
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(UNDO_MS).toBe(8000);
  });

  it('keeps the message as the status, without the Undo label', () => {
    render(<UndoToast message="Remaining sets at 205 lb" onUndo={() => {}} onDone={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^Remaining sets at 205 lb$/);
  });

  it('waits while focused and restarts the full 8s on blur', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<UndoToast message="x" onUndo={() => {}} onDone={onDone} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    act(() => vi.advanceTimersByTime(4000));
    act(() => undo.focus());
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(onDone).not.toHaveBeenCalled();
    act(() => undo.blur());
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('waits while hovered and restarts the full 8s on mouse leave', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<UndoToast message="x" onUndo={() => {}} onDone={onDone} />);
    const toast = screen.getByTestId('undo-toast');
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(UNDO_MS * 2));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when the mouse leaves but focus is still inside', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<UndoToast message="x" onUndo={() => {}} onDone={onDone} />);
    const toast = screen.getByTestId('undo-toast');
    fireEvent.mouseEnter(toast);
    act(() => screen.getByRole('button', { name: 'Undo' }).focus());
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not restart the timer when re-rendered with a new onDone', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<UndoToast message="x" onUndo={() => {}} onDone={first} />);
    act(() => vi.advanceTimersByTime(5000));
    rerender(<UndoToast message="x" onUndo={() => {}} onDone={second} />);
    act(() => vi.advanceTimersByTime(3000));
    // Fires on the original schedule, calling the latest callback.
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
