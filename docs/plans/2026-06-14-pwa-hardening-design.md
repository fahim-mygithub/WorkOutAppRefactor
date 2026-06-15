# WorkoutApp — PWA Hardening Design (v2 re-scope)

**Status:** Approved (each section passed one adversarial-analysis turn — 2026-06-14)
**Date:** 2026-06-14
**Author:** Fahim (with Claude Code)
**Supersedes the native/store strategy of:** `docs/plans/2026-04-23-workoutapp-v2-design.md` (Capacitor + app stores). Design system, AI design, and the "least-intrusive" principle carry over.

---

## 0. What changed vs. the 2026-04-23 v2 plan, and why

The old v2 plan chose **Capacitor + iOS/Android app-store release**. Today's goal is the opposite: **act like an app *without* app-store install** — i.e. install-to-home-screen. That is the PWA model. Tauri was already evaluated and rejected in the old doc (and its mobile story still requires store/sideload, so it does not serve this goal either).

So this is a **re-scope, not a rewrite**: harden the *existing* `WorkOutAppRefactor` PWA, reuse the completed Phase 0 design foundations, and re-implement the useful native-plan capabilities with web-platform APIs.

**Reality check that reshaped this doc (verified against the code):**
- **Capacitor was never installed** — no `@capacitor/*`, no `capacitor.config`. We are not "replacing" Capacitor; we are abandoning an unbuilt plan and building on the PWA that already exists (`vite-plugin-pwa` is configured with Workbox + manifest + `autoUpdate`).
- **There is no `redux-persist` and no `localStorage`** anywhere in `src/`. Durable state is 100% Firestore. The old plan's "kill ad-hoc localStorage / add redux-persist" items were describing infrastructure that does not exist.
- **The AI layer does not exist yet** (no `functions/`, no Anthropic calls). It is carried over as a *design*, deferrable.

---

## 1. Framing  ·  *adversarial verdict: APPROVE-WITH-CHANGES*

**Goal:** turn `WorkOutAppRefactor` into a best-in-class **installable PWA** that feels native, fixing the specific glitches (toolbar drift on scroll, swipe-vs-browser, address-bar jumps), rolling the Phase 0 design system onto real screens, and improving cold-start.

**Honest platform limits (load-bearing — state these to users, don't paper over them):**
1. **Haptics:** `navigator.vibrate()` works on Android; **iOS Safari ignores it entirely.** The old plan's "haptics replace toasts" principle degrades to **visual/toast feedback on iOS**. No web workaround exists.
2. **Backgrounded rest-timer alerts:** a closed/backgrounded PWA cannot self-schedule a notification (Notification Triggers API is abandoned; SW `setTimeout` dies). The *only* wake-from-closed path is **server push** (FCM Web Push → APNs), which on iOS needs **16.4+, installed to home screen, permission from a user gesture**. See §3 for the decision.
3. **iOS edge-swipe back/forward** cannot be fully disabled from web; mitigations are best-effort and only in installed/standalone mode.
4. **Screen Wake Lock** in an installed iOS PWA was broken until **iOS 18.4** (WebKit bug 254545); feature-detect and degrade.
5. **No install prompt on iOS** (`beforeinstallprompt` is Chromium-only) — iOS users must manually use Share → Add to Home Screen. This is a real adoption-funnel cost.

**Success criteria (measurable, with "installed mode" qualifiers):**
1. In installed/standalone mode, the bottom nav and any sticky header **do not move** during momentum scroll on iOS 17+ and Android Chrome (verify visually + e2e asserting the nav element's box stays fixed).
2. In installed mode, in-app horizontal gestures (dnd drags, sheet swipes) **do not trigger browser navigation** (best-effort on iOS; fully on Android).
3. In installed mode, **no layout shift** from the address bar (it's absent); `100svh` shell audited so content never hides under chrome.
4. The home, calendar, build, and profile surfaces render with the **unified design tokens + primitives** (acceptance: 0 raw `bg-gray-*`/hex on migrated screens).
5. **Cold-start TTI improves ≥25%** vs a captured Lighthouse baseline on a mid-tier Android profile (baseline captured as step 0 of §5).

**AI layer** is designed but **deferred** (open decision §8) — when built, the Firebase callable function behaves the same from a PWA as it would have from Capacitor (callables handle CORS; a raw `onRequest` would need explicit CORS for the hosting origin).

---

## 2. App-shell architecture  ·  *adversarial verdict: APPROVE-WITH-CHANGES*

**The disease:** `src/App.css` has **seven** competing positioning strategies (`fixed-bottom-safe`, `mobile-fixed-bottom`, `bottom-nav-keyboard-aware`, `bottom-nav-pwa`, `ios-absolute-bottom-nav`, `mobile-viewport-stable`, `scroll-container-with-bottom-nav`). `html` scrolls **and** an inner `100vh` container scrolls (double scroll). The bottom nav is `position: fixed` with `translateZ(0)` hacks → it drifts on iOS momentum scroll.

**The cure — one canonical `<AppShell>`:**
```
body { height: 100svh; overflow: hidden; overscroll-behavior: none; }
AppShell (flex column, height:100svh):
  ├─ <header>  (optional; sticky within shell; safe-area-inset-top padding)
  ├─ <main>    flex:1; overflow-y:auto; overscroll-behavior:contain;
  │            -webkit-overflow-scrolling:touch   ← the ONLY scroll container
  └─ <nav>     flex sibling (NOT position:fixed); safe-area-inset-bottom padding
```

**Use `100svh`, not `100dvh`** — `dvh` lags on iOS toolbar collapse and can push the nav under the Safari chrome; `svh` (smallest viewport) guarantees the shell always fits. (Existing CSS already uses `100svh`; my first draft regressed it.)

**Required changes the migration must include (caught by red-team):**
- **Hoist the nav out of the routes.** Today `<BottomNavigation/>` is rendered *inside each route wrapper* and conditionally hidden for anonymous shared-workout viewers; `LoginPage`/`SignUpPage` render outside any wrapper. AppShell needs a **chromeless mode** (no nav) for auth pages and route/auth-driven nav visibility at the shell level.
- **Fix `window.scrollTo`.** `ExercisesPage.tsx:49` calls `window.scrollTo` — a **no-op** once `<main>` is the scroller. Convert all scroll-to-top / scroll-restoration to target the `<main>` ref. (grep `scrollTo|scrollIntoView`.)
- **`min-h-screen` → `min-h-full`.** ~11 pages use `min-h-screen` (100vh); inside a flex `<main>` that forces children taller than the viewport → permanent extra scroll / nav overlap.
- **Modal scroll-lock.** Several modals set `document.body.style.overflow`; with body already `overflow:hidden` their cleanup re-enables body scroll and fights the shell. Lock the `<main>` scroller (or make them no-ops).
- **Keyboard: do NOT just delete `useIOSKeyboardFix`.** Replace it with a single VisualViewport-driven hook that, on iOS, shrinks the shell to `visualViewport.height` (and hides the flex nav while the keyboard is open — otherwise the static nav sits under the keyboard). `interactive-widget=resizes-content` alone is **not** honored by iOS Safari. Keep `useKeyboardDetection`.
- dnd-kit autoscroll actually improves with a single scroller (low risk; test drag-to-edge on Build).

The 7 doomed classes are referenced in only 3 files (~21 occurrences) — cheap to delete. The expensive part is the `min-h-screen` / `window.scrollTo` / modal-overflow cleanup above.

---

## 3. Native-feature parity via web APIs  ·  *adversarial verdict: APPROVE-WITH-CHANGES*

| Capability | Web approach | Status / caveat |
|---|---|---|
| Install to home screen | manifest (done) + Android `beforeinstallprompt` flow + iOS manual A2HS instructions | iOS has no prompt; funnel cost. |
| **Rest timer (foreground/resume)** | Anchor to stored `targetEndTime` (epoch ms); recompute on `visibilitychange`/resume; Web Audio beep when foregrounded | **Fixes a real existing bug** — current `RestTimer.tsx` is a bare `setInterval` with no timestamp anchor, so it drifts/freezes when backgrounded. Build this regardless. |
| **Rest timer (backgrounded alert)** | **Decision required (§8):** (a) FCM Web Push from a Firebase Function scheduled server-side, or (b) scope to "foreground + on-resume only, no alert when fully backgrounded" | "SW-scheduled notification" is **impossible** (Notification Triggers abandoned). iOS push needs 16.4+/installed/user-gesture. Pick (a) or (b); do not imply background reliability without (a). |
| Haptics | `navigator.vibrate` | Android only; **iOS no-op** → visual/toast fallback on iOS. |
| Keyboard | VisualViewport hook + `interactive-widget` | Replaces the 158-LOC `useIOSKeyboardFix`. |
| In-app back | History API | Fine. Android system-back maps to history pop; handle "close sheet vs exit app" explicitly. |
| Edge-swipe back suppression | best-effort `touchstart` edge guard | **Cannot be fully disabled on iOS**; reframe as best-effort. |
| Persistence / offline | Firestore `enableIndexedDbPersistence` (NOT redux-persist) | No localStorage/redux-persist exists; this is the cheap offline path. Fix `customExerciseSlice` writing raw `Date` objects (RTK serializability) regardless. |
| Keep screen on | Screen Wake Lock API | iOS installed-PWA support only from **18.4**; feature-detect. |
| AI layer | Firebase callable Function `/ai` | Deferred; callable handles CORS. |

---

## 4. UI uplift rollout  ·  *adversarial verdict: REJECT → revised to APPROVE-WITH-CHANGES (blockers resolved below)*

**Blocker #1 — unify tokens FIRST (before touching any screen):**
- Collapse `src/App.css :root` (shadcn set) and `src/styles/tokens.css` into **one source of truth**; resolve the duplicate `--accent` (App.css slate currently overrides the brand blue the `Button` relies on).
- **Wire a real `.dark` class toggle** on `document.documentElement`, driven by the existing `setTheme` Redux state (today nothing applies `.dark`, so light tokens render against dark legacy screens). Decide dark-first vs light (§8).

**Blocker #2 — build the missing form primitives before screen migration.** Phase 0 shipped only Button/IconButton/Card/Stack/Skeleton/Sheet. The screens are form-heavy and have **no primitive** for: `Input`, `Select`, `Textarea`, `Tabs`, `Toast` (a hand-rolled one exists), `Dropdown`, `Switch/Radio`, `Slider`, `SegmentedControl`, `Chart`. "modals→Sheet" only swaps chrome; the form contents (e.g. `CustomExerciseModal`'s inputs/selects/validation) need these primitives first.

**Blocker #3 — calendar glyphs.** The calendar wireframe centers on muscle-group SVG icons, but Phase 0 **deleted** the in-house icon module and pinned to `lucide-react`. Either build a real `MuscleGroupIcon` (re-opening a "closed" decision) **or** rewrite the wireframe around Lucide. Also: `getWorkoutColor` hashes workout *names* into 16 arbitrary hues; the design wants **7 muscle-group hues keyed by muscle group** — that needs a session→muscle-group derivation, not a class swap. And reconcile the 11-group taxonomy in `CustomExerciseModal` with the 7 token hues.

**Then** roll per screen (priority from `docs/research/2026-04-23-ui-gap-analysis.md`): Home/Calendar → BottomNavigation → modals→Sheet (as primitives land) → WorkoutPage last. Each screen migrated **once**, combining redesign + decomposition (see §7). Replace raw `gray-*`/hex with tokens; loading states → `Skeleton`; motion from `src/lib/motion.ts`.

---

## 5. Performance  ·  *adversarial verdict: APPROVE-WITH-CHANGES (was near-REJECT)*

**Step 0 — capture a baseline.** No Lighthouse/web-vitals/visualizer exists. Capture cold-start TTI, main-thread parse time, and bundle size before changing anything, so "≥25% faster" is falsifiable. Add `rollup-plugin-visualizer`.

**The big win, correctly framed:** `public/muscle_exercises.csv` is 5343 rows but groups to **52 unique exercises**. Replace the 3 MB transport with a **build-time `exercises.json` (52 entries, precomputed search keywords)** — emit it from the existing `copy_exercises.py`. This removes the 3 MB asset, the client-side `papaparse`, the Web Worker, and the IndexedDB-cache idea **all at once**. (No worker/virtualization needed.)

**Other items (verified):**
- Remove `useExercises()` from `AppRouter` root (it forces the load on app start). Lazy-load the exercise DB only on the routes that use it: **Directory, Build, and Profile** (Profile needs it for template/history conversion — my first draft missed it; Home/WorkoutPage don't need it).
- Route-level code splitting (`React.lazy` + `Suspense`); verify the auth guard doesn't defeat it.
- **Drop console at build time** via esbuild `drop:['console']` (keeps source readable) — same effort as the code-health cleanup, not a second task.
- **WorkoutPage:** the real cost is the **1 s `setInterval` dispatching `updateWorkoutDuration`** re-rendering the whole tree. Isolate the timer into a small leaf component (or local state). Blanket `React.memo` is *not* the fix.
- **Drop:** virtualization (directory paginates at 12) and "exclude Phase0Showcase" (already dead to the prod bundle — it's only reachable via the separate `showcase.html`).

---

## 6. Code-health baseline  ·  *adversarial verdict: APPROVE-WITH-CHANGES*

- **Triage the 73 TS errors NOW** into (a) type noise vs (b) latent runtime bugs; fix (b) immediately. Confirmed live bug: `sharedWorkoutService.ts:394 docRef.delete()` (Firebase v8 API on a v9 ref) → `deleteSharedWorkout()` **throws on every call**; should be `deleteDoc(docRef)`. Plus null-deref clusters on `ProfilePage`/`WorkoutPage`/`CustomExerciseModal`. "Fix opportunistically" is unsafe for these.
- **ESLint must be scoped, not repo-wide.** A stock recommended config yields **~174 errors** (mostly `no-unused-vars`, `no-explicit-any`, `exhaustive-deps`) + **1 genuine `rules-of-hooks` bug** (conditional hook). Land the flat config (`eslint.config.js` is missing though deps + `lint` script exist), gate CI only on the green surface (`src/{components/ui,lib,test}`), and ratchet outward. Make ESLint the **first** Phase-1 step so the console purge + serde work are mechanically enforceable.
- **Serde = two functions, not one.** Read path (`serializeFirestoreData`: Timestamp/Date→ISO) and write path (`cleanDataForFirestore`: strip `undefined`) are opposite directions. Build `firestore/serde.ts` as `toFirestore`/`fromFirestore`, kill the inline dup `safeTimestampToISOString` in `sharedWorkoutService`, and pick **one canonical date type** (the `ExerciseHistory` type says `Date` but code stores ISO strings and calls `localeCompare` — that mismatch cascades into shared types).
- **Error boundaries:** the router uses the component API (`BrowserRouter`/`Routes`), not a data router, so `errorElement` isn't available. Add a class `ErrorBoundary`: one around `<Routes>` (in `App.tsx`) + individual wraps on `WorkoutPage`/`BuildPage`. No data-router migration needed.
- **Console cleanup:** 140 `console.log` / 263 total `console.*`. Build-time drop (above). One trap: `router/index.tsx:33` has `{console.log(...)}` as a **JSX child** — must be removed with its expression, not by line.
- **Tests:** scope "tests required" to **extracted helpers/primitives** (e.g. `serde.ts`), not full suites for the 2857 LOC of untested pages — otherwise scope balloons. Characterization tests only for the big pages.

---

## 7. Sequencing  ·  *adversarial verdict: APPROVE-WITH-CHANGES*

**Milestone 0 — Glitch fixes (ship first, fastest visible win):** the app-shell rebuild (§2) — single scroll container, non-fixed flex nav, `100svh`, VisualViewport keyboard hook, best-effort swipe guard. Ship on its own so the user feels the fix before the invisible work lands. *Exit: nav/header don't drift; no viewport jump in installed mode.*

**Phase 1 — Foundations & code-health:** ESLint (scoped) **first** → token unification + `.dark` toggle (§4 blocker #1) → build the missing form primitives (§4 blocker #2) → triage+fix runtime TS bugs → `firestore/serde.ts` → error boundaries → build-time console drop → `exercises.json` + remove `useExercises()` from root + route code-splitting (the cheap perf wins) → capture Lighthouse baseline. *Exit: lint green on scope, tokens render correctly, primitives ready, cold-start measured + improved.*

**Phase 2 — UI uplift (redesign + decompose together, touch each screen once):** Home/Calendar → BottomNav → modals→Sheet → WorkoutPage/BuildPage (decompose **and** redesign in the same pass; isolate the WorkoutPage timer leaf here). Native parity wired per surface: rest-timer timestamp anchor + wake lock + keyboard + install prompt. *Exit: primary screens on the design system; app feels native.*

**Phase 3 — Measured perf only:** profile on real devices; apply memoization/extraction where the profiler points; bundle audit. (No separate "decompose" pass — that happened in Phase 2.) *Exit: documented before/after numbers.*

**Phase 4 — AI layer (optional/deferrable):** `/ai` Firebase callable, parse + chat-with-tools, chart vocabulary, Apply/Reject confirmation UX.

**Honest timeline:** **~12–14 weeks solo without AI** (16+ with AI). The old plan's 16 weeks included Capacitor + store submission; dropping those is only ~25–30% real reduction because the hard parts (redesigning ~6 surfaces, decomposing two ~900-LOC pages, clearing 73 TS errors) remain. "8 weeks" is not credible.

---

## 8. Open decisions

1. **Backgrounded rest-timer:** build FCM Web Push (server dependency, iOS 16.4+/installed) *or* scope to foreground+resume only? (Drives whether a Firebase Function + push infra is in scope.)
2. **Dark vs light:** ship dark-first with the toggle, or light-first? (Tokens support both; the toggle must be wired either way.)
3. **Muscle-group glyphs:** build a real `MuscleGroupIcon` SVG set (re-open Phase-0 decision) or keep Lucide and rewrite the calendar wireframe around it?
4. **AI layer:** in this scope or a follow-up?
5. **Offline:** turn on Firestore IndexedDB persistence, or stay online-only for now?
6. **iOS install funnel:** how aggressively to surface manual A2HS instructions?
7. **Brand/name:** still "WorkOutAppRefactor"?

---

## 9. Out of scope (unchanged from v2 §9)
Voice control, Watch/Wear rep counting, on-device LLM, vision form review, replacing Redux/Firebase, **Tauri/desktop**, **Capacitor/native shells**, **app-store distribution**.
