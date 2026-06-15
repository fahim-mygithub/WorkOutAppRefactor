import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '@/components/ui/textarea';

describe('Textarea', () => {
  it('renders a native <textarea>', () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el.tagName).toBe('TEXTAREA');
  });

  it('applies base token styling (bg-surface, text-ink, rounded-md)', () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el.className).toMatch(/bg-surface/);
    expect(el.className).toMatch(/text-ink/);
    expect(el.className).toMatch(/rounded-md/);
  });

  it('uses a brand-accent focus ring (focus-visible:ring-accent)', () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el.className).toMatch(/focus-visible:ring-accent/);
  });

  it('does not use raw gray-* or hex utilities (token discipline)', () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el.className).not.toMatch(/(?:^|\s)(?:bg|text|border)-gray-/);
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('reflects error state with aria-invalid and danger border', () => {
    render(<Textarea aria-label="notes" error />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el.className).toMatch(/border-danger/);
  });

  it('does not set aria-invalid when error is absent', () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('respects an explicit aria-invalid override', () => {
    render(<Textarea aria-label="notes" aria-invalid />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts and renders a value via change events', async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="notes" onChange={onChange} />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    await userEvent.type(el, 'hi');
    expect(onChange).toHaveBeenCalled();
    expect(el).toHaveValue('hi');
  });

  it('forwards the rows prop to the native element', () => {
    render(<Textarea aria-label="notes" rows={6} />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el).toHaveAttribute('rows', '6');
  });

  it('passes through arbitrary native props (placeholder, name, maxLength)', () => {
    render(
      <Textarea
        aria-label="notes"
        placeholder="Type here"
        name="bio"
        maxLength={140}
      />,
    );
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el).toHaveAttribute('placeholder', 'Type here');
    expect(el).toHaveAttribute('name', 'bio');
    expect(el).toHaveAttribute('maxlength', '140');
  });

  it('is disabled and unfocusable when disabled, with disabled styling', async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="notes" disabled onChange={onChange} />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el).toBeDisabled();
    expect(el.className).toMatch(/disabled:opacity/);
    expect(el.className).toMatch(/disabled:cursor-not-allowed/);
    await userEvent.type(el, 'nope');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('forwards refs to the underlying <textarea>', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="notes" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current?.tagName).toBe('TEXTAREA');
  });

  it('merges consumer className (tailwind-merge dedupes conflicts)', () => {
    render(<Textarea aria-label="notes" className="bg-card" />);
    const el = screen.getByRole('textbox', { name: /notes/i });
    expect(el.className).toMatch(/bg-card/);
    const tokens = el.className.split(/\s+/);
    expect(tokens).not.toContain('bg-surface');
  });

  it('exports a textareaVariants helper returning class strings', async () => {
    const mod = await import('@/components/ui/textarea');
    expect(typeof mod.textareaVariants).toBe('function');
    expect(mod.textareaVariants({ error: true })).toMatch(/border-danger/);
  });
});
