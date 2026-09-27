import { memo, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { MUSCLE_TERMS } from '../../lib/muscleTerms';
import { BODY_FRONT_SVG } from './bodyFrontSvg';
import { BODY_BACK_SVG } from './bodyBackSvg';
import { groupIdsByTerm, type HeatLevel } from '../../lib/muscleHeat';

/**
 * BodyMuscleMap — MuscleWiki-style front/back interactive muscle map for the
 * Home page. The SVG artwork (bodyFrontSvg.ts / bodyBackSvg.ts) is MuscleWiki's,
 * supplied by the project owner; it is re-skinned to the board palette by the
 * `.muscle-map` rules in tempo.css (muscle <g> fills are `currentColor`).
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

/**
 * The injected artwork, memoised: re-rendering a dangerouslySetInnerHTML node
 * can replace the SVG and wipe the heat markers, so it only re-renders when
 * the markup itself changes.
 */
const SvgArt = memo(function SvgArt({ html }: { html: string }) {
  return <div className="w-full" dangerouslySetInnerHTML={{ __html: html }} />;
});

interface BodyMuscleMapProps {
  /** Defaults to the bundled MuscleWiki artwork; overridable for dev/testing. */
  frontSvg?: string;
  backSvg?: string;
  /** Recently worked muscles by term (see lib/muscleHeat): warm = orange, hot = red. */
  heat?: Record<string, HeatLevel>;
}

const LEGEND: { level: HeatLevel; label: string }[] = [
  { level: 'warm', label: '1 exercise' },
  { level: 'hot', label: '2 or more' },
];

export function BodyMuscleMap({
  frontSvg = BODY_FRONT_SVG,
  backSvg = BODY_BACK_SVG,
  heat = {},
}: BodyMuscleMapProps = {}) {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);

  // Shade worked muscles: the SVGs are injected markup, so mark their groups
  // with data-heat and let tempo.css colour them.
  const heatKey = JSON.stringify(heat);
  useEffect(() => {
    const root = mapRef.current;
    if (!root) return;
    const idsByTerm = groupIdsByTerm();
    root.querySelectorAll('g[data-heat]').forEach((g) => g.removeAttribute('data-heat'));
    for (const [term, level] of Object.entries(heat)) {
      for (const id of idsByTerm[term] ?? []) {
        root.querySelectorAll(`g[id="${id}"]`).forEach((g) => g.setAttribute('data-heat', level));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatKey, frontSvg, backSvg]);
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
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title text-ink">Muscles</h2>

          {/* Front/Back toggle — only on narrow screens, only when a back exists. */}
          {hasBack && (
            <div
              className="flex shrink-0 gap-1 rounded-full bg-surface-raised p-1 md:hidden"
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
                    'min-h-9 rounded-full px-4 text-body-sm font-semibold capitalize transition-colors duration-snap',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    view === v ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-body-sm text-ink-muted">
          Worked muscles cool down over 2 days. Tap one to see its exercises.
        </p>
        <ul className="mt-2 flex gap-4" aria-label="Muscle heat key">
          {LEGEND.map(({ level, label }) => (
            <li key={level} className="flex items-center gap-1.5 text-caption text-ink-muted">
              <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', level === 'hot' ? 'bg-heat-hot' : 'bg-heat-warm')} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Click handling delegated to the wrapper (event bubbles from the paths). */}
      <div ref={mapRef} className="muscle-map flex items-start justify-center gap-4" onClick={handleClick}>
        <figure className={cn(figureBase, frontDisplay)}>
          <SvgArt html={frontSvg} />
          <figcaption className="mt-2 text-caption text-ink-muted">
            Front
          </figcaption>
        </figure>

        {hasBack && (
          <figure className={cn(figureBase, backDisplay)}>
            <SvgArt html={backSvg} />
            <figcaption className="mt-2 text-caption text-ink-muted">
              Back
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
