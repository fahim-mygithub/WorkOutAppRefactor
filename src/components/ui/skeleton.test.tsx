import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton, skeletonVariants } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('renders a <div> by default', () => {
    render(<Skeleton data-testid="skel" />);
    const el = screen.getByTestId('skel');
    expect(el.tagName).toBe('DIV');
  });

  it('applies bg-surface-subtle base class by default', () => {
    render(<Skeleton data-testid="skel" />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    expect(tokens).toContain('bg-surface-subtle');
  });

  it('applies rounded-md base class by default', () => {
    render(<Skeleton data-testid="skel" />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    expect(tokens).toContain('rounded-md');
  });

  it('applies motion-safe:animate-pulse by default (pulse=true)', () => {
    render(<Skeleton data-testid="skel" />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    expect(tokens).toContain('motion-safe:animate-pulse');
  });

  it('pulse={false} removes the motion-safe:animate-pulse class', () => {
    render(<Skeleton data-testid="skel" pulse={false} />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    expect(tokens).not.toContain('motion-safe:animate-pulse');
  });

  it('pulse={true} explicitly applies motion-safe:animate-pulse', () => {
    render(<Skeleton data-testid="skel" pulse={true} />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    expect(tokens).toContain('motion-safe:animate-pulse');
  });

  it('as="span" renders a <span> element', () => {
    render(<Skeleton data-testid="skel" as="span" />);
    const el = screen.getByTestId('skel');
    expect(el.tagName).toBe('SPAN');
  });

  it('as="div" (default) renders a <div> element', () => {
    render(<Skeleton data-testid="skel" as="div" />);
    const el = screen.getByTestId('skel');
    expect(el.tagName).toBe('DIV');
  });

  it('renders with aria-hidden="true" by default', () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId('skel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('consumer can override aria-hidden via prop spread', () => {
    render(<Skeleton data-testid="skel" aria-hidden={false} />);
    expect(screen.getByTestId('skel')).toHaveAttribute('aria-hidden', 'false');
  });

  it('merges consumer className via tailwind-merge', () => {
    render(<Skeleton data-testid="skel" className="rounded-full" />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    // tailwind-merge collapses conflicting rounded utilities; consumer wins
    expect(tokens).toContain('rounded-full');
    expect(tokens).not.toContain('rounded-md');
  });

  it('forwards consumer-supplied sizing classes (h-4 w-32)', () => {
    render(<Skeleton data-testid="skel" className="h-4 w-32" />);
    const tokens = screen.getByTestId('skel').className.split(/\s+/);
    expect(tokens).toContain('h-4');
    expect(tokens).toContain('w-32');
    // Base classes still present alongside sizing
    expect(tokens).toContain('bg-surface-subtle');
  });

  it('forwards ref to the underlying <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} data-testid="skel" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('forwards ref to the underlying <span> when as="span"', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} as="span" data-testid="skel" />);
    // Same ref type — the underlying DOM node is a <span> (still an HTMLElement)
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe('SPAN');
  });

  it('forwards arbitrary element attrs (id, data-*)', () => {
    render(<Skeleton data-testid="skel" id="skel-1" data-loading="true" />);
    const el = screen.getByTestId('skel');
    expect(el).toHaveAttribute('id', 'skel-1');
    expect(el).toHaveAttribute('data-loading', 'true');
  });
});

describe('skeletonVariants', () => {
  it('is exported and callable, returning a class string', () => {
    expect(typeof skeletonVariants).toBe('function');
    const cls = skeletonVariants();
    expect(typeof cls).toBe('string');
  });

  it('default invocation includes bg-surface-subtle, rounded-md, motion-safe:animate-pulse', () => {
    const cls = skeletonVariants();
    expect(cls).toMatch(/bg-surface-subtle/);
    expect(cls).toMatch(/rounded-md/);
    expect(cls).toMatch(/motion-safe:animate-pulse/);
  });

  it('pulse=false omits motion-safe:animate-pulse', () => {
    const cls = skeletonVariants({ pulse: false });
    expect(cls).not.toMatch(/animate-pulse/);
    expect(cls).toMatch(/bg-surface-subtle/);
    expect(cls).toMatch(/rounded-md/);
  });
});
