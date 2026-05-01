# Motion Principles

Single source of truth: `src/lib/motion.ts`. Mirrors the timings encoded in `tailwind.config.ts` (`transitionDuration`, `transitionTimingFunction`). Update both together.

## Durations

Durations are in **seconds** (Framer Motion native). The Tailwind tokens encode the same values in milliseconds.

- **snap (0.12s / 120ms)** — taps, toggles, micro-feedback. The user just acted; confirm immediately.
- **smooth (0.22s / 220ms)** — most UI transitions: enter/exit, hover, layout shift.
- **slow (0.38s / 380ms)** — entering large surfaces (sheets, modals) where the user needs to track origin.

## Easings

Cubic-bezier tuples. Framer Motion accepts the array form directly; Tailwind uses the equivalent `cubic-bezier(...)` strings.

- **springSoft** `[0.32, 0.72, 0, 1]` — default for everything; gentle settle. Use for layout, popovers, sheets.
- **springBouncy** `[0.34, 1.56, 0.64, 1]` — celebratory only (PR achieved, set logged with overload). The overshoot must mean something.
- **easeOutExpo** `[0.16, 1, 0.3, 1]` — fades. Linear opacity feels dead; this gives life without bounce.

## Presets

Exposed on `motion.preset` in `src/lib/motion.ts`:

- **fade** — opacity 0 ↔ 1, smooth/easeOutExpo. Inline reveal, toast bodies, content swap.
- **scale** — opacity + scale 0.96 → 1, smooth/springSoft. Popovers, dropdowns, menus.
- **sheetUp** — y 100% → 0, slow/springSoft. Bottom sheets and similar large surfaces.

## Rules

1. **No animation during a live set.** Logging, rest timer, weight pickers stay still unless the rest timer itself is animating. The least-intrusive principle.
2. **Respect `prefers-reduced-motion`.** Wrap presets in `useReducedMotion()` checks at the consumer site; fall back to instant change.
3. **No `transition-all`.** Always specify the property and use a named duration class (`duration-snap`, `duration-smooth`, `duration-slow`).
4. **Haptics over toasts mid-workout.** When motion would steal attention from a set in progress, prefer a Capacitor `Haptics.impact` call.
