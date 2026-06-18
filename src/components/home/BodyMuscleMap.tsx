import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { MUSCLE_TERMS } from '../../lib/muscleTerms';
import { BODY_FRONT_SVG } from './bodyFrontSvg';
import { BODY_BACK_SVG } from './bodyBackSvg';

/**
 * BodyMuscleMap — MuscleWiki-style front/back interactive muscle map for the
 * Home page. The SVG artwork (bodyFrontSvg.ts / bodyBackSvg.ts) is MuscleWiki's,
 * supplied by the project owner; it is re-skinned to the board palette by the
 * `.muscle-map` rules in board.css (muscle <g> fills are `currentColor`).
 *
 * Layout: when a back view is available, both figures show side-by-side on wide
 * screens (md+) and collapse to a Front/Back toggle on narrow screens. With no
 * back view yet, the front shows on its own (no toggle).
 *
 * Each muscle group <g id="..."> maps to a directory search term; clicking one
 * deep-links to `/exercises?muscle=<term>` (handled by ExercisesPage's `?muscle=`
 * param → the `filterByMuscle` substring reducer). Click handling is delegated
 * on the wrapper so it works regardless of which <path>/<g> was hit.
 */

// The SVG group id → search term map now lives in src/lib/muscleTerms.ts so the
// build wizard's muscle picker shares the exact same vocabulary.

interface BodyMuscleMapProps {
  /** Defaults to the bundled MuscleWiki artwork; overridable for dev/testing. */
  frontSvg?: string;
  backSvg?: string;
}

export function BodyMuscleMap({
  frontSvg = BODY_FRONT_SVG,
  backSvg = BODY_BACK_SVG,
}: BodyMuscleMapProps = {}) {
  const navigate = useNavigate();
  const [view, setView] = useState<'front' | 'back'>('front');
  const hasBack = Boolean(backSvg);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const group = (e.target as Element).closest?.('g[id]');
    const term = group ? MUSCLE_TERMS[group.id] : undefined;
    if (term) navigate(`/exercises?muscle=${encodeURIComponent(term)}`);
  };

  // Per-figure display: on wide screens (md+) both always show; on narrow the
  // toggle picks one. With no back view, the front simply always shows.
  const frontDisplay = !hasBack
    ? 'flex'
    : cn('md:flex', view === 'front' ? 'flex' : 'hidden');
  const backDisplay = cn('md:flex', view === 'back' ? 'flex' : 'hidden');

  const figureBase = 'w-full max-w-[260px] flex-col items-center';

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-marker text-title leading-none text-ink">Pick a muscle</h2>
          <p className="mt-1 text-body-sm text-ink-muted">
            Tap a muscle to browse its exercises
          </p>
        </div>

        {/* Front/Back toggle — only on narrow screens, only when a back exists. */}
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
                  view === v
                    ? 'bg-accent text-accent-fg'
                    : 'text-ink-muted hover:bg-surface-subtle',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Click handling delegated to the wrapper (event bubbles from the paths). */}
      <div className="muscle-map flex items-start justify-center gap-4" onClick={handleClick}>
        <figure className={cn(figureBase, frontDisplay)}>
          <div className="w-full" dangerouslySetInnerHTML={{ __html: frontSvg }} />
          <figcaption className="mt-1 font-marker text-caption uppercase tracking-wide text-ink-subtle">
            Front
          </figcaption>
        </figure>

        {hasBack && (
          <figure className={cn(figureBase, backDisplay)}>
            <div className="w-full" dangerouslySetInnerHTML={{ __html: backSvg }} />
            <figcaption className="mt-1 font-marker text-caption uppercase tracking-wide text-ink-subtle">
              Back
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
