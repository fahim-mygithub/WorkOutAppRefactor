import { describe, it, expect } from 'vitest';
import { readKeyboardInset } from './useKeyboardInset';

describe('readKeyboardInset', () => {
  it('is zero without a visual viewport', () => {
    expect(readKeyboardInset(null, 800)).toEqual({ inset: 0, visibleHeight: null });
  });
  it('is zero when the visual viewport fills the layout viewport', () => {
    expect(readKeyboardInset({ height: 800, offsetTop: 0 }, 800).inset).toBe(0);
  });
  it('ignores small toolbar differences', () => {
    expect(readKeyboardInset({ height: 760, offsetTop: 0 }, 800).inset).toBe(0);
  });
  it('reports the keyboard height and the visible area', () => {
    expect(readKeyboardInset({ height: 480, offsetTop: 0 }, 800)).toEqual({
      inset: 320,
      visibleHeight: 480,
    });
  });
  it('accounts for the page being scrolled by the keyboard', () => {
    expect(readKeyboardInset({ height: 480, offsetTop: 100 }, 800).inset).toBe(220);
  });
});
