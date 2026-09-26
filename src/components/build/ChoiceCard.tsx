import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * ChoiceCard — a large tap target for the wizard's pick-one-of-N screens.
 *
 * Two layouts (Tempo: depth by surface step, amber marks the act-now icon):
 *   - `row` (default): icon + title + one-line description + chevron, full
 *     width. Used where each option needs explaining (template list).
 *   - `tile`: compact vertical tile — icon over a short title — meant to sit
 *     three-across in a grid (the Build chooser). The description is kept as
 *     screen-reader text so the short visible title never loses its meaning.
 *
 * It is a real <button>. `selected` adds an amber ring for pick-and-confirm
 * screens; the navigate-on-tap usage just leaves it unselected.
 */
export interface ChoiceCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  onClick: () => void;
  layout?: 'row' | 'tile';
  selected?: boolean;
  /** Hide the trailing chevron (row layout; e.g. when used as a toggle). */
  hideChevron?: boolean;
  disabled?: boolean;
  className?: string;
}

const base = cn(
  'group relative rounded-[20px] bg-surface-subtle text-ink',
  'transition-[background-color,transform] duration-snap hover:bg-surface-raised/70 active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

export function ChoiceCard({
  icon: Icon,
  title,
  description,
  onClick,
  layout = 'row',
  selected = false,
  hideChevron = false,
  disabled = false,
  className,
}: ChoiceCardProps) {
  if (layout === 'tile') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          base,
          'flex min-h-[96px] w-full flex-col items-center justify-center gap-2.5 px-2 py-4 text-center',
          selected && 'ring-2 ring-accent',
          className,
        )}
      >
        <Icon size={26} aria-hidden="true" className="text-accent" />
        <span className="text-body-sm font-semibold leading-tight">{title}</span>
        {description && <span className="sr-only">{description}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        base,
        'flex min-h-touch-lg w-full items-center gap-4 p-5 text-left',
        selected && 'ring-2 ring-accent',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors',
          selected ? 'bg-accent text-accent-fg' : 'bg-surface-raised text-accent',
        )}
        aria-hidden="true"
      >
        <Icon size={26} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-wide text-title font-bold leading-tight">{title}</span>
        {description && (
          <span className="mt-1 block text-body-sm leading-snug text-ink-muted">{description}</span>
        )}
      </span>

      {!hideChevron && (
        <ChevronRight
          size={22}
          aria-hidden="true"
          className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}
