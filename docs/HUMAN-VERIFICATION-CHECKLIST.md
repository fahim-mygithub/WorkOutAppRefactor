# PWA Hardening — Human Verification Checklist

**Branch:** `feat/pwa-hardening` · **Date:** 2026-06-15
**Design:** `docs/plans/2026-06-14-pwa-hardening-design.md`
**Run the app:** `npx vite --port 5290 --strictPort` → **http://localhost:5290/**
(Ports 5173–5175 are taken by another project — use 5290. Use `localhost`, NOT `127.0.0.1`: Firebase Auth only authorizes `localhost` by default, so `127.0.0.1` throws `auth/unauthorized-domain` on sign-in.)

---

## Automated gates (verified green at each phase)

- [x] **Tests:** 323 passing (was 121 at start)
- [x] **Strict-paths TS gate:** GREEN
- [x] **Full TS errors:** 46 (down from 73 baseline; 0 new introduced)
- [x] **`vite build`:** PASS, no >500 kB chunk warning
- [x] **ESLint:** present + passing on gated scope (was no config at all)

## Agentically verified in Chrome (unauthenticated surface)

- [x] App boots clean, **zero console errors** (one benign dev-only Redux timing warning)
- [x] Dark theme default: `<html class="dark">`, body `#0b111e`
- [x] Brand accent restored: `--accent` = `217 91% 65%` (was broken slate)
- [x] Light palette flips correctly when `.light` applied (surface→white, ink→dark)
- [x] App-shell base: `body { overflow:hidden; overscroll-behavior:none; height:100svh }`
- [x] Auth pages render chromeless (no bottom nav), login form present

---

## ⚠️ Needs human verification — sign-in required

I cannot log in (credentials are yours), so the **authenticated screens below were not visually/interaction tested by me** — only their logic via the 323 automated tests. Sign in at **http://localhost:5290/** and verify:

### Milestone 0 — the glitches you reported
- [ ] **Bottom nav does NOT drift** while scrolling a long page (Home/Exercises). It's now a flex sibling, not `position:fixed`.
- [ ] **No viewport jump** from the address bar (best in installed/standalone mode).
- [ ] In-app swipes (drag-to-reorder, sheets) don't trigger browser back/forward (fully on Android; best-effort on iOS).
- [ ] Keyboard: focusing a form field doesn't shove the nav over the keyboard (nav hides while typing).
- [ ] Auth pages have no bottom nav; authed pages do.

### Phase 1 — foundations
- [ ] Theme toggle in **Profile** switches dark↔light and persists.
- [ ] Sharing a workout still works (the `deleteSharedWorkout` runtime bug was fixed — verify delete + share round-trip).
- [ ] Exercise directory loads (now from `exercises.json`, lazy on Directory/Build/Profile — Home/Workout don't block on it).
- [ ] No errors navigating between all routes (code-split + error boundaries).

### Phase 2 — UI uplift (the visual redesign)
- [ ] **Home/Calendar:** redesigned calendar with muscle-group hues + lucide glyphs, intensity/completion; stat cards; day sheet.
- [ ] **Bottom nav:** restyled, accent active state.
- [ ] **Exercises:** search (Input), filters (Select/chips), card rows.
- [ ] **Build:** Tabs for text/visual/templates; share via Sheet; drag-reorder still works.
- [ ] **Workout:** redesigned (decomposed 929→681 LOC); set logging, supersets, rest timer all work; modals are now bottom Sheets.
- [ ] **Profile:** history, custom exercises, forms — all on Sheets/primitives.
- [ ] All modals slide up as **bottom sheets**, not center dialogs.

### Phase 2a — native parity
- [ ] **Rest timer:** start a rest, background the app ~30s, return → countdown shows the correct remaining time (timestamp-anchored). Honest limit: no alert fires while fully backgrounded (no server push) — only on resume.
- [ ] **Wake lock:** during an active workout the screen stays on (Android; iOS installed PWA needs 18.4+).
- [ ] **Install prompt:** Android shows an install banner; iOS shows manual "Add to Home Screen" guidance.

### Phase 3 — performance
- [ ] App feels fast; first paint quick. (Main JS chunk 964 KB→121 KB; vendors split; exercise data no longer in the 2 MB upfront precache.)

### Install / PWA
- [ ] Install to home screen (Chrome: install icon; iOS Safari: Share → Add to Home Screen) and confirm it opens standalone (no address bar) and the glitches are gone.

---

## ⚠️ Known limitations / follow-ups

1. ~~A few root components still use raw colors~~ **RESOLVED.** All 11 remaining root components (RestTimer, Toast, SharedWorkout pages, video/thumbnail components, AppShell, ErrorBoundary, router) were migrated to semantic tokens (commit `c9611ba`). **0 raw colors remain in `src/`** (only two skeleton-shimmer gradient stops in `animations.css`, which are CSS keyframes, not theme surfaces). Light mode is now correct app-wide; re-verify the authenticated screens in light mode after sign-in.
2. **AI layer is scaffolded but NOT deployed.** To enable it: `cd functions && npm install`, set `ANTHROPIC_API_KEY` (Functions config/secret), `firebase deploy --only functions`. See `functions/README.md`. Until then, the on-device deterministic parser fallback works; the chat UI (`src/components/ai/AiChatSheet.tsx`) shows a graceful "backend not configured" state and is **not yet mounted** into a page (mount it on the Build page when ready).
3. **Backgrounded rest-timer alert** intentionally not built (would require server push / FCM with iOS 16.4+/installed constraints). Scoped to foreground+resume accuracy.
4. **Remaining 46 TS errors** are pre-existing v1 type-noise (date-vs-string, possibly-undefined, interface-extends) tracked behind the strict-paths gate — not blockers, safe to clean incrementally.
5. **`exercises.json` is ~1540 entries / ~2 MB** (the design's "52" estimate was wrong — each exercise had ~3.5 CSV rows). Now lazy + runtime-cached rather than parsed at startup.

---

## Commits on this branch (newest first)
- `feat(phase4)` AI layer scaffold (functions + client fallback + chat UI)
- `perf(phase3)` vendor chunk splitting, exercises.json off precache, memo fix
- `feat(phase2b-2)` Build + Workout flows → design system; WorkoutPage decomposed
- `feat(phase2b-1)` Home/Calendar, Profile, Nav, Exercises → design system
- `feat(phase2a)` form primitives + native parity (wake lock, install, rest timer)
- `feat(phase1)` tokens+dark toggle, serde, runtime fixes, ESLint, perf, code-split
- `feat(shell)` canonical AppShell — toolbar/swipe/viewport glitch fixes (Milestone 0)
