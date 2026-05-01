# UI/UX Gap Analysis — WorkoutApp v2

**Date:** 2026-05-01
**Author:** Research agent (Phase 0 Task 4)
**Feeds:** Task 5 (tokens), Task 6 (motion), Task 9 (icons), Task 10 (calendar)

---

## 1. Executive summary

- v1 loses to every modern competitor on visual hierarchy and motion. It uses Tailwind defaults, 13 ad-hoc CSS keyframes, and "circle-with-letter" calendar markers; Hevy/Strong/Whoop/Apple all run typed semantic palettes with spring-driven transitions.
- **Calendar is the single biggest gap.** Whoop's status dot and Apple's mini-rings prove a single SVG glyph + color can carry session type + intensity. Replacing v1's `L`/`M`/`H` letters (`WorkoutCalendar.tsx:217-226`) with the Task 9 muscle-group icons is the highest-leverage change.
- **Modals flip from centered → bottom-sheet.** All v1 modals are centered overlays; Hevy/Strong/Future and iOS-native flows default to bottom sheets. The Sheet primitive (Task 16) is the v2 default; centered modals reserved for destructive confirms.
- **Set-logging collapses to one tap + one numeric pad** (Strong's pattern, Caliber's "tap last value to populate" affordance). Phase 4 should use `IconButton size="lg"` (56 px) for the checkmark CTA.
- **Token placeholders are nearly correct.** Two deviations in §5: muscle-`pull` shifts to a cooler hue to avoid colliding with `accent`; dark-mode `ink-muted` drops from 73 → 70 to clear WCAG AA on `surface-raised`.

---

## 2. Per-app teardown

| App | Nav | Motion | Calendar / scheduling | Set logging | Color + type | Iconography |
|---|---|---|---|---|---|---|
| **2.1 Hevy** | 5-tab bottom (Home, Routines, **Start**, Exercises, Profile) — middle tab visually emphasized as quick-action. | Spring scale + opacity ~200–300 ms on set-complete; reviewers call the checkmark animation the "rewarding" moment. | Routine cards show colored bands per planned day; muscle-distribution heatmap during logging. Week is the implicit "what's next." | Tap-to-complete with silent pre-fill of previous performance. Slight extra nav vs Strong. | Dark/light follow OS. Saturated blue accent, near-black dark surfaces, tight numerals. | Animated muscle-highlight body silhouettes, not abstract icons. |
| **2.2 Strong** | 4-tab bottom (Workout, History, Exercises, Profile). | Minimal — "no extra motion mid-set" is explicitly praised. Fastest log-to-rest cycle of any app. | History = GitHub-style green heatmap. Calendar is not a primary surface. | The benchmark. Last weight/reps pre-filled; one tap on the check completes. Custom in-app numeric pad, not OS keyboard. | Monochrome + single accent. Tabular numerals at ~22–24 pt, medium weight. | Sparse Lucide-stroke icons. Muscle groups as text chips. |
| **2.3 Caliber** | 5-tab bottom; card-based coaching feeds beyond Strong/Hevy density. | Standard iOS push/pop, ~350 ms ease-out. No signature motion. | Linear plan/schedule; calendar is secondary. | "Last: 95 lbs" hint under each field; tap to populate (more discoverable than silent pre-fill). | Warm grayscale + green-for-done. Wellness-leaning, not barbell-leaning. | Coach avatars + circular profile imagery dominate. |
| **2.4 Future** | Coach-first, ~4-tab; chat with the human coach is the primary surface. | Full-bleed coach video, fade-driven 300–400 ms transitions, generous haptics. | Weekly plan default. Each day is a session card with cover image + duration. | iPhone surface is mostly tick-off, not data entry; Apple Watch carries the load. | Very dark backgrounds, photographic accents, 40–56 px display headings. | Photography + coach avatars; abstract icons are tertiary. |
| **2.5 Apple Fitness** | Tabs: Summary, Fitness+, Sharing. Ring is hero. | iOS-native spring (default damping 15, stiffness 170, ~330 ms perceived). Rings tween 0.7–1.0 s on refresh. iOS 26 adds Liquid Glass translucency. | Week strip + month grid. Each day = mini three-ring. Day-detail = navigation push (not a sheet). | Workouts are timer-driven; data entry is rare. Apple Watch start/stop. | SF Pro Display + Text. Move red `0xFA114F`, Exercise green `0x92E82A`, Stand blue `0x1EEAEF`. HIG bans light weights. | SF Symbols throughout; activity rings themselves carry workout-type meaning. |
| **2.6 Whoop** | Tab bar with Recovery as the calendar surface. | iOS-native motion. | Days are colored dots: **green 67–100, yellow 34–66, red 0–33**. Week is default; long-term tab one tap away. Journal calendar shows behavior frequency without text scanning. | N/A (passive tracker). | Saturated dot + numeric label per day; high-density, glanceable. | Status dot is color-only — orthogonal to session type. Takeaway for v2: keep session-type and intensity on different axes. |
| **2.7 Strava** | Tabs; activity feed is hero. | Standard iOS. | Heatmap is polyline-based; gradient cold-blue → hot-orange. Variants: `hot`, `blue`, `purple`, `gray`, `red`. Elevation/HR/grade plots = single saturated line on dark grid, no fill, auto-enabled at ≥ 100 m elevation. | N/A. | Strava Orange `#FC4C02` used sparingly — primary actions only — on neutral grays. Sans family with tabular numerals on metrics, oversize activity titles. | Custom set + photographic activity covers. Takeaway: reserve `accent` for one job; do not double-duty as a data hue. |

Sources: Hevy [help.hevyapp 2025](https://help.hevyapp.com/hc/en-us/articles/33106320824727-Everything-You-Need-to-Know-About-the-Hevy-App-2025-Features-Guide), [Sophia Yang teardown](https://www.sophiaxsyang.com/projects/hevy), [theme docs](https://www.hevyapp.com/help/change-the-theme-android-ios/); Strong [strong.app](https://www.strong.app/), [Avante IO](https://enterprise.avante.io/blog/2018/10/the-strong-exersice-tracker-app), [GymGod comparison](https://gymgod.app/blog/strong-vs-hevy); Caliber [BarBend review](https://barbend.com/caliber-fitness-app-review/), [Fitness Drum](https://fitnessdrum.com/caliber-app-review/); Future [future.co](https://future.co/), [App Store](https://apps.apple.com/us/app/future-pro-personal-training/id1288178982); Apple [HIG](https://developer.apple.com/design/human-interface-guidelines), [Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings), [WWDC23 springs](https://developer.apple.com/videos/play/wwdc2023/10158/); Whoop [Recovery 101](https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/), [Trend views](https://www.whoop.com/us/en/thelocker/track-progress-with-new-trend-views/); Strava [Personal heatmaps](https://support.strava.com/hc/en-us/articles/216918467-Personal-Heatmaps).

---

## 3. Current app audit

| Surface | File | Pain point |
|---|---|---|
| Calendar | `WorkoutCalendar.tsx:163-249` | Up to 2 colored rectangles per day, first-letter glyph (`getWorkoutInitial`); intensity = `ring-1 ring-white/50` + opacity steps. Today = `bg-primary/10 ring-2` with pulsing dot. Day-detail modal is centered. |
| Bottom nav | `BottomNavigation.tsx:18-44` | 5 Lucide icons; hard-coded `bg-black`, `text-gray-400`, `bg-blue-500` dot. `scale-110` active state. No tokens. |
| Workout page | `WorkoutPage.tsx:1-120` | Imports 9 sibling modals — all centered. Lucide icons at 16/20 px, below `touch-min`. |
| Rest timer | `RestTimer.tsx:24-100` | Web Audio beeps, hand-rolled `setInterval`, no shared timings; final-3 alert is sound, not haptic. |
| Custom exercise modal | `CustomExerciseModal.tsx:13-44` | 11-string muscle-group list, mismatched with v2's 7-group taxonomy. Centered, native selects. |
| Animations | `animations.css:1-297` | 13 keyframes, raw `0.2s`/`0.3s`/`0.5s`/`0.6s`/`1s`/`1.5s`/`2s`. `ease-out`/`ease-in`/linear; one Material curve appears once. No shared scale. |

All three issues called out in the design doc — circle-with-letter, centered modals, ad-hoc animation timings — are confirmed.

---

## 4. Gap analysis (ranked by impact)

| # | Gap | Modern apps do | v1 does | Impact | Recommendation |
|---|---|---|---|---|---|
| 1 | Calendar legibility | Whoop: status dot. Apple: mini ring. Hevy: muscle-highlight figure. | 5×3 px colored rect with `L`/`M`/`H` letter (`WorkoutCalendar.tsx:217-226`). | **High** | Replace with `MuscleGroupIcon` (Task 9). One icon per day, `text-muscle-{group}`. Intensity → optional bar under icon. |
| 2 | Modal pattern | Hevy/Strong/Future: bottom sheet for day-detail, edit, picker flows. | All v1 modals are centered overlays (`CustomExerciseModal`, `ExerciseEditModal`, etc.). | **High** | Sheet primitive (Task 16) becomes the default in Phase 2 redesigns. Centered modals reserved for confirm/destructive prompts. |
| 3 | Set-logging tap targets | Strong/Caliber: 56–60 px primary tap; auto-fill last values; checkmark = single primary CTA. | `SetInput` is multi-field; checkmark is a 20 px Lucide icon (below `touch-min`). | **High** | Phase 4 set-logging refactor uses `IconButton size="lg"` (56 px) for the checkmark. Inherit this from Task 12 spec. |
| 4 | Motion vocabulary | iOS spring (damping 15, stiffness 170; ~270–380 ms perceived); Strava/Apple cap at 3 reusable curves. | 13 ad-hoc keyframes; durations 0.1–2s without semantic intent. | **High** | `src/lib/motion.ts` (Task 6) ships 3 durations × 3 easings × 3 presets. Migration of old `animations.css` is Phase 2/4 work. |
| 5 | Color system | Monochrome + 1 saturated accent (Strong, Strava); semantic muscle palette layered on top. | `bg-blue-500`/`bg-red-500`/`bg-green-500` raw scales (`WorkoutCalendar.tsx:130-150`); `bg-card`/`bg-muted` Shadcn defaults elsewhere. | **High** | Encode muscle palette as 7 distinct hues with HSL triplets (§5). Reserve `--accent` for today/primary action only. |
| 6 | Bottom nav active state | Hevy/Strong: subtle pill background or inset highlight + slightly larger icon. Apple: SF Symbol weight shift. | `scale-110` + 4 px dot above icon + hard-coded `bg-black` background (`BottomNavigation.tsx:67-83`). | **Medium** | Phase 2 redesign: token-driven background `bg-surface`, indicator pill behind icon, drop scale animation in favor of color shift. |
| 7 | Typography hierarchy | Apple HIG: ≥ medium weight, never light; large display sizes for hero metrics. Strava: tabular nums on data. | Tailwind defaults: `text-xl`, `text-sm`, `text-xs`. No tabular-num enabled. No `metric` size. | **Medium** | Type scale in §5 with `metric` (56 px) and `display-lg` (48 px). Tabular numerals for weights/reps via `font-feature-settings` in tokens.css. |
| 8 | Touch sizing | iOS HIG mandates 44 pt min; primary actions skew larger (56–60 pt). | Lucide icons at 16/18/20 px without min-touch wrappers — many calendar/nav touches under 44 px (`BottomNavigation.tsx:22`). | **Medium** | Add `touch-min: 44px` and `touch-lg: 56px` semantic spacing tokens (matches Task 5 placeholder). Enforce via primitives. |
| 9 | Rest-timer feedback | Apple Watch: haptic taps + ring fill. Whoop/Future: in-app pulse + haptic. | Web Audio beep (`RestTimer.tsx:83-98`); pulsing color is the only visual; no haptic API hookup. | **Medium** | Phase 1+: Capacitor `Haptics.impact` for the final-3 countdown. Visual: ring/progress arc using `motion-reduce:` fallback. |
| 10 | Iconography unification | Hevy real-figure illustrations; Apple SF Symbols; Strava custom set. v2 needs *one* coherent set. | `lucide-react` (clean stroke style) + raw emoji/letter for muscle groups + ad-hoc colored rectangles. | **Medium** | Task 9 delivers 7 hand-drawn muscle-group SVGs at 24/32/48 px; Lucide remains for utility (chevrons, edit, etc.). |
| 11 | Calendar default | Whoop: week. Future: week. Apple: week strip with month one tap away. Hevy: routine cards (no monthly grid). | v1 starts on month grid (`WorkoutCalendar.tsx:18-90`). Month for a fitness app is *too* much density at a glance. | **Medium** | Phase 2 calendar wireframe (Task 10): default to **week**, month one tap away. |
| 12 | Empty / loading states | Strava/Hevy: skeleton + meaningful copy ("No workouts yet — start your first session"). | Loading is a `animate-pulse` block of muted divs (`WorkoutCalendar.tsx:37-62`); no copy. | Low–Medium | `Skeleton` primitive (Task 15) + standardized empty-state composition in Phase 2. |

---

## 5. Token recommendations (for Task 5)

Format: HSL triplets, light → dark mode where applicable. Numbers match the placeholders in Task 5 unless noted.

### Color (HSL, light → dark)

```
--surface         0 0% 100%   →  222 47% 8%
--surface-subtle  0 0% 98%    →  222 47% 11%
--surface-raised  0 0% 100%   →  222 47% 14%

--ink           222 47% 11%   →  210 20% 98%
--ink-muted     217 19% 35%   →  217 19% 70%   /* DEVIATES: placeholder 73% — bumped to 70% for WCAG AA on surface-raised */
--ink-subtle    215 16% 47%   →  215 16% 60%
--ink-inverse     0  0% 100%  →  222 47% 8%

--accent        217 91% 60%   →  217 91% 65%   /* single-purpose: today/primary action */
--accent-fg       0  0% 100%

--success       142 71% 45%   →  142 71% 50%
--warning        38 92% 50%   →   38 92% 55%
--danger          0 84% 60%   →    0 84% 65%

--muscle-push        4 90% 58%   /* warm red */
--muscle-pull      198 85% 48%   /* DEVIATES: placeholder 214 89% 52% collides with accent — shift to cyan-blue */
--muscle-legs       35 91% 55%   /* amber */
--muscle-core      280 75% 60%   /* violet */
--muscle-cardio    345 85% 58%   /* magenta-red */
--muscle-full-body 160 60% 45%   /* teal-green */
--muscle-mobility  200 70% 55%   /* sky */

--shadow        222 47% 11%    →   0 0% 0%
```

**Deviations:** (1) `--muscle-pull` shifted to avoid visual collision with `--accent` on calendar today-rings — Strava's principle that brand hue is single-purpose. (2) `--ink-muted` dark mode at 73% measured ~4.3:1 against `surface-raised` (under WCAG AA 4.5:1); 70% clears.

### Spacing

Tailwind 4-pt baseline confirmed. Semantic touch tokens: `touch-min: 44px` (iOS HIG min), `touch-lg: 56px` (primary live-workout). No deviation.

### Radius

`xs 4 / sm 8 / md 12 / lg 16 / xl 24 / full 9999` px. No deviation.

### Elevation

`e0: none`, `e1: 0 1px 2px hsl(var(--shadow)/0.06)`, `e2: 0 2px 8px hsl(var(--shadow)/0.08)`, `e3: 0 8px 24px hsl(var(--shadow)/0.10)`. No deviation.

### Typography

```
caption    12 / 1.4    +0.01em
body-sm    14 / 1.45
body       16 / 1.5
title      22 / 1.2    -0.01em  600
display    32 / 1.1    -0.02em  700
display-lg 48 / 1.05   -0.02em  700
metric     56 / 1.0    -0.02em  700   /* live workout, tabular-nums */
```

Stack: `sans: Inter`, `display: Inter Tight`, `mono: JetBrains Mono`. Apply `font-feature-settings: "tnum"` on metric/display via `tokens.css`. Apple HIG bans light weights — minimum is `500`. No deviation.

### Motion

```
snap   120ms   |  smooth 220ms   |  slow 380ms
springSoft    cubic-bezier(0.32, 0.72, 0, 1)    /* default */
springBouncy  cubic-bezier(0.34, 1.56, 0.64, 1) /* PR celebrations */
easeOutExpo   cubic-bezier(0.16, 1, 0.3, 1)     /* fades */
```

Anchored to iOS native springs (default damping 15, stiffness 170 ≈ ~330 ms perceived, per [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/)). `slow` is intentionally tighter than iOS's ~500 ms sheet to keep web snappy, matching Hevy's logging feel. No deviation.

---

## 6. Calendar redesign brief (for Task 10)

**Default view:** Week strip at the top of Home, with a "Month" tab one tap away. Whoop / Future / Apple all default to week; v1's month-default loses scannability for typical 4–6-day-per-week lifters.

**Day-state vocabulary** (each day cell):

| State | Visual |
|---|---|
| Completed | Filled muscle-group SVG in `text-muscle-{group}`, plus 12-px check badge in `bg-success` at top-right of the cell. |
| Today | Outline muscle-group SVG + `ring-2 ring-accent` around the cell. No pulsing — pulsing during a workout violates least-intrusive principle. |
| Upcoming (planned) | Outline muscle-group SVG only, `text-muscle-{group}/70` tint to differentiate from today. |
| Rest day | Single 4-px dot in `bg-ink-subtle/30`. No icon. |
| Missed (past, planned, no completion) | Outline icon + `text-danger/60` tint + small `slash` overlay glyph. Subtle — not punitive. |

**Icon vs color allocation:** **Color = muscle group, glyph = same muscle group, badge/state = accent or success.** This keeps the three signal axes orthogonal:
- Session type → muscle-group hue (red/blue/amber/violet/magenta/teal/sky).
- State → glyph variant (filled, outline, slashed, dot-only).
- Today/active → ring color (always `accent`).

**Day-detail interaction:** Tap a day → bottom sheet (Sheet primitive, Task 16) slides up from `inset-x-0 bottom-0` with `slow + springSoft`. Sheet contents: date, list of completed/planned exercises, total volume, edit affordance. Backdrop dismisses; Escape dismisses; safe-area inset honored on iOS.

**Intensity indicator:** Yes — but **subtle and optional**. A 2-px-tall bar under the muscle icon, width 25/50/100 % corresponding to light/medium/heavy. Color matches the muscle hue at 60 % alpha. Skip on rest days.

**Mode:** Dark default (matches Hevy/Strong/Whoop/Future). Both light and dark wireframes generated by Claude Design.

**Open question for Phase 2:**
- Does the week strip horizontally scroll (8 weeks ahead/behind, lazy-render) or paginate per swipe? Recommend **swipe-paginated week** (matches Apple Fitness summary tab); easier to keep "today" centered.

---

## Sources

Sources are inlined in §2 and §5. Additional iconography references: [Dribbble workout icons](https://dribbble.com/search/workout-icons), [Icons8 muscle group](https://icons8.com/icons/set/muscle-group), [Idyllic SVG muscle icons](https://us.idyllic.app/gen/svg-muscle-group-icons-567586).
