// InstallPrompt: surfaces PWA install affordances (design §3).
//
//  • Android / Chromium (canInstall): a dismissible banner with an "Install"
//    action that replays the captured `beforeinstallprompt` event.
//  • iOS (showIOSInstructions): a Sheet with manual "Share → Add to Home
//    Screen" steps, since iOS exposes no programmatic prompt.
//
// Tempo: the banner is a subtle card (no border, no shadow) whose action is a
// secondary pill — installing is never the screen's one amber action. Built
// from primitives (Button, IconButton, Sheet) and tokens only. Dismissal is
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

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span
        aria-hidden="true"
        className="w-5 shrink-0 text-right font-num font-tabular text-title font-bold text-ink"
      >
        {n}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</span>
    </li>
  );
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
          <SheetTitle className="text-title">Install this app</SheetTitle>
          <SheetDescription>
            Add WorkoutApp to your home screen to open it full screen, like
            any other app.
          </SheetDescription>
          <ol className="mt-4 divide-y divide-hairline text-body text-ink">
            <Step n={1}>
              Tap the Share
              <Share aria-hidden="true" className="size-5 text-accent-2" />
              button in the toolbar.
            </Step>
            <Step n={2}>
              Choose
              <span className="inline-flex items-center gap-1 font-semibold">
                Add to Home Screen
                <Plus aria-hidden="true" className="size-5 text-accent-2" />
              </span>
            </Step>
            <Step n={3}>Tap Add to finish.</Step>
          </ol>
          <Button
            variant="ghost"
            size="lg"
            className="mt-4 w-full"
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
          'flex items-center gap-3 rounded-[20px] bg-surface-subtle py-3 pl-4 pr-2',
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-ink">Install WorkoutApp</p>
          <p className="text-body-sm text-ink-muted">
            Opens faster and full screen from your home screen.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void promptInstall()}>
          Install
        </Button>
        <IconButton
          aria-label="Dismiss"
          variant="ghost"
          size="md"
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
