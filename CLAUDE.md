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

## v2 status (Phase 0 in progress)
- Full design at `docs/plans/2026-04-23-workoutapp-v2-design.md`
- Phase 0 plan at `docs/plans/2026-04-23-workoutapp-v2-phase-0.md`
- New code lives in `src/components/ui/`, `src/icons/`, `src/lib/`, `src/test/`

## TypeScript status
- `npm run typecheck` runs the WHOLE codebase. **Currently red — 73 known v1 errors** lurking behind clusters that get cleaned up in Phase 1 (`firestore/serde.ts`, Firebase v9 sweep) and Phase 2 (component redesigns rewrite v1 surfaces). Do not block on these; they are tracked and intentional.
- `npm run typecheck:strict-paths` is the **Phase 0+ CI gate**. It scopes to new code paths only (`src/{components/ui,icons,lib,test}/**/*`) via `tsconfig.strict-paths.json`. **Must stay green.**
- Run both. The first tells you the v1 cleanup remaining; the second is what new work must pass.