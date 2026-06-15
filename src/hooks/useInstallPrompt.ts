// PWA install-prompt support (design §3, "Install to home screen").
//
// Two distinct platform realities are unified behind one hook:
//
//  • Android / Chromium: the browser fires `beforeinstallprompt`. We MUST
//    preventDefault() to suppress the mini-infobar and stash the event so we
//    can replay it from our own UI via `promptInstall()`. The event is
//    single-use, so after a prompt (or `appinstalled`) we drop it.
//
//  • iOS Safari (and all iOS browsers — they are WebKit with no
//    `beforeinstallprompt`): no programmatic prompt exists. The user must use
//    Share → Add to Home Screen. We detect iOS + not-already-standalone and
//    expose `showIOSInstructions` so the UI can render manual guidance.
//
// Dismissal is persisted to localStorage so the banner doesn't nag on every
// load. Already-installed (standalone) sessions surface nothing.
import { useCallback, useEffect, useMemo, useState } from 'react';

/** localStorage key recording when the user dismissed the install prompt. */
export const INSTALL_DISMISSED_KEY = 'workout:install-prompt-dismissed';

/**
 * The Chromium-only `beforeinstallprompt` event. Not in the DOM lib typings,
 * so we declare the slice we use. `prompt()` shows the native dialog;
 * `userChoice` resolves with the user's decision.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed';

export interface UseInstallPromptResult {
  /** True when a `beforeinstallprompt` event was captured and can be replayed. */
  canInstall: boolean;
  /** True on any iOS browser (all are WebKit, none expose a prompt). */
  isIOS: boolean;
  /** True when running as an installed/standalone PWA. */
  isStandalone: boolean;
  /** True when the user previously dismissed our prompt (persisted). */
  isDismissed: boolean;
  /**
   * True when we should surface manual iOS "Share → Add to Home Screen"
   * instructions: iOS, not already installed, not dismissed.
   */
  showIOSInstructions: boolean;
  /**
   * Replay the captured native prompt. Resolves with the outcome, or `null`
   * when there is nothing to prompt (e.g. iOS, or already consumed).
   */
  promptInstall: () => Promise<InstallOutcome | null>;
  /** Persistently dismiss the prompt. */
  dismiss: () => void;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports as "Macintosh" but is touch-capable; cover both.
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari exposes the legacy navigator.standalone instead.
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) != null;
  } catch {
    // Private mode / storage disabled — treat as not dismissed.
    return false;
  }
}

export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(readDismissed);

  // Platform facts are stable for the session; compute once.
  const isIOS = useMemo(detectIOS, []);
  const isStandalone = useMemo(detectStandalone, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      // Suppress Chrome's mini-infobar; we drive the UI ourselves.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      // Event is single-use and now irrelevant.
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome | null> => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    // The event cannot be reused; drop it so canInstall flips false.
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures; still reflect dismissal in-session.
    }
    setIsDismissed(true);
  }, []);

  const canInstall = deferredPrompt !== null && !isStandalone && !isDismissed;
  const showIOSInstructions =
    isIOS && !isStandalone && !isDismissed;

  return {
    canInstall,
    isIOS,
    isStandalone,
    isDismissed,
    showIOSInstructions,
    promptInstall,
    dismiss,
  };
}
