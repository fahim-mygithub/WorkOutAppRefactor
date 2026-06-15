import { describe, it, expect, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '@/components/ui/switch';

// Controlled harness so tests can observe consumer-side state wiring through
// Radix's onCheckedChange contract.
function ControlledHarness({
  initialChecked = false,
  onChangeSpy,
}: {
  initialChecked?: boolean;
  onChangeSpy?: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(initialChecked);
  return (
    <Switch
      aria-label="toggle me"
      checked={checked}
      onCheckedChange={(next) => {
        onChangeSpy?.(next);
        setChecked(next);
      }}
    />
  );
}

describe('Switch', () => {
  it('renders a button with role="switch"', () => {
    render(<Switch aria-label="dark mode" />);
    const sw = screen.getByRole('switch', { name: /dark mode/i });
    expect(sw.tagName).toBe('BUTTON');
  });

  it('defaults to unchecked (aria-checked="false", data-state="unchecked")', () => {
    render(<Switch aria-label="notifications" />);
    const sw = screen.getByRole('switch', { name: /notifications/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('data-state', 'unchecked');
  });

  it('honors defaultChecked for uncontrolled usage', () => {
    render(<Switch aria-label="sound" defaultChecked />);
    const sw = screen.getByRole('switch', { name: /sound/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAttribute('data-state', 'checked');
  });

  it('toggles on click (uncontrolled) and fires onCheckedChange', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="wifi" onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: /wifi/i });
    await user.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('controlled mode: reflects the checked prop and updates via consumer state', async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<ControlledHarness onChangeSpy={onChangeSpy} />);
    const sw = screen.getByRole('switch', { name: /toggle me/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(onChangeSpy).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('applies the accent token background when checked', () => {
    render(<Switch aria-label="accent on" defaultChecked />);
    const sw = screen.getByRole('switch', { name: /accent on/i });
    // Checked state drives the accent color via a data-state variant.
    expect(sw.className).toMatch(/data-\[state=checked\]:bg-accent/);
  });

  it('uses a muted track token when unchecked', () => {
    render(<Switch aria-label="track" />);
    const sw = screen.getByRole('switch', { name: /track/i });
    expect(sw.className).toMatch(/data-\[state=unchecked\]:bg-surface-subtle/);
  });

  it('renders a thumb that moves between checked/unchecked positions', () => {
    render(<Switch aria-label="thumb" defaultChecked />);
    const sw = screen.getByRole('switch', { name: /thumb/i });
    const thumb = sw.querySelector('[data-state]');
    expect(thumb).toBeInTheDocument();
    expect(thumb?.className).toMatch(/data-\[state=checked\]:translate-x/);
  });

  it('exposes a brand focus-visible ring (ring-accent)', () => {
    render(<Switch aria-label="focus" />);
    const sw = screen.getByRole('switch', { name: /focus/i });
    expect(sw.className).toMatch(/focus-visible:ring-accent/);
  });

  it('does not toggle when disabled and applies disabled styling', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Switch aria-label="locked" disabled onCheckedChange={onCheckedChange} />,
    );
    const sw = screen.getByRole('switch', { name: /locked/i });
    expect(sw).toBeDisabled();
    expect(sw.className).toMatch(/disabled:opacity/);
    expect(sw.className).toMatch(/disabled:cursor-not-allowed/);
    await user.click(sw);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('supports aria-label for accessible naming', () => {
    render(<Switch aria-label="email digest" />);
    expect(
      screen.getByRole('switch', { name: /email digest/i }),
    ).toBeInTheDocument();
  });

  it('merges a consumer className via tailwind-merge (override wins)', () => {
    render(<Switch aria-label="merge" className="bg-blue-500" />);
    const sw = screen.getByRole('switch', { name: /merge/i });
    expect(sw.className).toMatch(/bg-blue-500/);
  });

  it('forwards the ref to the underlying switch button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Switch aria-label="ref" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.getAttribute('role')).toBe('switch');
  });
});
