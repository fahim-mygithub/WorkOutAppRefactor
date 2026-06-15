import { useEffect, useState } from 'react';

export interface AppViewport {
  /** Current visual viewport height in px (visualViewport.height, or innerHeight fallback). */
  height: number;
  /** Current visual viewport width in px. */
  width: number;
  /** visualViewport.offsetTop — how far the visual vp is shifted from the layout vp top. */
  offsetTop: number;
  /** True when the keyboard (or other interactive widget) is occluding content. */
  isKeyboardOpen: boolean;
  /** Occluded height in px: layoutViewportHeight - visualViewport.height - offsetTop. 0 when closed. */
  keyboardHeight: number;
  /** True only on iOS/WebKit where we must JS-drive the shell height. */
  needsManualResize: boolean;
}

const KEYBOARD_THRESHOLD = 120;

/**
 * Detect WebKit-on-iOS, where `interactive-widget=resizes-content` is NOT
 * honored, so the layout viewport does not shrink when the keyboard opens and
 * we must JS-drive the shell height. Prefer feature detection over UA sniffing.
 */
const detectNeedsManualResize = (): boolean => {
  if (typeof window === 'undefined') return false;
  const supportsCallout =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('-webkit-touch-callout', 'none');
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return supportsCallout && isTouch;
};

const readViewport = (needsManualResize: boolean): AppViewport => {
  if (typeof window === 'undefined') {
    return {
      height: 0,
      width: 0,
      offsetTop: 0,
      isKeyboardOpen: false,
      keyboardHeight: 0,
      needsManualResize
    };
  }

  const vv = window.visualViewport;
  const layoutHeight =
    document.documentElement?.clientHeight || window.innerHeight;

  if (!vv) {
    return {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      isKeyboardOpen: false,
      keyboardHeight: 0,
      needsManualResize
    };
  }

  const keyboardHeight = Math.max(0, layoutHeight - vv.height - vv.offsetTop);

  return {
    height: vv.height,
    width: vv.width,
    offsetTop: vv.offsetTop,
    isKeyboardOpen: keyboardHeight > KEYBOARD_THRESHOLD,
    keyboardHeight,
    needsManualResize
  };
};

/**
 * Single source of truth for the visual viewport, driven by
 * `window.visualViewport`. Reports the layout the shell should use and whether
 * the on-screen keyboard is occluding content. No UA sniffing, no DOM scraping,
 * no MutationObserver.
 */
export function useAppViewport(): AppViewport {
  const [needsManualResize] = useState(detectNeedsManualResize);
  const [viewport, setViewport] = useState<AppViewport>(() =>
    readViewport(detectNeedsManualResize())
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    let frame = 0;

    const update = () => {
      frame = 0;
      setViewport(readViewport(needsManualResize));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    // Sync once on mount in case values changed before the effect ran.
    update();

    if (vv) {
      vv.addEventListener('resize', schedule);
      vv.addEventListener('scroll', schedule);
    } else {
      window.addEventListener('resize', schedule);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (vv) {
        vv.removeEventListener('resize', schedule);
        vv.removeEventListener('scroll', schedule);
      } else {
        window.removeEventListener('resize', schedule);
      }
    };
  }, [needsManualResize]);

  return viewport;
}
