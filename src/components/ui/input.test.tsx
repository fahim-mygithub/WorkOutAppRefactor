import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, inputVariants } from '@/components/ui/input';

describe('Input', () => {
  it('renders a native <input>', () => {
    render(<Input data-testid="inp" />);
    const el = screen.getByTestId('inp');
    expect(el.tagName).toBe('INPUT');
  });

  it('defaults to type="text"', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp')).toHaveAttribute('type', 'text');
  });

  it('respects an explicit type override (e.g. "email")', () => {
    render(<Input type="email" data-testid="inp" />);
    expect(screen.getByTestId('inp')).toHaveAttribute('type', 'email');
  });

  it('applies the surface background base class by default', () => {
    render(<Input data-testid="inp" />);
    const tokens = screen.getByTestId('inp').className.split(/\s+/);
    expect(tokens).toContain('bg-surface');
  });

  it('applies the border token base class by default', () => {
    render(<Input data-testid="inp" />);
    const tokens = screen.getByTestId('inp').className.split(/\s+/);
    expect(tokens).toContain('border-border');
  });

  it('applies a focus-visible accent ring', () => {
    render(<Input data-testid="inp" />);
    const cls = screen.getByTestId('inp').className;
    expect(cls).toMatch(/focus-visible:ring-2/);
    expect(cls).toMatch(/focus-visible:ring-accent/);
  });

  it('uses ink text and ink-subtle placeholder tokens (no raw gray)', () => {
    render(<Input data-testid="inp" />);
    const cls = screen.getByTestId('inp').className;
    // ink color is declared in the variant source; assert on inputVariants()
    // because tailwind-merge folds it into the text-* group with the font-size
    // utility at the DOM layer (same pattern as Button's ghost variant).
    expect(inputVariants()).toMatch(/(?:^|\s)text-ink(?:\s|$)/);
    expect(cls).toMatch(/placeholder:text-ink-subtle/);
    // No raw tailwind gray utilities or hex colors.
    expect(cls).not.toMatch(/(?:text|bg|border)-gray-/);
    expect(cls).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('size="md" is the default and meets the 44px touch-min floor', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp').className).toMatch(/min-h-touch-min/);
  });

  it('size="md" explicitly applies min-h-touch-min', () => {
    render(<Input size="md" data-testid="inp" />);
    expect(screen.getByTestId('inp').className).toMatch(/min-h-touch-min/);
  });

  it('size="sm" uses the compact min-h-9 floor', () => {
    render(<Input size="sm" data-testid="inp" />);
    const cls = screen.getByTestId('inp').className;
    expect(cls).toMatch(/min-h-9/);
    expect(cls).not.toMatch(/min-h-touch-min/);
  });

  it('renders error styling when aria-invalid is set', () => {
    render(<Input aria-invalid data-testid="inp" />);
    const el = screen.getByTestId('inp');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    // Error state surfaces the danger token on border + ring.
    expect(el.className).toMatch(/aria-\[invalid=true\]:border-danger/);
    expect(el.className).toMatch(/aria-\[invalid=true\]:focus-visible:ring-danger/);
  });

  it('does not mark a valid input as invalid', () => {
    render(<Input data-testid="inp" />);
    expect(screen.getByTestId('inp')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('applies disabled styling and is non-interactive when disabled', async () => {
    const onChange = vi.fn();
    render(<Input disabled onChange={onChange} data-testid="inp" />);
    const el = screen.getByTestId('inp') as HTMLInputElement;
    expect(el).toBeDisabled();
    expect(el.className).toMatch(/disabled:opacity/);
    expect(el.className).toMatch(/disabled:cursor-not-allowed/);
    await userEvent.type(el, 'abc');
    expect(el.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts typed input and fires onChange', async () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} data-testid="inp" />);
    const el = screen.getByTestId('inp') as HTMLInputElement;
    await userEvent.type(el, 'hi');
    expect(el.value).toBe('hi');
    expect(onChange).toHaveBeenCalled();
  });

  it('is associated with a label via htmlFor/id (a11y)', () => {
    render(
      <>
        <label htmlFor="email">Email</label>
        <Input id="email" type="email" />
      </>,
    );
    expect(screen.getByLabelText('Email')).toBe(
      document.getElementById('email'),
    );
  });

  it('forwards aria-describedby for error message wiring', () => {
    render(<Input aria-invalid aria-describedby="err-1" data-testid="inp" />);
    expect(screen.getByTestId('inp')).toHaveAttribute(
      'aria-describedby',
      'err-1',
    );
  });

  it('forwards placeholder, name, and value props', () => {
    render(
      <Input
        name="username"
        placeholder="Your name"
        defaultValue="fahim"
        data-testid="inp"
      />,
    );
    const el = screen.getByTestId('inp') as HTMLInputElement;
    expect(el).toHaveAttribute('name', 'username');
    expect(el).toHaveAttribute('placeholder', 'Your name');
    expect(el.value).toBe('fahim');
  });

  it('forwards ref to the underlying <input>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} data-testid="inp" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('merges consumer className via tailwind-merge (consumer wins on conflicts)', () => {
    render(<Input className="bg-surface-raised" data-testid="inp" />);
    const tokens = screen.getByTestId('inp').className.split(/\s+/);
    expect(tokens).toContain('bg-surface-raised');
    expect(tokens).not.toContain('bg-surface');
  });
});

describe('inputVariants', () => {
  it('is exported and callable, returning a class string', () => {
    expect(typeof inputVariants).toBe('function');
    expect(typeof inputVariants()).toBe('string');
  });

  it('default invocation includes bg-surface, border-border, and min-h-touch-min', () => {
    const cls = inputVariants();
    expect(cls).toMatch(/bg-surface/);
    expect(cls).toMatch(/border-border/);
    expect(cls).toMatch(/min-h-touch-min/);
  });

  it('size="sm" returns the compact min-h-9 floor', () => {
    const cls = inputVariants({ size: 'sm' });
    expect(cls).toMatch(/min-h-9/);
  });
});
