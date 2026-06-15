import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useInstallPrompt,
  INSTALL_DISMISSED_KEY,
  type BeforeInstallPromptEvent,
} from '@/hooks/useInstallPrompt';

// --- Test doubles -----------------------------------------------------------

/**
 * Minimal stand-in for the Chromium-only `beforeinstallprompt` event. We model
 * `prompt()` (returns a promise) and `userChoice` (the deferred outcome) so the
 * hook's promptInstall() can be exercised end-to-end.
 */
function makeBeforeInstallPromptEvent(
  outcome: 'accepted' | 'dismissed' = 'accepted',
): BeforeInstallPromptEvent {
  const evt = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  evt.preventDefault = vi.fn();
  evt.prompt = vi.fn().mockResolvedValue({ outcome, platform: 'web' });
  // Object.defineProperty so it survives as an own-prop on the synthetic event.
  Object.defineProperty(evt, 'userChoice', {
    value: Promise.resolve({ outcome, platform: 'web' }),
    configurable: true,
  });
  return evt;
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

function setStandalone(standalone: boolean, displayMode = false) {
  // iOS Safari exposes navigator.standalone; installed Chromium exposes the
  // display-mode:standalone media query.
  Object.defineProperty(window.navigator, 'standalone', {
    value: standalone,
    configurable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('standalone') ? displayMode : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    setStandalone(false, false);
    setUserAgent(CHROME_ANDROID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with no install capability before any event fires', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isIOS).toBe(false);
    expect(result.current.isDismissed).toBe(false);
  });

  it('captures beforeinstallprompt, preventing the mini-infobar and setting canInstall', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const evt = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(evt);
    });

    expect(evt.preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(result.current.canInstall).toBe(true));
  });

  it('promptInstall() calls the deferred event prompt() and resolves the outcome', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const evt = makeBeforeInstallPromptEvent('accepted');

    act(() => {
      window.dispatchEvent(evt);
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    let outcome: string | null | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(evt.prompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
  });

  it('clears canInstall after a successful prompt (the event is single-use)', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const evt = makeBeforeInstallPromptEvent('accepted');

    act(() => {
      window.dispatchEvent(evt);
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(result.current.canInstall).toBe(false);
  });

  it('promptInstall() is a safe no-op (returns null) when no event was captured', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let outcome: string | null | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBeNull();
  });

  it('clears canInstall when the app is successfully installed (appinstalled)', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await waitFor(() => expect(result.current.canInstall).toBe(false));
  });

  describe('iOS detection', () => {
    it('flags iOS Safari (not standalone) so the UI can show manual A2HS instructions', () => {
      setUserAgent(IOS_SAFARI);
      setStandalone(false, false);
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.isIOS).toBe(true);
      expect(result.current.canInstall).toBe(false);
      expect(result.current.showIOSInstructions).toBe(true);
    });

    it('flags iOS Chrome (CriOS) as iOS too — it is still WebKit with no prompt', () => {
      setUserAgent(IOS_CHROME);
      setStandalone(false, false);
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.isIOS).toBe(true);
      expect(result.current.showIOSInstructions).toBe(true);
    });

    it('does NOT show iOS instructions when already installed (navigator.standalone)', () => {
      setUserAgent(IOS_SAFARI);
      setStandalone(true, false);
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.isIOS).toBe(true);
      expect(result.current.isStandalone).toBe(true);
      expect(result.current.showIOSInstructions).toBe(false);
    });

    it('desktop Chrome is not flagged as iOS', () => {
      setUserAgent(DESKTOP_CHROME);
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.isIOS).toBe(false);
    });
  });

  describe('standalone (already installed) detection', () => {
    it('reports standalone via display-mode media query (Chromium installed)', () => {
      setUserAgent(CHROME_ANDROID);
      setStandalone(false, true);
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.isStandalone).toBe(true);
    });
  });

  describe('dismissal persistence', () => {
    it('persists dismissal to localStorage and reflects isDismissed', () => {
      const { result } = renderHook(() => useInstallPrompt());
      act(() => {
        result.current.dismiss();
      });
      expect(result.current.isDismissed).toBe(true);
      expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBeTruthy();
    });

    it('reads a pre-existing dismissal from localStorage on mount', () => {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.isDismissed).toBe(true);
    });

    it('a dismissed iOS user no longer sees instructions', () => {
      setUserAgent(IOS_SAFARI);
      setStandalone(false, false);
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.showIOSInstructions).toBe(false);
    });
  });
});
