# Claude Code Instructions

## Testing Policy
**IMPORTANT**: Do NOT run `npm run dev` or any development server commands automatically.
Instead, inform the user to manually run the testing commands when needed.

When testing is required, simply tell the user:
"Please test the changes by running `npm run dev` in your terminal."

## Project Context
This is a React workout tracking application with Firebase integration.

## Recent Issues and Fixes
- Fixed Firebase rules for anonymous user access to shared workouts
- Fixed authentication context infinite loop issue
- Working on shared workout serialization issues

## v2 status
- Phase 0 complete (foundations) — see `docs/plans/2026-04-23-workoutapp-v2-design.md` and the baseline at `docs/research/2026-04-23-phase-0-baseline.md`
- Phase 1 next: ESLint config, console.log cleanup, error boundaries, `firestore/serde.ts` unification, redux-persist with Capacitor Preferences adapter
- New code lives in `src/components/ui/`, `src/lib/`, `src/test/`, `src/styles/tokens.css`. Muscle-group glyphs render via `lucide-react` (no in-house icon module).
- All UI work uses design tokens (no raw color hex), motion presets from `src/lib/motion.ts`, and base primitives from `src/components/ui/*` (Button, IconButton, Card, Stack, Skeleton, Sheet).

## TypeScript status
- `npm run typecheck` runs the WHOLE codebase. **Currently red — 73 known v1 errors** lurking behind clusters that get cleaned up in Phase 1 (`firestore/serde.ts`, Firebase v9 sweep) and Phase 2 (component redesigns rewrite v1 surfaces). Do not block on these; they are tracked and intentional.
- `npm run typecheck:strict-paths` is the **Phase 0+ CI gate**. It scopes to new code paths only (`src/{components/ui,lib,test}/**/*`) via `tsconfig.strict-paths.json`. **Must stay green.**
- Run both. The first tells you the v1 cleanup remaining; the second is what new work must pass.