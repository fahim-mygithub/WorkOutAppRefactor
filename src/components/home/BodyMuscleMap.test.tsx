import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BodyMuscleMap } from './BodyMuscleMap';
import type { HeatLevel } from '../../lib/muscleHeat';

const FRONT = '<svg><g id="biceps" class="bodymap"></g><g id="front-shoulders" class="bodymap"></g><g id="chest" class="bodymap"></g></svg>';
const BACK = '<svg><g id="rear-shoulders" class="bodymap"></g><g id="lats" class="bodymap"></g></svg>';

function renderMap(heat: Record<string, HeatLevel>) {
  return render(
    <MemoryRouter>
      <BodyMuscleMap frontSvg={FRONT} backSvg={BACK} heat={heat} />
    </MemoryRouter>,
  );
}

describe('BodyMuscleMap heat', () => {
  it('shades worked muscles on both figures and leaves the rest', () => {
    const { container } = renderMap({ Biceps: 'warm', Shoulders: 'hot' });
    const heatOf = (id: string) => container.querySelector(`g#${id}`)?.getAttribute('data-heat');
    expect(heatOf('biceps')).toBe('warm');
    expect(heatOf('front-shoulders')).toBe('hot');
    expect(heatOf('rear-shoulders')).toBe('hot');
    expect(heatOf('chest')).toBeNull();
    expect(heatOf('lats')).toBeNull();
  });

  it('clears shading when a muscle cools', () => {
    const { container, rerender } = renderMap({ Chest: 'hot' });
    rerender(
      <MemoryRouter>
        <BodyMuscleMap frontSvg={FRONT} backSvg={BACK} heat={{}} />
      </MemoryRouter>,
    );
    expect(container.querySelector('g#chest')?.getAttribute('data-heat')).toBeNull();
  });
});
