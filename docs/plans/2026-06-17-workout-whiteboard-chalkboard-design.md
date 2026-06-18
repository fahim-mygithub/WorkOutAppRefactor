# Whiteboard / Chalkboard UI Rework — Design

**Date:** 2026-06-17
**Branch:** `feat/whiteboard-chalkboard-ui`
**Scope:** Mobile-first visual rework of the live `/workout` experience, driven by a global theme change. Other pages inherit the new palette + type and get bespoke polish later.

## Concept

**One hand, two surfaces.** The handwriting is identical in both modes; only the board changes.

- **Light = dry-erase whiteboard.** Cool off-white surface, dark marker ink, vivid dry-erase marker accent colors.
- **Dark = chalkboard.** Near-black slate surface, warm chalk ink (never pure white — that's the chalk tell), colored-chalk accents, faint chalk dust.

Direction chosen by the user (brainstorming round):
1. **Full skeuomorphic** — hand-drawn wobbly borders, board texture, chalk dust, handwritten voice throughout.
2. **Crisp tabular numbers** — weight/reps/timers stay in a clean numeric face for mid-set glance-ability. This is the one deliberate exception to "handwritten everywhere."
3. **Global theme, `/workout` first.**
4. **Permanent Marker** for display type.

## Typography — three voices

| Voice | Font | Used for |
|-------|------|----------|
| Marker (display) | **Permanent Marker** | Titles, section headers, labels (WEIGHT/REPS), button text |
| Handwriting (body) | **Kalam** (400/700, legible) | Body copy, instructions, notes — the default body voice |
| Crisp (data) | system sans + `tabular-nums` | All numbers, inputs, timers |

Fonts are **self-hosted** (`public/fonts/*.woff2`, latin subset, `font-display:swap`) — the PWA must work offline, so no Google Fonts CDN. Permanent Marker is reserved for short strings (it is unreadable as body copy). Numbers are never handwritten.

## Palette (rewrites `src/styles/tokens.css`, same token names)

Dark-first is preserved (`:root`/`.dark` paint the chalkboard on cold start; `.light` overrides to whiteboard). Every existing token name keeps its meaning, so all components re-skin automatically. Muscle-group hues become marker colors (light) / colored chalks (dark). `--border`/`--input` now resolve to a visible **board-line** stroke (hand-drawn boxes need visible edges, unlike the old elevation-only borders).

New tokens: `--board-line` (stroke for drawn boxes/dividers), plus texture handled in `board.css`.

## Texture & hand-drawn borders (`src/styles/board.css`)

- **Board grain:** one fixed, `pointer-events:none` SVG-noise (`feTurbulence`) overlay behind all content — paper grain (light) / chalk grain (dark), very low opacity. One overlay, not per-element (perf).
- **Hand-drawn boxes:** primary technique is the cheap irregular-`border-radius` trick + a `--board-line` border (zero filter cost). Hero elements additionally get an SVG `feTurbulence`+`feDisplacementMap` **roughen** filter applied to a **pseudo-element border only** (never the content) so straight edges wobble while text/numbers stay perfectly crisp.
- **Marker/chalk underlines** under headings; **set-complete** renders a hand-scribbled check/strike.
- SVG filter `<defs>` are mounted once via a hidden `<BoardFilters/>` in `AppShell`.

## Guardrails (red-teamed)

- **Legibility:** numbers/inputs always crisp; wobble filter never touches content, only pseudo-borders; body uses legible Kalam, not Permanent Marker.
- **Contrast:** WCAG-AA maintained both modes (chalk L90 on slate L9; marker ink L20 on board L98).
- **Perf:** texture = single overlay; displacement filter scoped to hero elements; `prefers-reduced-motion` drops wobble/animation to clean edges.
- **Offline:** fonts self-hosted.
- **Blast radius:** global tokens + body font change every page; `/workout` components get bespoke board treatment first, others inherit and are polished in a follow-up.

## File plan

1. `public/fonts/*.woff2` + `src/styles/fonts.css` — self-hosted faces.
2. `src/styles/tokens.css` — whiteboard/chalkboard palettes.
3. `src/styles/board.css` — texture, sketch/roughen utilities, underlines, dust, set-complete.
4. `tailwind.config.ts` — `marker`/`hand`/`num` font families.
5. `src/App.css` — body font → Kalam; texture base.
6. `src/components/BoardFilters.tsx` + `AppShell` wiring; CSS imports in `main.tsx`.
7. Restyle primitives: `ui/{card,button,input,icon-button}.tsx`.
8. Restyle `/workout`: `WorkoutHeader`, `ActiveExerciseCard`, `SetInput`, `SetList`, `RestTimer`, `WorkoutNextActionBanner`, `ExerciseNotesEditor`, `ExerciseListPanel`.
9. Verify: `typecheck:strict-paths` green, visual screenshots (light+dark, mobile), multi-lens review.
