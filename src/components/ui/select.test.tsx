import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

// jsdom (the vitest environment) does not implement the pointer-capture /
// scroll / observer APIs that Radix Select touches when it opens. The shared
// src/test/setup.ts is out of scope for this primitive, so we polyfill the
// minimum surface here. These are no-ops that simply let Radix's internals run.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  } else {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// A small reusable harness exercising the full composition.
function BasicSelect({
  defaultValue,
  value,
  onValueChange,
  disabled,
  itemDisabled,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  itemDisabled?: boolean;
}) {
  return (
    <Select
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger aria-label="Muscle group">
        <SelectValue placeholder="Pick a group" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="push">Push</SelectItem>
        <SelectItem value="pull">Pull</SelectItem>
        <SelectItem value="legs" disabled={itemDisabled}>
          Legs
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('renders a trigger button with the placeholder when no value is set', () => {
    render(<BasicSelect />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/pick a group/i);
  });

  it('renders the trigger as a combobox closed by default (aria-expanded=false)', () => {
    render(<BasicSelect />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Options are not in the DOM until opened.
    expect(screen.queryByRole('option', { name: 'Push' })).not.toBeInTheDocument();
  });

  it('shows the selected label when a defaultValue is supplied', () => {
    render(<BasicSelect defaultValue="pull" />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger).toHaveTextContent('Pull');
  });

  it('opens on trigger click and reveals the options (listbox)', async () => {
    const user = userEvent.setup();
    render(<BasicSelect />);
    await user.click(screen.getByRole('combobox', { name: /muscle group/i }));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Push' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pull' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Legs' })).toBeInTheDocument();
  });

  it('selects an option on click and fires onValueChange with the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<BasicSelect onValueChange={onValueChange} />);
    await user.click(screen.getByRole('combobox', { name: /muscle group/i }));
    await user.click(await screen.findByRole('option', { name: 'Push' }));
    expect(onValueChange).toHaveBeenCalledWith('push');
  });

  it('updates the trigger label after selecting (uncontrolled)', async () => {
    const user = userEvent.setup();
    render(<BasicSelect />);
    await user.click(screen.getByRole('combobox', { name: /muscle group/i }));
    await user.click(await screen.findByRole('option', { name: 'Pull' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(
      screen.getByRole('combobox', { name: /muscle group/i }),
    ).toHaveTextContent('Pull');
  });

  it('is keyboard accessible: opens with Enter and selects with arrows + Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<BasicSelect onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    trigger.focus();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalled();
  });

  it('does not open when the whole Select is disabled', async () => {
    const user = userEvent.setup();
    render(<BasicSelect disabled />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('data-disabled');
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('applies disabled styling utilities on the trigger', () => {
    render(<BasicSelect disabled />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger.className).toMatch(/disabled:cursor-not-allowed/);
    expect(trigger.className).toMatch(/disabled:opacity-50/);
  });

  it('marks a disabled item with aria-disabled and does not select it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<BasicSelect itemDisabled onValueChange={onValueChange} />);
    await user.click(screen.getByRole('combobox', { name: /muscle group/i }));
    const legs = await screen.findByRole('option', { name: 'Legs' });
    expect(legs).toHaveAttribute('aria-disabled', 'true');
    await user.click(legs);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('uses design tokens on the trigger (no raw hex / gray-*)', () => {
    render(<BasicSelect />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger.className).toMatch(/bg-surface-raised/);
    expect(trigger.className).toMatch(/text-ink/);
    expect(trigger.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(trigger.className).not.toMatch(/(?:^|\s)(?:bg|text|border)-gray-/);
  });

  it('uses the brand focus ring token on the trigger', () => {
    render(<BasicSelect />);
    const trigger = screen.getByRole('combobox', { name: /muscle group/i });
    expect(trigger.className).toMatch(/focus-visible:ring-accent/);
  });

  it('merges a consumer className on the trigger via tailwind-merge', () => {
    render(
      <Select>
        <SelectTrigger aria-label="g" className="bg-blue-500">
          <SelectValue placeholder="p" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole('combobox', { name: 'g' });
    expect(trigger.className).toMatch(/bg-blue-500/);
    // Consumer override wins for the conflicting base utility.
    expect(trigger.className.split(/\s+/)).not.toContain('bg-surface-raised');
  });

  it('forwards the ref to the underlying trigger element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Select>
        <SelectTrigger ref={ref} aria-label="g">
          <SelectValue placeholder="p" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.getAttribute('role')).toBe('combobox');
  });

  it('forwards a ref to SelectContent when open', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(
      <Select>
        <SelectTrigger aria-label="g">
          <SelectValue placeholder="p" />
        </SelectTrigger>
        <SelectContent ref={ref}>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    await user.click(screen.getByRole('combobox', { name: 'g' }));
    await screen.findByRole('listbox');
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('forwards a ref to SelectItem', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(
      <Select>
        <SelectTrigger aria-label="g">
          <SelectValue placeholder="p" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem ref={ref} value="a">
            A
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    await user.click(screen.getByRole('combobox', { name: 'g' }));
    await screen.findByRole('option', { name: 'A' });
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute('role')).toBe('option');
  });

  it('controlled mode: reflects the value prop on the trigger', () => {
    render(<BasicSelect value="legs" onValueChange={() => {}} />);
    expect(
      screen.getByRole('combobox', { name: /muscle group/i }),
    ).toHaveTextContent('Legs');
  });

  it('all parts have displayName set for DevTools', async () => {
    const mod = await import('@/components/ui/select');
    expect(mod.SelectTrigger.displayName).toBe('SelectTrigger');
    expect(mod.SelectContent.displayName).toBe('SelectContent');
    expect(mod.SelectItem.displayName).toBe('SelectItem');
  });
});
