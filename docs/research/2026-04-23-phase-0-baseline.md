# Phase 0 Baseline

**Completed:** 2026-05-04
**Plan:** `docs/plans/2026-04-23-workoutapp-v2-phase-0.md` (17 tasks + Task 2.5 mid-stream tech-debt fix)
**Test suite at exit:** 121 passing across 8 files
**TS gate:** `npm run typecheck:strict-paths` green; whole-codebase `npm run typecheck` still red on the 73 known v1 errors (Phase 1 / 2 cleanup)

---

## Foundations shipped

- **Test infra** — Vitest + React Testing Library + jsdom; `src/test/setup.ts`; smoke test confirming framer-motion imports
- **Path alias** — `@/* → src/*` in `tsconfig.json` and `vite.config.ts`
- **TypeScript Tailwind config** — `tailwind.config.ts` (migrated from `.js`) + composite-aware `tsconfig.node.json` (Task 2.5)
- **Design tokens** — color, type scale, motion durations/easings, elevation, radius, touch targets, muscle-group hues. Defined in `tailwind.config.ts` extends + `src/styles/tokens.css` HSL definitions; dark + light variants both wired
- **Motion module** — `src/lib/motion.ts` exports 3 durations × 3 easings + presets (`fade`, `sheetUp`, others) consumed by Sheet
- **Framer Motion** installed and used by Sheet
- **Shadcn UI** initialized; `cn` utility upgraded; tokens reconciled with Shadcn defaults
- **Lucide-react icon pack** — replaces an in-house muscle-group icon module after four design iterations rejected (Tabler stroke, Phosphor fill, two custom sets); used in showcase via a tiny local `MuscleIcon` wrapper
- **Calendar wireframe** — `docs/research/2026-04-23-calendar-wireframe.md` + `2026-04-23-calendar-layout-inspiration.md`; wireframe lives in `src/dev/Phase0Showcase.tsx` §05
- **Base primitives** — all under `src/components/ui/`, all TDD, all wired to Task 5 tokens:
  - `Button` (4 variants × 3 sizes, asChild slot, ref-forwarding) — 15 tests
  - `IconButton` (square, required `aria-label`, same matrix as Button) — 17 tests
  - `Card` family (Card / Header / Title / Body / Footer; elevation 0..3) — 21 tests
  - `Stack` (flex layout primitive; literal-class variant maps for JIT) — 29 tests
  - `Skeleton` (`motion-safe:animate-pulse`, `as` div/span, `aria-hidden` default) — 18 tests
  - `Sheet` (Radix Dialog + Framer AnimatePresence + `forceMount` pattern; controlled + uncontrolled) — 14 tests

---

## Research artifacts

- `docs/research/2026-04-23-ui-gap-analysis.md` — Task 4 gap research
- `docs/research/2026-04-23-calendar-wireframe.md` — Task 10 wireframe spec
- `docs/research/2026-04-23-calendar-layout-inspiration.md` — Task 10 supporting layout teardowns

---

## Deferred to Phase 1

- ESLint config (none currently)
- Delete the 263 `console.log` calls
- Error boundaries
- `firestore/serde.ts` unification (responsible for a chunk of the 73 v1 TS errors)
- redux-persist with Capacitor Preferences adapter
- Kill `localStorage` paths in `BuildPage` / `WorkoutPage`

---

## Open decisions still pending (from design doc §11)

1. Tool catalog enumeration (Phase 3)
2. Apple Developer + Play Console accounts
3. Existing share-link compatibility
4. Telemetry (Sentry / Firebase Analytics) in v1?
5. Brand identity / app name
6. Dark mode toggle in v1?
7. Custom muscle-group SVGs — closed in Phase 0: pinned to `lucide-react`, in-house module deleted

---

## Notable mid-stream changes from the original plan

- **Task 9 icon module deleted** — after Tabler / Phosphor / two custom iterations, scrapped the in-house `src/icons/MuscleGroup/*` module entirely and pinned to `lucide-react`. `tsconfig.strict-paths.json` no longer includes `src/icons/**/*`.
- **Task 2.5 inserted** — `tsconfig.node.json` composite + emit settings repaired so `tsc --build` works. Pre-existing tech debt surfaced by the TS Tailwind config migration.
- **`tsconfig.strict-paths.json`** is the Phase 0+ CI gate (renamed from `tsconfig.new.json`); whole-codebase `typecheck` stays red on v1 surfaces by design.
