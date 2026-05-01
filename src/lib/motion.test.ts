import { describe, it, expect } from 'vitest';
import { motion as variants } from '@/lib/motion';

describe('motion variants', () => {
  it('exposes snap, smooth, slow durations (in seconds for Framer Motion)', () => {
    expect(variants.duration.snap).toBe(0.12);
    expect(variants.duration.smooth).toBe(0.22);
    expect(variants.duration.slow).toBe(0.38);
  });

  it('exposes named cubic-bezier easings', () => {
    expect(variants.ease.springSoft).toEqual([0.32, 0.72, 0, 1]);
    expect(variants.ease.springBouncy).toEqual([0.34, 1.56, 0.64, 1]);
    expect(variants.ease.easeOutExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exposes fade preset with initial/animate/exit/transition', () => {
    expect(variants.preset.fade.initial).toEqual({ opacity: 0 });
    expect(variants.preset.fade.animate).toEqual({ opacity: 1 });
    expect(variants.preset.fade.exit).toEqual({ opacity: 0 });
    expect(variants.preset.fade.transition.duration).toBe(0.22);
    expect(variants.preset.fade.transition.ease).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exposes scale preset with opacity + scale and springSoft easing', () => {
    expect(variants.preset.scale.initial).toEqual({ opacity: 0, scale: 0.96 });
    expect(variants.preset.scale.animate).toEqual({ opacity: 1, scale: 1 });
    expect(variants.preset.scale.exit).toEqual({ opacity: 0, scale: 0.96 });
    expect(variants.preset.scale.transition.duration).toBe(0.22);
    expect(variants.preset.scale.transition.ease).toEqual([0.32, 0.72, 0, 1]);
  });

  it('exposes sheetUp preset with y-axis slide and slow/springSoft transition', () => {
    expect(variants.preset.sheetUp.initial).toEqual({ y: '100%' });
    expect(variants.preset.sheetUp.animate).toEqual({ y: 0 });
    expect(variants.preset.sheetUp.exit).toEqual({ y: '100%' });
    expect(variants.preset.sheetUp.transition.duration).toBe(0.38);
    expect(variants.preset.sheetUp.transition.ease).toEqual([0.32, 0.72, 0, 1]);
  });
});
