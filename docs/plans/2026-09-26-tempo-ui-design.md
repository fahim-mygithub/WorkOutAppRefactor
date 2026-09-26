# Tempo UI — Design

**Status:** Approved (auto-approve, 2026-09-26)
**Supersedes:** `2026-06-17-workout-whiteboard-chalkboard-design.md` (the whiteboard/chalkboard look)
**Reference mockups:** Claude Design canvas "WorkoutApp Redesign Palette" → row 2, *Tempo* (Today, Live set, Rest)

---

## 1. Philosophy

Tempo is a **dark focus mode: one thing at a time.** It is the visual expression of the v2
load-bearing principle, *least intrusive during the workout*.

Rules every component is judged against (this is what "not lift-and-shift" means):

1. **One primary action per screen.** It is an amber pill, full width, bottom-anchored in the
   thumb zone. Everything else is secondary (raised-navy pill) or ghost text.
2. **Numbers are the interface.** Weight, reps, time render in Archivo *expanded* 800 at a size you
   can read at arm's length. Labels are small, muted, sentence case, and sit *under* the number.
3. **Depth by surface steps, not lines.** navy → subtle → raised. No hand-drawn outlines, no
   borders on cards, no drop shadows. A 1px `--surface-raised` hairline only to separate list rows.
4. **Progressive disclosure.** Screens show the next decision; detail (history, notes, video,
   settings) lives one tap away in a sheet. A component that shows everything at once gets split.
5. **Ice = done / informational, amber = act now.** Success-green and danger-red are reserved for
   real outcomes (saved, PR, destructive).
6. **Quiet motion.** One spring moment per interaction that changes state (log set, rest ring);
   no ambient animation.
7. **Plain words.** Sentence case, verbs on buttons ("Log set", "Start session"), no emoji.

## 2. Foundation

### Palette (`src/styles/tokens.css`, dark only)
| token | value | use |
|---|---|---|
| `--surface` | `#121826` | app ground |
| `--surface-subtle` | `#1B2334` | cards, sheets |
| `--surface-raised` | `#263047` | controls, steppers, chips, row hairlines |
| `--ink` | `#E8ECF4` | primary text |
| `--ink-muted` | `#9AA5B8` | labels, meta (AA on subtle) |
| `--ink-subtle` | `#7C879B` | placeholder, disabled |
| `--accent` | `#F4B740` amber | the one primary action, active tab, focus ring |
| `--accent-fg` | `#121826` | text on amber |
| `--accent-2` | `#7CC4F2` ice | done state, secondary data, progress |

Muscle-group hues are retuned for navy. Shadcn aliases derive from the above. Light mode
(`.light`, ThemeProvider toggle, whiteboard palette) is **removed**.

### Type
Archivo variable (wdth 62–125, wght 100–900), self-hosted latin woff2 (offline-first, no CDN).
- `font-sans` / body: Archivo, normal width.
- `font-display`: Archivo, `font-stretch: 125%`, weight 800, tight tracking — screen titles and hero numbers.
- `font-num`: Archivo + tabular numerals for all live metrics.
Kalam and `board.css` are deleted.

### Shape
Pills (`rounded-full`) for primary/secondary actions and steppers; 20–24px (`rounded-2xl`/`3xl`) for
cards and sheets; 12px for inputs. Min touch target 44px, primary actions 56–72px.

### Primitives (`src/components/ui/*`, APIs unchanged)
Button (primary amber pill / secondary raised pill / ghost text / danger), IconButton (44px round,
raised), Card (subtle, no border), Sheet (subtle, grab handle, 24px top radius), Input/Textarea/Select
(raised fill, no border, amber focus ring), Tabs (segmented on raised), Switch (amber on).

## 3. Surfaces (priority order — one verified commit each)

1. **Shell + nav** — 4-tab bottom nav on navy (Today, Build, History, Profile per existing routes),
   amber active state, no bar chrome; page headers become a muted date/context line + display title.
2. **Live workout + rest timer** — one exercise in focus: display-size weight and reps with 60px
   round steppers, completed sets as ice chips, "Log set" amber pill bottom-anchored. Rest timer
   takes over: large amber ring, ±15s / Skip pills, "Up next" card. Exercise list, history, notes,
   video move behind icon buttons into sheets.
3. **Today / Home** — session hero (context line, display title, one-sentence summary, amber "Start"),
   week strip as 7 dots (ice = done, amber ring = today), two quiet stat tiles. Calendar and body map
   move below the fold or into sheets.
4. **Build** — text entry and wizard on subtle cards, parsed exercises as rows (not boxed cards),
   one "Save routine" primary.
5. **History / Profile** — list rows with hairlines, display numbers for PRs, settings grouped.
6. **Library (Exercises)** — search on raised pill, rows with muscle-hue dot, detail in a sheet.
7. **Auth + modals** — Login/SignUp as a Tempo hero; remaining modals restyled to Sheet.

## 4. Verification per commit
- `npm run typecheck:strict-paths` green; `npm run test:run` green (class-name assertions updated
  where primitives changed); full `typecheck` error count must not rise above the known baseline.
- Visual check in claude-in-chrome on the dev server (port 5290) at phone size (pinned AppShell);
  signed-in surfaces need the user to sign in.
- Commit + push to `feat/tempo-ui`.

## 5. Out of scope
New features, new data, AI surfaces beyond restyling, light mode.
