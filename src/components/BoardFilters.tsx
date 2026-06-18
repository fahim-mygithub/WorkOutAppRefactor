import React from 'react';

/**
 * Mounts the global SVG filter <defs> for the whiteboard/chalkboard theme.
 *
 * `#board-roughen` is a feTurbulence + feDisplacementMap pair that waves straight
 * edges into hand-drawn marker/chalk strokes. board.css references it via
 * `filter: var(--board-filter)` on PSEUDO borders only (never on content), so the
 * card outlines wobble while text and numbers stay perfectly crisp.
 *
 * Rendered once at the app shell so the id is always in the DOM regardless of
 * route. The <svg> is visually hidden + aria-hidden; it contributes only defs.
 */
export const BoardFilters: React.FC = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="0"
    height="0"
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
  >
    <defs>
      <filter
        id="board-roughen"
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        filterUnits="objectBoundingBox"
      >
        {/* Low base frequency → long-wavelength, hand-drawn wobble (not jitter). */}
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.012 0.015"
          numOctaves={2}
          seed={7}
          result="noise"
        />
        {/* ~2px displacement: a gentle, refined hand-drawn waver close to a
            straight edge (not a heavy sketch). */}
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={2}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>
);
