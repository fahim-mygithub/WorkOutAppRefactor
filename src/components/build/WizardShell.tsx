import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/icon-button';

/**
 * WizardShell — the no-scroll frame every build-wizard step renders inside.
 *
 * The design rule: an input/decision screen must never be so tall the user has
 * to scroll, especially with the keyboard up. This shell enforces that
 * STRUCTURALLY rather than by discipline:
 *
 *   h-full flex column (fills AppShell's <main>, never taller)
 *     ├─ header  shrink-0   back + muted context line + display title
 *     ├─ body    flex-1 min-h-0   the step content lives in the TOP half, so an
 *     │                            on-screen keyboard only ever covers empty space
 *     └─ footer  shrink-0   the single primary action, pinned to the bottom
 *
 * The body does NOT scroll by default (`overflow-hidden`) — that's the whole
 * point. The one screen with inherently variable height (the recommended-workout
 * list, which has no keyboard) opts into a bounded internal scroll via
 * `scrollableBody`, keeping the header and the Start button pinned.
 */
export interface WizardShellProps {
  /** Step heading, in the display voice. */
  title: string;
  /** Optional one-line helper under the title. */
  subtitle?: string;
  /** Back affordance; omit to hide the back button (e.g. the first screen). */
  onBack?: () => void;
  /** 1-based current step + total, to render progress dots. Both required to show. */
  step?: number;
  totalSteps?: number;
  /** Pinned bottom action area (usually the primary Button). */
  footer?: ReactNode;
  /** Opt into a bounded internal scroll for variable-height, keyboard-free bodies. */
  scrollableBody?: boolean;
  children: ReactNode;
}

export function WizardShell({
  title,
  subtitle,
  onBack,
  step,
  totalSteps,
  footer,
  scrollableBody = false,
  children,
}: WizardShellProps) {
  const showDots = typeof step === 'number' && typeof totalSteps === 'number' && totalSteps > 1;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      {/* Header — fixed height, never scrolls. */}
      <div className="flex shrink-0 items-start gap-3 px-4 pb-3 pt-4">
        {onBack ? (
          <IconButton
            variant="ghost"
            size="md"
            aria-label="Back"
            onClick={onBack}
            className="-ml-2 shrink-0"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </IconButton>
        ) : (
          // Reserve the back-button slot so the title aligns either way.
          <span className="h-touch-min w-touch-min shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1 pt-1">
          {/* Context line: step progress when the flow has steps. */}
          {showDots && (
            <p className="text-body-sm text-ink-muted">
              Step <span className="font-tabular">{step}</span> of{' '}
              <span className="font-tabular">{totalSteps}</span>
            </p>
          )}
          <h1 className="truncate font-display text-title text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-body-sm text-ink-muted">{subtitle}</p>}
        </div>

        {showDots && (
          <div className="flex shrink-0 items-center gap-1.5 pt-3" aria-hidden="true">
            {Array.from({ length: totalSteps! }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] duration-smooth',
                  i < step! ? 'w-5 bg-accent' : 'w-1.5 bg-surface-raised',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body — fills the gap; the active input/content sits at the top. */}
      <div
        className={cn(
          'min-h-0 flex-1 px-4',
          scrollableBody ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
        )}
      >
        {children}
      </div>

      {/* Footer — pinned primary action. */}
      {footer && (
        <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {footer}
        </div>
      )}
    </div>
  );
}
