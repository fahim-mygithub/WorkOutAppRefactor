import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWakeLock } from '@/hooks/useWakeLock';

// ---------------------------------------------------------------------------
// Fake Screen Wake Lock implementation.
//
// The real API is:
//   navigator.wakeLock.request('screen') -> Promise<WakeLockSentinel>
//   sentinel.release() -> Promise<void>; sets sentinel.released = true and
//   fires a 'release' event. The browser ALSO auto-releases (and fires
//   'release') when the document is hidden, which is what we re-acquire from on
//   visibilitychange. This fake models both paths.
// ---------------------------------------------------------------------------
class FakeSentinel implements EventTarget {
  type = 'screen' as const;
  released = false;
  private listeners = new Set<EventListener>();

  addEventListener(_type: string, cb: EventListener): void {
    this.listeners.add(cb);
  }
  removeEventListener(_type: string, cb: EventListener): void {
    this.listeners.delete(cb);
  }
  dispatchEvent(_evt: Event): boolean {
    return true;
  }

  /** Simulate the browser auto-releasing the lock (e.g. tab hidden). */
  autoRelease(): void {
    if (this.released) return;
    this.released = true;
    for (const cb of this.listeners) cb(new Event('release'));
  }

  release = vi.fn(async () => {
    this.released = true;
    for (const cb of this.listeners) cb(new Event('release'));
  });
}

function installWakeLock() {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(async (type: 'screen') => {
    const s = new FakeSentinel();
    s.type = type;
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
    writable: true,
  });
  return { request, sentinels };
}

function removeWakeLock() {
  // Make the API absent so the hook hits its unsupported path.
  Object.defineProperty(navigator, 'wakeLock', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useWakeLock', () => {
  beforeEach(() => {
    setVisibility('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset the API descriptor between tests.
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  describe('feature detection', () => {
    it('reports supported:false and never requests when the API is absent', async () => {
      removeWakeLock();
      const { result } = renderHook(() => useWakeLock(true));

      expect(result.current.supported).toBe(false);
      // Give any stray async request a chance to (not) fire.
      await act(async () => {});
      expect(result.current.active).toBe(false);
    });

    it('reports supported:true when navigator.wakeLock exists', () => {
      installWakeLock();
      const { result } = renderHook(() => useWakeLock(false));
      expect(result.current.supported).toBe(true);
    });

    it('does not throw on an unsupported platform when toggled', () => {
      removeWakeLock();
      const { rerender } = renderHook(({ on }) => useWakeLock(on), {
        initialProps: { on: false },
      });
      expect(() => rerender({ on: true })).not.toThrow();
    });
  });

  describe('acquire / release by flag', () => {
    it('requests a screen lock when enabled is true', async () => {
      const { request } = installWakeLock();
      const { result } = renderHook(() => useWakeLock(true));

      await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
      await waitFor(() => expect(result.current.active).toBe(true));
    });

    it('does not request a lock when enabled is false', async () => {
      const { request } = installWakeLock();
      const { result } = renderHook(() => useWakeLock(false));

      await act(async () => {});
      expect(request).not.toHaveBeenCalled();
      expect(result.current.active).toBe(false);
    });

    it('acquires when the flag flips false -> true', async () => {
      const { request } = installWakeLock();
      const { rerender } = renderHook(({ on }) => useWakeLock(on), {
        initialProps: { on: false },
      });
      expect(request).not.toHaveBeenCalled();

      rerender({ on: true });
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    });

    it('releases the held lock when the flag flips true -> false', async () => {
      const { request, sentinels } = installWakeLock();
      const { result, rerender } = renderHook(({ on }) => useWakeLock(on), {
        initialProps: { on: true },
      });

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(result.current.active).toBe(true));

      rerender({ on: false });

      await waitFor(() => expect(sentinels[0].release).toHaveBeenCalled());
      await waitFor(() => expect(result.current.active).toBe(false));
    });
  });

  describe('visibilitychange re-acquire', () => {
    it('re-acquires after the browser auto-releases on hide, when becoming visible again', async () => {
      const { request, sentinels } = installWakeLock();
      renderHook(() => useWakeLock(true));

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

      // Browser auto-releases the lock when the tab is hidden.
      act(() => {
        sentinels[0].autoRelease();
        setVisibility('hidden');
      });

      // No new request while hidden.
      expect(request).toHaveBeenCalledTimes(1);

      // Becoming visible again re-acquires.
      act(() => setVisibility('visible'));
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    });

    it('does not re-acquire on visibilitychange when disabled', async () => {
      const { request } = installWakeLock();
      renderHook(() => useWakeLock(false));

      act(() => setVisibility('hidden'));
      act(() => setVisibility('visible'));

      await act(async () => {});
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('releases the lock on unmount', async () => {
      const { request, sentinels } = installWakeLock();
      const { unmount } = renderHook(() => useWakeLock(true));

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

      unmount();

      await waitFor(() => expect(sentinels[0].release).toHaveBeenCalled());
    });

    it('removes the visibilitychange listener on unmount', async () => {
      installWakeLock();
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHook(() => useWakeLock(true));

      unmount();

      expect(removeSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });
  });
});
