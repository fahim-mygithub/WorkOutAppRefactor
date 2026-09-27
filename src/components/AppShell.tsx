import React from 'react';
import { BottomNavigation } from './BottomNavigation';
import { useAppViewport } from '../hooks/useAppViewport';
import { useScheduleSync } from '../hooks/useScheduleSync';
import { useTrackedLiftsSync } from '../hooks/useTrackedLiftsSync';
import { NewBestSheet } from './build/NewBestSheet';
import { APP_SCROLL_ID } from '../lib/scroll';

export interface AppShellProps {
  children: React.ReactNode;
  /** Chromeless mode: false hides the bottom nav (auth pages, anonymous viewers). */
  showNav?: boolean;
  /** Optional sticky header rendered above the scroll container. */
  header?: React.ReactNode;
}

/**
 * The single canonical app shell.
 *
 * Layout (per design §2):
 *   body { height:100svh; overflow:hidden; overscroll-behavior:none; }
 *   AppShell                    → flex column, height:100svh
 *     ├─ <header>               optional, shrink-0, safe-area-inset-top
 *     ├─ <main id="app-scroll"> flex:1, the ONLY scroll container
 *     └─ <nav> BottomNavigation flex sibling (NOT fixed/absolute), inset-bottom
 *
 * Uses `svh` (never `dvh` — `dvh` lags iOS toolbar collapse and pushes the nav
 * under chrome). On iOS/WebKit the layout viewport does not shrink for the
 * keyboard, so we pin the shell to the visual viewport height when
 * `needsManualResize` is true, and hide the in-flow nav while the keyboard is
 * open so it doesn't sit underneath it.
 */
export const AppShell: React.FC<AppShellProps> = ({
  children,
  showNav = true,
  header
}) => {
  const { height, isKeyboardOpen, needsManualResize, standaloneHeight } = useAppViewport();
  // Single-instance schedule hydration + local-first persistence (Charlie Split).
  useScheduleSync();
  // Tracked lifts: hydrated app-wide so the player can record sessions.
  useTrackedLiftsSync();

  // On iOS, pin the shell to the visual viewport so the keyboard doesn't shove
  // content off-screen. Launched from the home screen with the keyboard closed,
  // fill the whole screen (iOS under-reports the viewport there). Elsewhere
  // rely on 100svh / native resize.
  const shellHeight =
    standaloneHeight > 0 && !isKeyboardOpen
      ? standaloneHeight
      : needsManualResize && height > 0
        ? height
        : 0;
  const shellStyle = shellHeight > 0 ? { height: `${shellHeight}px` } : undefined;

  return (
    // Top inset on the shell itself: the status bar is translucent, so every
    // page (with or without a header) must start below it.
    <div className="flex flex-col h-[100svh] bg-surface pt-[env(safe-area-inset-top)]" style={shellStyle}>
      {header && (
        <header className="shrink-0">
          {header}
        </header>
      )}
      <main
        id={APP_SCROLL_ID}
        className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        {children}
      </main>
      {showNav && !isKeyboardOpen && <BottomNavigation />}
      {showNav && <NewBestSheet />}
    </div>
  );
};
