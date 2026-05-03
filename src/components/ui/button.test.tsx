import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders a <button> by default with type="button"', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('respects an explicit type override (e.g. "submit")', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: /send/i })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled and applies disabled styling', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toMatch(/disabled:opacity/);
    expect(btn.className).toMatch(/disabled:pointer-events-none/);
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the danger variant class (bg-danger)', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button', { name: /delete/i });
    expect(btn.className).toMatch(/bg-danger/);
  });

  it('applies the primary variant by default (bg-accent)', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: /save/i }).className).toMatch(
      /bg-accent/,
    );
  });

  it('applies the secondary variant class (bg-surface-raised)', () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole('button', { name: /cancel/i }).className).toMatch(
      /bg-surface-raised/,
    );
  });

  it('applies the ghost variant (no solid background, hover bg-surface-subtle)', () => {
    render(<Button variant="ghost">More</Button>);
    const btn = screen.getByRole('button', { name: /more/i });
    expect(btn.className).toMatch(/hover:bg-surface-subtle/);
    expect(btn.className).not.toMatch(/(?:^|\s)bg-accent(?:\s|$)/);
    expect(btn.className).not.toMatch(/(?:^|\s)bg-danger(?:\s|$)/);
  });

  it('size="sm" uses min-h-9 (compact desktop UI)', () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole('button', { name: 'x' }).className).toMatch(
      /min-h-9/,
    );
  });

  it('size="md" (default) meets the 44px touch-min floor', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button', { name: 'x' }).className).toMatch(
      /min-h-touch-min/,
    );
  });

  it('size="lg" uses the 56px touch-lg floor', () => {
    render(<Button size="lg">x</Button>);
    expect(screen.getByRole('button', { name: 'x' }).className).toMatch(
      /min-h-touch-lg/,
    );
  });

  it('forwards refs to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('asChild renders the child element instead of a <button> and applies button classes to it', () => {
    render(
      <Button asChild variant="primary" size="lg">
        <a href="/go" data-testid="link-as-button">
          Go
        </a>
      </Button>,
    );
    // No nested <button> wrapper
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const link = screen.getByTestId('link-as-button');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/go');
    expect(link.className).toMatch(/bg-accent/);
    expect(link.className).toMatch(/min-h-touch-lg/);
  });

  it('merges consumer className with internal classes (tailwind-merge dedupes conflicts)', () => {
    render(
      <Button variant="primary" className="bg-blue-500">
        x
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'x' });
    // Consumer override wins for the conflicting base utility.
    // tailwind-merge correctly preserves variant-prefixed classes
    // (e.g. hover:bg-accent/90) since they target different states.
    expect(btn.className).toMatch(/bg-blue-500/);
    // Tokenize and assert the bare `bg-accent` utility is gone.
    const tokens = btn.className.split(/\s+/);
    expect(tokens).not.toContain('bg-accent');
  });

  it('exports a buttonVariants helper that returns class strings', async () => {
    const mod = await import('@/components/ui/button');
    expect(typeof mod.buttonVariants).toBe('function');
    const cls = mod.buttonVariants({ variant: 'danger', size: 'sm' });
    expect(cls).toMatch(/bg-danger/);
    expect(cls).toMatch(/min-h-9/);
  });
});
