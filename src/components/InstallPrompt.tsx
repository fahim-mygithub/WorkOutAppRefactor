// InstallPrompt: surfaces PWA install affordances (design §3).
//
//  • Android / Chromium (canInstall): a dismissible bottom banner with an
//    "Install" action that replays the captured `beforeinstallprompt` event.
//  • iOS (showIOSInstructions): a Sheet with manual "Share → Add to Home
//    Screen" steps, since iOS exposes no programmatic prompt.
//
// Built from existing primitives (Button, IconButton, Sheet) and design tokens
// only — no raw hex / gray-* (see src/styles/tokens.css). Dismissal is
// persisted by the hook to localStorage.
import * as React from 'react';
import { Share, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export interface InstallPromptProps {
  /** Optional className merged onto the Android banner wrapper. */
  className?: string;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ className }) => {
  const { canInstall, showIOSInstructions, promptInstall, dismiss } =
    useInstallPrompt();

  // iOS: manual Add-to-Home-Screen instructions in a Sheet. Closing the sheet
  // (Escape / backdrop) is treated as a dismissal so it doesn't re-nag.
  if (showIOSInstructions) {
    return (
      <Sheet
        open
        onOpenChange={(next) => {
          if (!next) dismiss();
        }}
      >
        <SheetContent>
          <SheetTitle>Install this app</SheetTitle>
          <SheetDescription>
            Add WorkoutApp to your home screen for a full-screen, app-like
            experience.
          </SheetDescription>
          <ol className="mt-4 space-y-3 text-body text-ink">
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-body-sm font-semibold text-ink-muted">
                1
              </span>
              <span className="flex items-center gap-1.5">
                Tap the Share
                <Share aria-hidden="true" className="size-5 text-accent" />
                button in the toolbar.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-body-sm font-semibold text-ink-muted">
                2
              </span>
              <span className="flex items-center gap-1.5">
                Choose
                <span className="inline-flex items-center gap-1 font-medium">
                  Add to Home Screen
                  <Plus aria-hidden="true" className="size-5 text-accent" />
                </span>
                .
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-body-sm font-semibold text-ink-muted">
                3
              </span>
              <span>Tap Add to finish.</span>
            </li>
          </ol>
          <Button
            variant="ghost"
            className="mt-6 w-full"
            onClick={() => dismiss()}
          >
            Maybe later
          </Button>
        </SheetContent>
      </Sheet>
    );
  }

  // Android / Chromium: inline dismissible banner with the native prompt.
  if (canInstall) {
    return (
      <div
        role="region"
        aria-label="Install app"
        className={cn(
          'flex items-center gap-3 rounded-xl bg-surface-raised p-4 shadow-e2',
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-ink">Install WorkoutApp</p>
          <p className="text-body-sm text-ink-muted">
            Add to your home screen for a faster, full-screen experience.
          </p>
        </div>
        <Button size="sm" onClick={() => void promptInstall()}>
          Install
        </Button>
        <IconButton
          aria-label="Dismiss"
          variant="ghost"
          size="sm"
          onClick={() => dismiss()}
        >
          <X aria-hidden="true" className="size-5" />
        </IconButton>
      </div>
    );
  }

  return null;
};

InstallPrompt.displayName = 'InstallPrompt';
