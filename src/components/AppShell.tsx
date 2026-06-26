import React from 'react';
import { BottomNavigation } from './BottomNavigation';
import { BoardFilters } from './BoardFilters';
import { useAppViewport } from '../hooks/useAppViewport';
import { useScheduleSync } from '../hooks/useScheduleSync';
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
  const { height, isKeyboardOpen, needsManualResize } = useAppViewport();
  // Single-instance schedule hydration + local-first persistence (Charlie Split).
  useScheduleSync();

  // On iOS, pin the shell to the visual viewport so the keyboard doesn't shove
  // content off-screen. Elsewhere rely on 100svh / native resize.
  const shellStyle =
    needsManualResize && height > 0 ? { height: `${height}px` } : undefined;

  return (
    <div className="flex flex-col h-[100svh] bg-surface" style={shellStyle}>
      {/* Global SVG filter defs (#board-roughen) for hand-drawn wobble. */}
      <BoardFilters />
      {header && (
        <header className="shrink-0 pt-[env(safe-area-inset-top)]">
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
    </div>
  );
};
