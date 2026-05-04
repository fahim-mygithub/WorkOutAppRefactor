import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconButton } from '@/components/ui/icon-button';

// Minimal stand-in for an icon. Real consumers pass a Lucide component instance,
// but for tests we just need a recognizable child node.
function TestIcon() {
  return <svg data-testid="test-icon" aria-hidden="true" />;
}

describe('IconButton', () => {
  it('renders a <button> with the icon child inside', () => {
    render(
      <IconButton aria-label="Save">
        <TestIcon />
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toContainElement(screen.getByTestId('test-icon'));
  });

  it('forwards aria-label to the button element', () => {
    render(
      <IconButton aria-label="Delete item">
        <TestIcon />
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: /delete item/i });
    expect(btn).toHaveAttribute('aria-label', 'Delete item');
  });

  it('defaults type to "button"', () => {
    render(
      <IconButton aria-label="x">
        <TestIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'x' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('respects an explicit type override (e.g. "submit")', () => {
    render(
      <IconButton aria-label="Send" type="submit">
        <TestIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Save" onClick={onClick}>
        <TestIcon />
      </IconButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled and applies disabled styling', async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Save" disabled onClick={onClick}>
        <TestIcon />
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toMatch(/disabled:opacity/);
    expect(btn.className).toMatch(/disabled:pointer-events-none/);
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the primary variant by default (bg-accent)', () => {
    render(
      <IconButton aria-label="x">
        <TestIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'x' }).className).toMatch(
      /bg-accent/,
    );
  });

  it('applies the secondary variant class (bg-surface-raised)', () => {
    render(
      <IconButton aria-label="x" variant="secondary">
        <TestIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'x' }).className).toMatch(
      /bg-surface-raised/,
    );
  });

  it('applies the ghost variant (no solid bg-accent/danger, hover bg-surface-subtle)', () => {
    render(
      <IconButton aria-label="x" variant="ghost">
        <TestIcon />
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'x' });
    expect(btn.className).toMatch(/hover:bg-surface-subtle/);
    const tokens = btn.className.split(/\s+/);
    expect(tokens).not.toContain('bg-accent');
    expect(tokens).not.toContain('bg-danger');
  });

  it('applies the danger variant class (bg-danger)', () => {
    render(
      <IconButton aria-label="Delete" variant="danger">
        <TestIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: /delete/i }).className).toMatch(
      /bg-danger/,
    );
  });

  it('size="sm" is square 36x36 (h-9 + w-9)', () => {
    render(
      <IconButton aria-label="x" size="sm">
        <TestIcon />
      </IconButton>,
    );
    const cls = screen.getByRole('button', { name: 'x' }).className;
    expect(cls).toMatch(/(?:^|\s)h-9(?:\s|$)/);
    expect(cls).toMatch(/(?:^|\s)w-9(?:\s|$)/);
  });

  it('size="md" (default) hits the 44px touch-min floor on both axes', () => {
    render(
      <IconButton aria-label="x">
        <TestIcon />
      </IconButton>,
    );
    const cls = screen.getByRole('button', { name: 'x' }).className;
    expect(cls).toMatch(/min-h-touch-min/);
    expect(cls).toMatch(/min-w-touch-min/);
  });

  it('size="lg" hits the 56px touch-lg floor on both axes', () => {
    render(
      <IconButton aria-label="x" size="lg">
        <TestIcon />
      </IconButton>,
    );
    const cls = screen.getByRole('button', { name: 'x' }).className;
    expect(cls).toMatch(/min-h-touch-lg/);
    expect(cls).toMatch(/min-w-touch-lg/);
  });

  it('forwards refs to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton aria-label="x" ref={ref}>
        <TestIcon />
      </IconButton>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('asChild renders the child element (e.g. an <a>) and inherits its semantics', () => {
    render(
      <IconButton asChild aria-label="Go" variant="primary" size="lg">
        <a href="/go" data-testid="link-as-icon-button">
          <TestIcon />
        </a>
      </IconButton>,
    );
    // No nested <button> wrapper
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const link = screen.getByTestId('link-as-icon-button');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/go');
    expect(link).toHaveAttribute('aria-label', 'Go');
    expect(link.className).toMatch(/bg-accent/);
    expect(link.className).toMatch(/min-h-touch-lg/);
    expect(link.className).toMatch(/min-w-touch-lg/);
  });

  it('merges consumer className via tailwind-merge (custom class wins over default)', () => {
    render(
      <IconButton aria-label="x" variant="primary" className="bg-blue-500">
        <TestIcon />
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'x' });
    expect(btn.className).toMatch(/bg-blue-500/);
    const tokens = btn.className.split(/\s+/);
    expect(tokens).not.toContain('bg-accent');
  });

  it('exports an iconButtonVariants helper that returns class strings', async () => {
    const mod = await import('@/components/ui/icon-button');
    expect(typeof mod.iconButtonVariants).toBe('function');
    const cls = mod.iconButtonVariants({ variant: 'danger', size: 'sm' });
    expect(cls).toMatch(/bg-danger/);
    expect(cls).toMatch(/(?:^|\s)h-9(?:\s|$)/);
    expect(cls).toMatch(/(?:^|\s)w-9(?:\s|$)/);
  });
});
