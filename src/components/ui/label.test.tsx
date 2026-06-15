import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Label, labelVariants } from '@/components/ui/label';

describe('Label', () => {
  it('renders a <label> with the provided text', () => {
    render(<Label>Email</Label>);
    const label = screen.getByText('Email');
    expect(label.tagName).toBe('LABEL');
  });

  it('applies token-based ink text colour by default', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email').className).toMatch(/text-ink/);
  });

  it('associates with a control via htmlFor (a11y)', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    );
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email');
  });

  it('size="md" is the default and uses the body-sm type scale', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email').className).toMatch(/text-body-sm/);
  });

  it('size="sm" uses the smaller caption type scale', () => {
    render(<Label size="sm">Email</Label>);
    expect(screen.getByText('Email').className).toMatch(/text-caption/);
  });

  it('renders a required indicator when required is set', () => {
    render(<Label required>Email</Label>);
    const indicator = screen.getByTestId('label-required-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('*');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator.className).toMatch(/text-danger/);
  });

  it('does not render a required indicator by default', () => {
    render(<Label>Email</Label>);
    expect(
      screen.queryByTestId('label-required-indicator'),
    ).not.toBeInTheDocument();
  });

  it('reflects disabled state via a data attribute and dimmed styling', () => {
    render(<Label disabled>Email</Label>);
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('data-disabled', 'true');
    expect(label.className).toMatch(/data-\[disabled=true\]:opacity-/);
    expect(label.className).toMatch(/data-\[disabled=true\]:cursor-not-allowed/);
  });

  it('omits the data-disabled attribute when not disabled', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).not.toHaveAttribute('data-disabled');
  });

  it('forwards refs to the underlying <label>', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Email</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    expect(ref.current?.tagName).toBe('LABEL');
  });

  it('merges a consumer className via tailwind-merge (override wins)', () => {
    render(<Label className="text-blue-500">Email</Label>);
    const label = screen.getByText('Email');
    expect(label.className).toMatch(/text-blue-500/);
    const tokens = label.className.split(/\s+/);
    expect(tokens).not.toContain('text-ink');
  });

  it('exports a labelVariants helper that returns class strings', () => {
    expect(typeof labelVariants).toBe('function');
    expect(labelVariants({ size: 'sm' })).toMatch(/text-caption/);
    expect(labelVariants({ size: 'md' })).toMatch(/text-body-sm/);
  });
});
