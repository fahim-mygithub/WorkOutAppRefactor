import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MuscleGroupIcon, type MuscleGroup } from '@/icons/MuscleGroup';

const ALL_GROUPS: readonly MuscleGroup[] = [
  'push',
  'pull',
  'legs',
  'core',
  'cardio',
  'full-body',
  'mobility',
] as const;

describe('MuscleGroupIcon', () => {
  it('renders the push variant with size and aria-label', () => {
    render(<MuscleGroupIcon group="push" size={32} aria-label="Push day" />);
    const svg = screen.getByRole('img', { name: /push day/i });
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('uses the Tabler native 24x24 viewBox', () => {
    render(<MuscleGroupIcon group="push" aria-label="Push" />);
    const svg = screen.getByRole('img', { name: /push/i });
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('defaults size to 24 when omitted', () => {
    render(<MuscleGroupIcon group="legs" aria-label="Legs" />);
    const svg = screen.getByRole('img', { name: /legs/i });
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('is aria-hidden when no aria-label is provided', () => {
    const { container } = render(<MuscleGroupIcon group="core" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('forwards className to the underlying svg', () => {
    const { container } = render(
      <MuscleGroupIcon group="cardio" className="text-muscle-cardio" />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-muscle-cardio');
  });

  it('renders every supported group without throwing', () => {
    ALL_GROUPS.forEach((g) => {
      expect(() =>
        render(<MuscleGroupIcon group={g} size={24} aria-label={g} />)
      ).not.toThrow();
    });
    // Each labeled svg should be findable individually.
    ALL_GROUPS.forEach((g) => {
      const svg = screen.getByRole('img', { name: new RegExp(`^${g}$`, 'i') });
      expect(svg).toBeInTheDocument();
    });
  });

  it('uses currentColor stroke so callers can tint via text-* classes', () => {
    const { container } = render(<MuscleGroupIcon group="pull" />);
    const svg = container.querySelector('svg');
    const path = container.querySelector('svg path');
    expect(svg).not.toBeNull();
    expect(path).not.toBeNull();
    // Tabler icons are stroke-based, not filled.
    expect(svg?.getAttribute('fill')).toBe('none');
    expect(path?.getAttribute('stroke')).toBe('currentColor');
  });
});
