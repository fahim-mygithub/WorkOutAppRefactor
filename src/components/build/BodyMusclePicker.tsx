import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MUSCLE_TERMS } from '../../lib/muscleTerms';
import { BODY_FRONT_SVG } from '../home/bodyFrontSvg';
import { BODY_BACK_SVG } from '../home/bodyBackSvg';

/**
 * BodyMusclePicker — the build wizard's MULTI-SELECT muscle map. Reuses the same
 * MuscleWiki SVGs and `MUSCLE_TERMS` vocabulary as the Home BodyMuscleMap, but
 * instead of deep-linking on click it toggles the tapped muscle in/out of a
 * controlled `selected` set and highlights every selected group (front + back
 * ids that share a term both light up).
 *
 * Selection state is owned by the parent (the wizard) so the "Next" footer can
 * gate on it and carry the chosen muscles into the recommend step. Highlighting
 * is applied imperatively (the SVG is injected via dangerouslySetInnerHTML, so
 * we toggle an `is-selected` class on the inner `<g id>` nodes in an effect).
 *
 * No-scroll: figures are height-bounded (see `.muscle-picker` in tempo.css) and
 * narrow screens use the Front/Back toggle to show one larger figure at a time.
 */
export interface BodyMusclePickerProps {
  /** Selected muscle TERMS (e.g. "Chest", "Shoulders"). Controlled by parent. */
  selected: string[];
  /** Toggle a term in/out of the selection. */
  onToggle: (term: string) => void;
  frontSvg?: string;
  backSvg?: string;
}

export function BodyMusclePicker({
  selected,
  onToggle,
  frontSvg = BODY_FRONT_SVG,
  backSvg = BODY_BACK_SVG,
}: BodyMusclePickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'front' | 'back'>('front');
  const hasBack = Boolean(backSvg);
  const selectedSet = new Set(selected);

  // Sync the `is-selected` highlight onto the injected SVG groups whenever the
  // selection changes. Every `<g id>` whose term is selected lights up — so a
  // term mapped by two ids (e.g. front+rear shoulders) highlights both figures.
  useEffect(() => {
    const root = mapRef.current;
    if (!root) return;
    root.querySelectorAll<SVGGElement>('g[id]').forEach((g) => {
      const term = MUSCLE_TERMS[g.id];
      g.classList.toggle('is-selected', !!term && selectedSet.has(term));
    });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const group = (e.target as Element).closest?.('g[id]');
    const term = group ? MUSCLE_TERMS[group.id] : undefined;
    if (term) onToggle(term);
  };

  const figureBase = 'flex h-full max-w-[220px] flex-1 flex-col items-center justify-center';
  const frontDisplay = !hasBack
    ? 'flex'
    : cn('md:flex', view === 'front' ? 'flex' : 'hidden');
  const backDisplay = cn('md:flex', view === 'back' ? 'flex' : 'hidden');

  return (
    <div className="muscle-picker flex h-full flex-col">
      {/* Top bar: selected chips (removable) + Front/Back toggle. shrink-0. */}
      <div className="flex shrink-0 items-start justify-between gap-3 pb-2">
        <div className="min-h-[2rem] flex-1">
          {selected.length === 0 ? (
            <p className="pt-1 text-body-sm text-ink-muted">Tap muscles to add them</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {selected.map((term) => (
                <li key={term}>
                  <button
                    type="button"
                    onClick={() => onToggle(term)}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-marker text-caption text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    aria-label={`Remove ${term}`}
                  >
                    {term}
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasBack && (
          <div
            className="flex shrink-0 overflow-hidden rounded-md border border-border md:hidden"
            role="group"
            aria-label="Body view"
          >
            {(['front', 'back'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  'px-3 py-1 font-marker text-caption uppercase tracking-wide transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                  view === v ? 'bg-accent text-accent-fg' : 'text-ink-muted hover:bg-surface-subtle',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body map — height-bounded, fills remaining space. Clicks delegated. */}
      <div
        ref={mapRef}
        className="muscle-map flex min-h-0 flex-1 items-stretch justify-center gap-4"
        onClick={handleClick}
      >
        <figure className={cn(figureBase, frontDisplay)}>
          <div
            className="flex min-h-0 w-full flex-1 items-center justify-center"
            dangerouslySetInnerHTML={{ __html: frontSvg }}
          />
          <figcaption className="mt-1 shrink-0 font-marker text-caption uppercase tracking-wide text-ink-subtle">
            Front
          </figcaption>
        </figure>

        {hasBack && (
          <figure className={cn(figureBase, backDisplay)}>
            <div
              className="flex min-h-0 w-full flex-1 items-center justify-center"
              dangerouslySetInnerHTML={{ __html: backSvg }}
            />
            <figcaption className="mt-1 shrink-0 font-marker text-caption uppercase tracking-wide text-ink-subtle">
              Back
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
