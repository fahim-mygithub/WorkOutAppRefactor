// Screen Wake Lock hook (PWA hardening §3 — "Keep screen on").
//
// Requests a screen wake lock while `enabled` is true so the display does not
// dim/sleep during a live workout. Two platform facts shape the design:
//
//   1. The browser AUTO-RELEASES the lock whenever the document becomes hidden
//      (tab switch, app backgrounded, screen off). The lock is NOT restored
//      when the page is shown again, so we must RE-ACQUIRE on `visibilitychange`
//      whenever we are visible and still want the lock.
//   2. Support is uneven: `navigator.wakeLock` is absent on many engines, and an
//      installed iOS PWA only honors it from iOS 18.4 (WebKit bug 254545). We
//      feature-detect and no-op gracefully everywhere it is unavailable.
//
// No UA sniffing — presence of `navigator.wakeLock.request` is the contract.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface WakeLockState {
  /** True when `navigator.wakeLock` is available on this platform. */
  supported: boolean;
  /** True while a screen wake lock is currently held. */
  active: boolean;
}

const isSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  'wakeLock' in navigator &&
  typeof navigator.wakeLock?.request === 'function';

/**
 * Acquire/release a screen wake lock based on `enabled`, re-acquiring after the
 * browser auto-releases it on tab hide. Safe to call where unsupported.
 *
 * @param enabled - hold the lock while true (e.g. during a live workout).
 */
export function useWakeLock(enabled: boolean): WakeLockState {
  const [supported] = useState(isSupported);
  const [active, setActive] = useState(false);

  // The live sentinel + the latest `enabled`, read inside async/event callbacks
  // without re-binding effects.
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const acquire = useCallback(async () => {
    if (!supported) return;
    // Skip if we already hold a live lock, or are no longer enabled/visible.
    if (sentinelRef.current && !sentinelRef.current.released) return;
    if (!enabledRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      return;

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      // A flag/visibility change may have raced ahead while awaiting — if we no
      // longer want the lock, release the one we just got.
      if (!enabledRef.current) {
        await sentinel.release().catch(() => {});
        return;
      }
      sentinelRef.current = sentinel;
      setActive(true);
      // The browser fires 'release' on auto-release (tab hidden) as well as our
      // own release(); reflect that in state and drop our stale reference.
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
        }
        setActive(false);
      });
    } catch {
      // Request can reject (e.g. not visible, permission/policy). No-op.
      setActive(false);
    }
  }, [supported]);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (sentinel && !sentinel.released) {
      await sentinel.release().catch(() => {});
    }
  }, []);

  // Acquire/release as the flag changes.
  useEffect(() => {
    if (!supported) return;
    if (enabled) {
      void acquire();
    } else {
      void release();
    }
  }, [enabled, supported, acquire, release]);

  // Re-acquire when we become visible again (the browser auto-released the lock
  // while hidden). Bound once; reads live state via refs.
  useEffect(() => {
    if (!supported || typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabledRef.current) {
        void acquire();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [supported, acquire]);

  // Release on unmount so the screen can sleep once the workout view is gone.
  useEffect(() => {
    return () => {
      void release();
    };
  }, [release]);

  return { supported, active };
}
