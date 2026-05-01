# Calendar Redesign — Wireframe

**Status:** Pending Gate 2 approval
**Phase:** 0, Task 10
**Date:** 2026-05-01
**Source of truth:** `src/dev/Phase0Showcase.tsx` §05 (live at `http://localhost:5173/showcase.html`, sub-sections 05.1 / 05.2 / 05.3)
**Implementer reference for Phase 2:** `src/components/home/WorkoutCalendar.tsx` (current v1)
**Feeds:** Phase 2 calendar redesign (replaces `WorkoutCalendar.tsx`).

---

## What changed vs. v1

| Surface | v1 | v2 |
|---|---|---|
| Default view | Month grid (`WorkoutCalendar.tsx:18–90`) | **Week strip**, month one tap deeper |
| Day glyph | Letter-on-rectangle (`L` / `M` / `H`) | **Muscle-group SVG** (game-icons.net, CC BY 3.0; Task 9) |
| Day-detail | Centered modal (`WorkoutCalendar.tsx:217–249`) | **Bottom sheet** (Task 16 Sheet primitive) |
| Today indicator | Pulsing dot + ring | Static accent ring around cell — pulsing during a workout violates least-intrusive principle |
| Rest day | Empty cell | Subtle 4-px dot, `bg-ink-subtle/30` |
| Missed day | Implicit (no marker) | Explicit: dim + slash overlay + danger tint |
| Intensity | Letter (`L`/`M`/`H`) | 2-px bar under the icon, width = intensity, color = muscle hue at 60% alpha |
| Mode | Dark only | Dark default, **light supported** |

---

## Day-state vocabulary

Five states; three orthogonal signal axes (color = muscle group, glyph variant = state, ring = today/active).

| State | Visual |
|---|---|
| **Completed** | Full-color muscle SVG + 12-px check badge in `bg-success` at top-right |
| **Today** | Full-color muscle SVG + `ring-2 ring-accent` around the cell (no glyph variant — ring carries the signal) |
| **Upcoming (planned)** | Muscle SVG at 65 % opacity (was 70 % in research; tightened after live review for clearer differentiation vs today) |
| **Rest day** | 4-px dot in `bg-ink-subtle/30`, no icon |
| **Missed** | Muscle SVG at 50 % opacity + `slash` overlay glyph + `text-danger/85` tint |

Real game-icons silhouettes do not have outline-vs-filled variants like the placeholder set, so **today** and **upcoming** are differentiated by ring + opacity rather than glyph variant. Cell-level treatment (background tint, ring, badge) carries the load.

---

## Token usage

| Surface element | Token |
|---|---|
| Calendar background (page level) | `bg-surface` |
| Day cell background | `bg-surface-raised` (or `bg-accent/8` when today) |
| Day cell border | `border hsl(var(--ink) / 0.08)` (or `1.5px solid var(--accent)` when today) |
| Today ring | `ring-2 ring-accent` |
| Muscle icon color | `text-muscle-{push|pull|legs|core|cardio|full-body|mobility}` |
| Completed badge background | `bg-success` |
| Rest dot | `bg-ink-subtle/30` |
| Missed slash + tint | `text-danger/85` |
| Intensity bar | `bg-muscle-{group}/60` |
| Sheet surface | `bg-surface-raised` |
| Sheet drag handle | `bg-ink/15` |
| Sheet backdrop | `bg-ink/40 backdrop-blur-sm` |

All values resolve through `tokens.css` so dark + light render correctly.

---

## Layout decisions

### Week view (default)

- 7-column grid, `aspectRatio: 1 / 1.15` per cell, gap 8px on mobile / 12px on desktop
- Header row: title (`title` 22px / 600) + date range (`mono10` `inkSubtle`)
- One cell per day. Cell anatomy from top to bottom:
  1. Top-left: `M 21` style label (`mono10`, `inkSubtle`)
  2. Center: muscle-group SVG (size 32 on desktop, 28 on mobile)
  3. Bottom: intensity bar (only for non-rest days with intensity)
  4. Top-right (overflow): completed check badge

### Month view

- Tap the week-header date range to expand into 5-week month grid
- 7-column day-label header (`M T W T F S S`), then 35-cell grid (5 weeks)
- Cell anatomy mirrors week view but at half scale (icon size 20, badge 12)
- Outside-month days dimmed to 25 % opacity, no glyph
- Same vocabulary, same token mappings

### Day-detail sheet (interaction)

Tap a non-rest day → bottom sheet slides up from `inset-x-0 bottom-0` using **slow + springSoft** (380 ms, `cubic-bezier(0.32, 0.72, 0, 1)`).

Sheet content top-to-bottom:
1. Drag handle (40 × 4 px, `bg-ink/15`)
2. Eyebrow row: date (`WED, AUG 23` mono10 `inkSubtle`) + state badge (`TODAY` mono10 `accent`)
3. Header: muscle SVG + session name (`Legs, Day 12` `display-lg/24` 700)
4. Exercise list: rows with name (`body-sm/14` 500) + sets (`mono11`); completed rows tinted `bg-success/8`
5. Volume metric: label (`mono10`) + value (`title` 22 / 700 / tabular-nums)
6. Primary CTA: 48-px tall `Button` variant primary

CTA copy varies by state:
- Today: **Mark complete** or **Start session**
- Past + done: **Edit session**
- Past + missed: **Reschedule**
- Future: **Edit plan**

Dismissal: backdrop tap, Escape, swipe-down on drag handle. No X button.

---

## Open questions for Phase 2

1. **Week pagination** — does the week strip horizontally scroll (8 weeks ahead/behind, lazy-render) or paginate per swipe? **Recommend swipe-paginated week** (matches Apple Fitness summary tab); easier to keep "today" centered.
2. **Month-tap target** — currently the week-header date-range string toggles month view. Confirm during Phase 2 implementation that the tap target meets `touch-min`; may need an explicit pill/chevron affordance.
3. **Multi-session days** — Phase 0 wireframe assumes one session per day. v1 supports up to 2. If v2 keeps 2-session days, the cell needs a stacking treatment (two half-icons or a small "+1" indicator). **Defer to Phase 2.**
4. **Long-term view** — Whoop has a year-grid view for streaks. Phase 0 doesn't include it. **Defer to Phase 3** (post-MVP).
5. **Off-week / training-block boundaries** — does the calendar visually mark deload weeks or program block transitions? **Defer to Phase 3.**

---

## Gate 2 checklist

Approve to lock the wireframe and unblock Phase 2 calendar implementation:

- [ ] Day-state vocabulary (completed / today / upcoming / rest / missed) reads correctly in both light and dark
- [ ] Muscle SVGs are legible at 32 px (week) and 20 px (month)
- [ ] Today ring + intensity bar combine cleanly without visual conflict
- [ ] Day-detail sheet content (date / icon+name / exercises / volume / CTA) is the right information density
- [ ] CTA-by-state behavior matrix is correct
- [ ] Pull-cyan (`muscle-pull` 198 85% 48%) reads distinctly from the today accent ring at calendar scale
- [ ] Token usage table maps cleanly to `tailwind.config.ts` semantics from Task 5

Reply **approve** to proceed to Phase 2 calendar implementation. Or call out specific cells / states / tokens to revise.
