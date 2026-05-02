# Calendar Layout Inspiration — Fitness Apps

Research date: 2026-04-23. Purpose: fix the badly-spaced calendar wireframe in `src/dev/Phase0Showcase.tsx` (`WeekStrip`, `MonthGrid`, `DayCell`, `MonthCell`). Sizes are estimated from screenshots/marketing pages at iPhone 14 Pro width (393 pt logical).

---

## 1. Per-app teardowns

### Hevy — Profile > Calendar
Classic month grid, **circular** date cells. Completed days are solid blue circles; tap opens that workout. Streak count is a numeric pill top-left. 7-column grid, each cell ~40-44 pt (full-bleed minus ~16 pt page padding), gaps tight (~6-8 pt). Day-of-week letters in a thin mono row above the grid. Header is the month name (~22-24 pt semibold) with chevron prev/next.
Refs: [Hevy gym-consistency](https://www.hevyapp.com/features/gym-consistency/), [Hevy tutorial](https://www.hevyapp.com/hevy-tutorial/).

### Apple Fitness — Summary tab + History calendar
Summary uses a **W/M/6M/Y** segmented toggle. History replaces calendar cells with **three concentric activity rings** per day on black per HIG (rings need outer margin >= the inter-ring distance). Days with workouts get a **green dot in the upper-right** — the canonical secondary indicator. Cells ~44 pt square, ~8 pt gaps. The day-detail screen has a 7-cell horizontal week strip across the top.
Refs: [Apple HIG — Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings), [Apple Support — Summary](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios), [iMore history guide](https://www.imore.com/how-view-your-past-activity-rings-and-workouts-activity-iphone), [HealthTechCoach](https://healthtechcoach.com/inside-the-activity-app/).

### WHOOP — recovery calendar
Per-day **colored dots** (red/yellow/green). Dots are small (~10-14 pt) inside larger date cells; date label sits above the dot. Pattern: minimal cell, **one** glyph.
Refs: [WHOOP trend views](https://www.whoop.com/us/en/thelocker/track-progress-with-new-trend-views/), [WHOOP past performance](https://support.whoop.com/hc/en-us/articles/360023075734).

### Strava — Training Log
Rows of **scaled, color-coded bubbles** sized by activity volume (d3-scale log). Weeks are horizontal rows with a weekly-total summary on the right edge. The separate Calendar view is a standard month grid with one bubble per activity inside each cell.
Refs: [Strava engineering](https://medium.com/strava-engineering/the-new-training-log-59bcbf8a3747), [Strava community spotlight](https://communityhub.strava.com/insider-journal-9/spotlight-on-the-training-log-1497).

### Strong, Nike Training Club, Peloton, Centr (planner views)
Strong: square-ish month cells, completed filled with workout accent, ~4-6 pt gaps ([Strong.app](https://www.strong.app/)). NTC, Peloton, and Centr planners share the same pattern: a **horizontal week strip at the top** (7 cells, today highlighted) above a vertically-scrolling day list. Cells are rounded squares ~44-48 pt wide / 56-64 pt tall; today gets a **filled accent background**, never a border alone.
Refs: [Peloton scheduling](https://www.onepeloton.com/blog/scheduling-feature), [PeloBuddy iOS scheduling](https://www.pelobuddy.com/peloton-officially-releases-scheduling-feature-for-ios-app-build-calendar-within-peloton-app/), [Centr](https://centr.com/), [TechRadar — Centr](https://www.techradar.com/health-fitness/fitness-apps/centr-review), [NTC guide](https://www.savionixa.com/how-to/plan-workouts-using-the-nike-training-app/).

---

## 2. Common patterns (3+ apps agree)

- **Cell shape**: rounded square dominates for week strips (Peloton, NTC, Centr, Caliber); circle dominates for month grids (Hevy, Apple Fitness rings, WHOOP dots). Gentle radius `lg 16` works for both.
- **Gap**: 6-10 pt between cells in 7-column grids. Nobody uses >12 pt because it visually fragments the week.
- **Today treatment**: filled accent background, not a 1.5 px border. Border-only "today" reads as "selected but not current" and is the weakest signal.
- **Day label**: mono caption (10-12 pt) **above or top-aligned** inside the cell — never centered alongside the glyph.
- **Secondary metric**: a single small indicator (dot, ring, bar) — **one** signal per cell. Stacking check + intensity + group color + missed slash overwhelms.
- **Header**: month/range label 22-28 pt, paired with a small mono right-aligned counter (e.g., "AUG 21-27" or "18 / 23 PLANNED"). Header → grid gap is **16-24 pt** (Apple Fitness, Hevy, NTC all sit in this range).
- **Touch target floor**: 44 pt (Apple HIG) / 48 dp (Material). Anything smaller in a 7-column strip on a 393 pt viewport means cells are barely tappable.
  Refs: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines), [Material M3 date pickers](https://m3.material.io/components/date-pickers/specs).

---

## 3. Concrete recommendations for the showcase

The showcase renders week strips at ~50% viewport via the side-by-side light/dark layout. At 50% width minus padding, each of 7 cells lands around **38-42 px** wide — below the 44 pt touch floor and far tighter than any reference app. **Stack the light/dark week strips vertically** (or render them at full container width on one row, dark below light). This single change does ~70% of the fix.

After stacking, apply:

| Property | Current | Recommended |
|---|---|---|
| Week-strip cell aspect | `1 / 1.15` | `1 / 1.25` (taller, fits day-letter + glyph + intensity bar) |
| Week-strip cell padding | 12 px | **10 px** (less, more room for icon at this size) |
| Gap between cells | 8 px | **6 px** week / **4 px** month |
| Border radius | 14 px | **12 px** (matches token `md`) |
| Today treatment | 1.5 px accent border + 8% tint | **Filled accent at 16% tint + accent-colored top-aligned date** (drop the border) |
| Day label position | top-left, 10 px mono | top-aligned **centered**, 11 px mono — centering reads cleaner across 7 cells |
| Header → strip gap | 16 px | **20-24 px** (Apple/Hevy breathing room) |
| Header type size | 22 px | keep 22 (token `title`), but add 4-6 px padding-bottom to range label |
| Light/dark layout | side-by-side 2-col | **stacked vertically**, full container width each |
| Month-cell aspect | `1 / 1.05` | `1 / 1` (perfect square, day-of-week chrome above absorbs label) |
| Month gap | 8 px | **4 px** (Apple Fitness pattern — month grids breathe via low cell density, not gap) |
| Completed badge | 20 px circle, top-right `-6` overhang | **inline 6 px dot** under the date, accent color — overhanging badges break the grid rhythm |

Hierarchy ratio to lock in: **header (22) : day-letter (11) : glyph (28-32) : intensity bar (2 px tall, 60% width)**. The glyph is the loudest element; everything else recedes.

---

## 4. Worst common mistake to avoid

**Stacking too many indicators in one cell.** Lower-quality Dribbble fitness mocks routinely cram: number + day-letter + group icon + check badge + intensity bar + colored border + colored fill into a single 44 pt cell. The result is unreadable noise. The current showcase `DayCell` is on the edge of this anti-pattern — it has all six signals on completed days. **Pick a maximum of three: (1) date label, (2) one glyph (icon OR ring OR dot), (3) one state cue (background fill OR badge, not both).** Apple, Hevy, and WHOOP each use exactly two visual channels per cell, and that restraint is why their calendars scan instantly.
