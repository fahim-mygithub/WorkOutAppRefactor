import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Stack, stackVariants } from '@/components/ui/stack';

describe('Stack', () => {
  it('renders a <div> with default classes (flex flex-col gap-4 items-stretch justify-start, no flex-wrap)', () => {
    render(<Stack data-testid="stack">content</Stack>);
    const el = screen.getByTestId('stack');
    expect(el.tagName).toBe('DIV');
    const tokens = el.className.split(/\s+/);
    expect(tokens).toContain('flex');
    expect(tokens).toContain('flex-col');
    expect(tokens).toContain('gap-4');
    expect(tokens).toContain('items-stretch');
    expect(tokens).toContain('justify-start');
    expect(tokens).not.toContain('flex-wrap');
  });

  it('renders children inside', () => {
    render(
      <Stack data-testid="stack">
        <span data-testid="child">hello</span>
      </Stack>,
    );
    const parent = screen.getByTestId('stack');
    const child = screen.getByTestId('child');
    expect(parent).toContainElement(child);
    expect(child.textContent).toBe('hello');
  });

  it('direction="row" applies flex-row', () => {
    render(
      <Stack data-testid="stack" direction="row">
        x
      </Stack>,
    );
    const tokens = screen.getByTestId('stack').className.split(/\s+/);
    expect(tokens).toContain('flex-row');
    expect(tokens).not.toContain('flex-col');
  });

  it('direction="column" applies flex-col', () => {
    render(
      <Stack data-testid="stack" direction="column">
        x
      </Stack>,
    );
    const tokens = screen.getByTestId('stack').className.split(/\s+/);
    expect(tokens).toContain('flex-col');
    expect(tokens).not.toContain('flex-row');
  });

  it('gap=0 applies gap-0', () => {
    render(
      <Stack data-testid="stack" gap={0}>
        x
      </Stack>,
    );
    const tokens = screen.getByTestId('stack').className.split(/\s+/);
    expect(tokens).toContain('gap-0');
  });

  it('gap=4 (default) applies gap-4', () => {
    render(
      <Stack data-testid="stack" gap={4}>
        x
      </Stack>,
    );
    const tokens = screen.getByTestId('stack').className.split(/\s+/);
    expect(tokens).toContain('gap-4');
  });

  it('gap=12 applies gap-12', () => {
    render(
      <Stack data-testid="stack" gap={12}>
        x
      </Stack>,
    );
    const tokens = screen.getByTestId('stack').className.split(/\s+/);
    expect(tokens).toContain('gap-12');
  });

  it('gap=1 applies gap-1', () => {
    render(
      <Stack data-testid="stack" gap={1}>
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'gap-1',
    );
  });

  it('gap=8 applies gap-8', () => {
    render(
      <Stack data-testid="stack" gap={8}>
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'gap-8',
    );
  });

  it('align="start" applies items-start', () => {
    render(
      <Stack data-testid="stack" align="start">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'items-start',
    );
  });

  it('align="center" applies items-center', () => {
    render(
      <Stack data-testid="stack" align="center">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'items-center',
    );
  });

  it('align="end" applies items-end', () => {
    render(
      <Stack data-testid="stack" align="end">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'items-end',
    );
  });

  it('align="stretch" applies items-stretch', () => {
    render(
      <Stack data-testid="stack" align="stretch">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'items-stretch',
    );
  });

  it('align="baseline" applies items-baseline', () => {
    render(
      <Stack data-testid="stack" align="baseline">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'items-baseline',
    );
  });

  it('justify="start" applies justify-start', () => {
    render(
      <Stack data-testid="stack" justify="start">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'justify-start',
    );
  });

  it('justify="center" applies justify-center', () => {
    render(
      <Stack data-testid="stack" justify="center">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'justify-center',
    );
  });

  it('justify="end" applies justify-end', () => {
    render(
      <Stack data-testid="stack" justify="end">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'justify-end',
    );
  });

  it('justify="between" applies justify-between', () => {
    render(
      <Stack data-testid="stack" justify="between">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'justify-between',
    );
  });

  it('justify="around" applies justify-around', () => {
    render(
      <Stack data-testid="stack" justify="around">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'justify-around',
    );
  });

  it('justify="evenly" applies justify-evenly', () => {
    render(
      <Stack data-testid="stack" justify="evenly">
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'justify-evenly',
    );
  });

  it('wrap=true applies flex-wrap', () => {
    render(
      <Stack data-testid="stack" wrap>
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).toContain(
      'flex-wrap',
    );
  });

  it('wrap=false (default) omits flex-wrap', () => {
    render(<Stack data-testid="stack">x</Stack>);
    expect(screen.getByTestId('stack').className.split(/\s+/)).not.toContain(
      'flex-wrap',
    );
  });

  it('wrap=false explicitly omits flex-wrap', () => {
    render(
      <Stack data-testid="stack" wrap={false}>
        x
      </Stack>,
    );
    expect(screen.getByTestId('stack').className.split(/\s+/)).not.toContain(
      'flex-wrap',
    );
  });

  it('forwards ref to the underlying <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Stack ref={ref} data-testid="stack">
        x
      </Stack>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('merges consumer className via tailwind-merge (custom flex direction wins)', () => {
    render(
      <Stack data-testid="stack" className="flex-row">
        x
      </Stack>,
    );
    const tokens = screen.getByTestId('stack').className.split(/\s+/);
    expect(tokens).toContain('flex-row');
    expect(tokens).not.toContain('flex-col');
  });

  it('forwards arbitrary div props (id, role, aria-*)', () => {
    render(
      <Stack
        data-testid="stack"
        id="stack-1"
        role="group"
        aria-label="my stack"
      >
        x
      </Stack>,
    );
    const el = screen.getByTestId('stack');
    expect(el).toHaveAttribute('id', 'stack-1');
    expect(el).toHaveAttribute('role', 'group');
    expect(el).toHaveAttribute('aria-label', 'my stack');
  });
});

describe('stackVariants', () => {
  it('is exported and callable, returning a class string', () => {
    expect(typeof stackVariants).toBe('function');
    const cls = stackVariants();
    expect(typeof cls).toBe('string');
    expect(cls).toMatch(/flex/);
  });

  it('returns flex-col, gap-4, items-stretch, justify-start by default', () => {
    const cls = stackVariants();
    expect(cls).toMatch(/flex-col/);
    expect(cls).toMatch(/gap-4/);
    expect(cls).toMatch(/items-stretch/);
    expect(cls).toMatch(/justify-start/);
  });

  it('honors explicit variant args', () => {
    const cls = stackVariants({
      direction: 'row',
      gap: 12,
      align: 'center',
      justify: 'between',
      wrap: true,
    });
    expect(cls).toMatch(/flex-row/);
    expect(cls).toMatch(/gap-12/);
    expect(cls).toMatch(/items-center/);
    expect(cls).toMatch(/justify-between/);
    expect(cls).toMatch(/flex-wrap/);
  });
});
