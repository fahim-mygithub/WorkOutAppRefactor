// useKeyboardInset: how far the on-screen keyboard covers the bottom of the
// layout viewport, plus the height that is still visible above it.
//
// iOS (Safari and the home-screen PWA) does not resize the layout viewport
// when the keyboard opens, so `position: fixed; bottom: 0` stays behind it.
// The visual viewport does shrink, so we read it and let the caller lift its
// bottom edge by `inset`. Returns zeros where visualViewport is missing.
import * as React from 'react';

export interface KeyboardInset {
  inset: number;
  visibleHeight: number | null;
}

const NONE: KeyboardInset = { inset: 0, visibleHeight: null };

export function readKeyboardInset(
  vv: Pick<VisualViewport, 'height' | 'offsetTop'> | null | undefined,
  layoutHeight: number,
): KeyboardInset {
  if (!vv) return NONE;
  const inset = Math.max(0, Math.round(layoutHeight - vv.height - vv.offsetTop));
  // Ignore tiny differences (browser toolbars), only a real keyboard counts.
  if (inset < 80) return NONE;
  return { inset, visibleHeight: Math.round(vv.height) };
}

export function useKeyboardInset(active: boolean): KeyboardInset {
  const [state, setState] = React.useState<KeyboardInset>(NONE);

  React.useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) {
      setState(NONE);
      return;
    }
    const vv = window.visualViewport;
    const update = () => {
      const next = readKeyboardInset(vv, window.innerHeight);
      setState((prev) =>
        prev.inset === next.inset && prev.visibleHeight === next.visibleHeight ? prev : next,
      );
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // The sheet can open and the keyboard rise in the same moment (the input
    // takes focus on open), and iOS may report the final size late: re-read.
    const timers = [150, 400, 800].map((ms) => window.setTimeout(update, ms));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return state;
}
