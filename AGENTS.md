# Repository Guidelines

## Project Structure & Module Organization
The application lives in `src/`, with routing in `src/router`, state slices under `src/store/slices`, providers in `src/providers`, and auth utilities in `src/contexts` and `src/firebase`. Reusable UI lives in `src/components` and shared styles in `src/styles`. Place static assets and CSV fixtures in `public/`. Build outputs in `dist/` or `dev-dist/` are disposable and should stay untracked.

## Build, Test, and Development Commands
- `npm install` - install dependencies.
- `npm run dev` - start the Vite dev server with HMR.
- `npm run build` - run TypeScript project build then emit production assets to `dist/`.
- `npm run preview` - serve the last build for manual QA.
- `npm run lint` / `npm run typecheck` - enforce ESLint and strict TypeScript before pushing.
- `npm run test` - execute the Vitest suite; add `--run` for CI and `--coverage` when auditing.

## Coding Style & Naming Conventions
TypeScript strict mode is enabled, so prefer typed helpers from `src/types` and keep any new enums centralized there. Use two-space indentation, single quotes, and `PascalCase.tsx` for components, `useCamelCase.ts` for hooks, and `*Slice.ts` for Redux logic. Tailwind utilities can mix with component CSS, but reusable tokens belong in `styles/animations.css` or `tailwind.config.js`. Run `npm run lint -- --fix` before opening a PR.

## Testing Guidelines
Vitest handles unit and integration coverage. Co-locate simple tests beside the source (`FeatureName.test.ts[x]`) and reserve `src/__tests__/` for workflows that span slices, hooks, and Firebase services. Stub Firestore via local fixtures instead of network calls, reusing data from `public/muscle_exercises.csv`. Run `npm run test -- --coverage` on substantial changes and aim for roughly 80% statements on new modules; call out gaps explicitly in the PR.

## Commit & Pull Request Guidelines
Write imperative, Conventional Commit-style subjects (`feat: add workout duplication`) and keep bodies focused on intent plus notable trade-offs. Avoid committing generated artifacts from `dist/`, `dev-dist/`, or Firebase deploys. PR descriptions should outline the user impact, list the commands you ran, link related issues or Firebase rule updates, and attach UI screenshots when visuals shift. Tag the relevant code owners when modifying `src/store/**` or `firestore.rules`.

## Security & Configuration Tips
Store secrets in `.env.local` with `VITE_FIREBASE_*` keys so Vite exposes them safely. Default values in `src/firebase/config.ts` are for smoke testing only. Override them in local env files and never commit live credentials. When updating Firestore access, keep `firestore.rules`, `firestore.indexes.json`, and `FIREBASE_SECURITY_RULES.md` in sync, then dry-run via `npm run preview` before deploying to production channels.
