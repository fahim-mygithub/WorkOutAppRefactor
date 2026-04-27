# WorkoutApp v2 — Phase 0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the design + tooling foundation for the v2 refactor — gap research, design tokens, motion principles, custom muscle-group icons, calendar wireframe, Shadcn + Framer Motion installed, and six base UI primitives shipped with tests.

**Architecture:** No app behavior changes in Phase 0. We are adding parallel infrastructure (`src/components/ui/*`, `src/icons/*`, `src/lib/motion.ts`, design tokens in `tailwind.config.ts`, research docs under `docs/research/`). Existing components stay untouched until Phase 2 surfaces redesign them. TDD for every primitive — Vitest + React Testing Library + jsdom. Each task ends with a commit.

**Tech Stack:** React 19, TypeScript strict, Vite 6, Tailwind 3.4, Vitest 3.2, Framer Motion, Shadcn UI (Radix UI primitives), `clsx`, `tailwind-merge`, `class-variance-authority`.

**Reference:** Full v2 design at `docs/plans/2026-04-23-workoutapp-v2-design.md`. Phase 0 is **§5 (Phase 0 deliverables)** and **§8 (Sequencing — week 1)** of that doc.

---

## Phase 0 task overview

| # | Task | Output |
|---|---|---|
| 1 | Test infrastructure | Vitest + RTL + jsdom configured, smoke test green |
| 2 | Path aliases | `@/*` alias in `tsconfig.json` and `vite.config.ts` |
| 3 | Migrate `tailwind.config.js` → `tailwind.config.ts` | Typed config |
| 4 | UI/UX gap research (agent-driven) | `docs/research/2026-04-23-ui-gap-analysis.md` |
| 5 | Design tokens | Color, spacing, radius, elevation, typography in `tailwind.config.ts` |
| 6 | Motion principles | `src/lib/motion.ts` + `docs/design/motion-principles.md` |
| 7 | Install Framer Motion | Dependency + smoke import |
| 8 | Install Shadcn UI | `components.json`, `cn` utility, `globals.css` token layer |
| 9 | Muscle-group SVG icons | `src/icons/MuscleGroup/*.tsx` (push, pull, legs, core, cardio, full-body, mobility) |
| 10 | Calendar wireframe (Claude Design) | `docs/research/2026-04-23-calendar-wireframe.md` linking the mockup |
| 11 | `Button` primitive | `src/components/ui/button.tsx` + tests |
| 12 | `IconButton` primitive | `src/components/ui/icon-button.tsx` + tests |
| 13 | `Card` primitive | `src/components/ui/card.tsx` + tests |
| 14 | `Stack` primitive | `src/components/ui/stack.tsx` + tests |
| 15 | `Skeleton` primitive | `src/components/ui/skeleton.tsx` + tests |
| 16 | `Sheet` primitive | `src/components/ui/sheet.tsx` + tests (Radix Dialog + Framer Motion) |
| 17 | Phase 0 wrap-up | Update CLAUDE.md, design doc index, baseline screenshot |

---

## Task 1: Set up test infrastructure (Vitest + React Testing Library + jsdom)

**Goal:** Make `npm run test` actually run and produce green output for a smoke test. Phase 0 cannot do TDD without this.

**Files:**
- Modify: `package.json` (add devDeps + scripts)
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.ts`
- Modify: `tsconfig.json` (include vitest globals)

**Step 1: Install dev dependencies**

```bash
npm install --save-dev jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8
```

Expected: 5 packages added, no peer-dep warnings (React 19 is supported by `@testing-library/react` ≥ 16).

**Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.config.*', 'dist/'],
    },
  },
});
```

**Step 3: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

**Step 4: Update `tsconfig.json` to include vitest types**

Add to `compilerOptions`:
```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

**Step 5: Write a failing smoke test**

Create `src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 6: Run it**

```bash
npm test -- --run
```

Expected: `1 passed`. If it fails on JSDOM imports or test globals, re-check tsconfig and `vitest.config.ts`.

**Step 7: Add coverage script to `package.json`**

Update `scripts`:
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

**Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/ tsconfig.json
git commit -m "chore(test): set up Vitest + RTL + jsdom infrastructure"
```

**Acceptance:** `npm run test:run` green; coverage HTML generated in `coverage/` (gitignored).

---

## Task 2: Add `@/*` path alias

**Goal:** Enable `@/components/ui/button` style imports — required by Shadcn's CLI and a strong DX win.

**Files:**
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`

**Step 1: Add alias to `tsconfig.json`**

Add to `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

**Step 2: Add alias to `vite.config.ts`**

```ts
import path from 'node:path';
// ...
export default defineConfig({
  // ...
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // ...
});
```

**Step 3: Verify with a smoke import**

In `src/test/smoke.test.ts`, replace contents:
```ts
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('alias', () => {
  it('resolves @/* to src/*', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});
```

(`src/lib/utils.ts` already exists in the codebase; if it doesn't export `cn`, add it: `export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');`. Will be replaced in Task 8 with the Shadcn version using `clsx + tailwind-merge`.)

**Step 4: Run**

```bash
npm run test:run && npm run typecheck
```

Expected: green test, clean typecheck.

**Step 5: Commit**

```bash
git add tsconfig.json vite.config.ts src/lib/utils.ts src/test/smoke.test.ts
git commit -m "chore: add @/* path alias for src/"
```

**Acceptance:** `import x from '@/...'` resolves in both runtime (Vite) and typecheck (tsc); tests stay green.

---

## Task 3: Migrate `tailwind.config.js` → `tailwind.config.ts`

**Goal:** Typed Tailwind config so design tokens get IntelliSense and the CI typechecker catches mistakes.

**Files:**
- Delete: `tailwind.config.js`
- Create: `tailwind.config.ts`

**Step 1: Read the current `tailwind.config.js`**

```bash
cat tailwind.config.js
```

Capture the existing content for parity.

**Step 2: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Tokens land here in Task 5
    },
  },
  plugins: [],
};

export default config;
```

(Preserve any plugin entries / content paths from the existing JS config.)

**Step 3: Delete the JS config**

```bash
rm tailwind.config.js
```

**Step 4: Verify build still works**

```bash
npm run build
```

Expected: clean build, no Tailwind warnings about missing config.

**Step 5: Commit**

```bash
git add tailwind.config.ts
git rm tailwind.config.js
git commit -m "chore(tailwind): migrate config to TypeScript"
```

**Acceptance:** `npm run build` succeeds; `dist/assets/*.css` contains expected utility classes.

---

## Task 4: UI/UX gap research (agent-driven)

**Goal:** Produce `docs/research/2026-04-23-ui-gap-analysis.md` — a research doc that informs design tokens (Task 5), motion principles (Task 6), iconography (Task 9), and calendar redesign (Task 10).

**Files:**
- Create: `docs/research/2026-04-23-ui-gap-analysis.md`

**Step 1: Dispatch the research agent**

Spawn an `Explore` or `general-purpose` agent with this prompt:

> Audit five modern fitness apps and produce a UI/UX gap analysis for a workout-tracking app being rebuilt. Apps to study: **Hevy, Strong, Caliber, Future, Apple Fitness**, plus **Whoop** (calendar treatment) and **Strava** (graphs/heatmaps). For each: capture (a) navigation pattern (bottom nav, tab bar, drawer, FAB), (b) motion vocabulary (durations, easings, signature transitions), (c) calendar/scheduling treatment (how upcoming workouts are previewed, what icons/colors signal session type), (d) set-logging UX (tap targets, keyboard handling, weight pickers), (e) color + typography systems, (f) iconography for muscle groups. Cite sources with URLs and screenshots where useful.
>
> Then produce a side-by-side gap analysis vs. the current app at `C:\Users\fahim\Desktop\Pojects\WorkoutApp\WorkOutAppRefactor`. Read `src/components/home/WorkoutCalendar.tsx`, `src/components/BottomNavigation.tsx`, `src/pages/WorkoutPage.tsx`, `src/components/RestTimer.tsx`, `src/components/CustomExerciseModal.tsx`, `src/styles/animations.css` to ground the comparison. Identify the **8–12 highest-impact gaps** and rank them by user value.
>
> Output to `docs/research/2026-04-23-ui-gap-analysis.md` with sections: (1) executive summary, (2) per-app teardown (one section each), (3) current-app audit, (4) gap analysis ranked by impact, (5) token recommendations (color/spacing/radius/elevation/motion timings) for Task 5, (6) calendar redesign brief for Task 10. ~1500–2500 words. Use markdown tables liberally.

**Step 2: Review the output**

Read the produced doc. Check that it covers all six required sections and has actionable token recommendations.

**Step 3: Commit**

```bash
git add docs/research/2026-04-23-ui-gap-analysis.md
git commit -m "docs(research): UI/UX gap analysis for v2 redesign"
```

**Acceptance:** Doc exists, includes all six sections, has at least one token recommendation per category (color, spacing, radius, elevation, motion).

---

## Task 5: Implement design tokens in `tailwind.config.ts`

**Goal:** Encode the Task 4 token recommendations as semantic Tailwind tokens. Stop using raw `bg-blue-500` style classes in Phase 2 component work.

**Files:**
- Modify: `tailwind.config.ts`
- Create: `src/styles/tokens.css` (CSS custom properties for runtime theming + dark mode)
- Modify: `src/main.tsx` or wherever the global stylesheet is imported (verify `tokens.css` loads before app styles)

**Step 1: Define semantic token vocabulary in `tailwind.config.ts`**

Use the gap research recommendations. Example shape (substitute actual values from Task 4):

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          subtle: 'hsl(var(--surface-subtle))',
          raised: 'hsl(var(--surface-raised))',
        },
        // Text
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          muted: 'hsl(var(--ink-muted))',
          subtle: 'hsl(var(--ink-subtle))',
          inverse: 'hsl(var(--ink-inverse))',
        },
        // Brand / accents
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          fg: 'hsl(var(--accent-fg))',
        },
        // Semantic
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        // Muscle groups (drives icon backgrounds + calendar dots — see Task 9/10)
        muscle: {
          push: 'hsl(var(--muscle-push))',
          pull: 'hsl(var(--muscle-pull))',
          legs: 'hsl(var(--muscle-legs))',
          core: 'hsl(var(--muscle-core))',
          cardio: 'hsl(var(--muscle-cardio))',
          'full-body': 'hsl(var(--muscle-full-body))',
          mobility: 'hsl(var(--muscle-mobility))',
        },
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      boxShadow: {
        // Elevation scale
        e0: 'none',
        e1: '0 1px 2px hsl(var(--shadow) / 0.06)',
        e2: '0 2px 8px hsl(var(--shadow) / 0.08)',
        e3: '0 8px 24px hsl(var(--shadow) / 0.10)',
      },
      fontFamily: {
        // Tune from research
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter Tight', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Type scale
        'display-lg': ['48px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display':    ['32px', { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'title':      ['22px', { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'body':       ['16px', { lineHeight: '1.5' }],
        'body-sm':    ['14px', { lineHeight: '1.45' }],
        'caption':    ['12px', { lineHeight: '1.4',  letterSpacing: '0.01em' }],
        // Big numerals for live workout
        'metric':     ['56px', { lineHeight: '1.0',  letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      transitionDuration: {
        snap: '120ms',
        smooth: '220ms',
        slow: '380ms',
      },
      transitionTimingFunction: {
        // From motion principles (Task 6)
        'spring-soft': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'spring-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      spacing: {
        // 4-pt baseline already covered by Tailwind defaults; add semantic touch sizes
        'touch-min': '44px', // iOS HIG minimum
        'touch-lg': '56px',  // primary live-workout buttons
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: Define CSS custom properties in `src/styles/tokens.css`**

```css
@layer base {
  :root {
    /* Surface */
    --surface:        0 0% 100%;
    --surface-subtle: 0 0% 98%;
    --surface-raised: 0 0% 100%;

    /* Ink */
    --ink:         222 47% 11%;
    --ink-muted:   217 19% 35%;
    --ink-subtle:  215 16% 47%;
    --ink-inverse: 0 0% 100%;

    /* Accent */
    --accent:    217 91% 60%;
    --accent-fg: 0 0% 100%;

    /* Semantic */
    --success: 142 71% 45%;
    --warning:  38 92% 50%;
    --danger:    0 84% 60%;

    /* Muscle (substitute values from research) */
    --muscle-push:      4 90% 58%;
    --muscle-pull:    214 89% 52%;
    --muscle-legs:     35 91% 55%;
    --muscle-core:    280 75% 60%;
    --muscle-cardio:    0 84% 60%;
    --muscle-full-body: 160 60% 45%;
    --muscle-mobility: 200 70% 55%;

    --shadow: 222 47% 11%;
  }

  .dark {
    --surface:         222 47% 8%;
    --surface-subtle:  222 47% 11%;
    --surface-raised:  222 47% 14%;

    --ink:         210 20% 98%;
    --ink-muted:   217 19% 73%;
    --ink-subtle:  215 16% 60%;
    --ink-inverse: 222 47% 8%;

    --accent:    217 91% 65%;
    --accent-fg:   0  0% 100%;

    --success: 142 71% 50%;
    --warning:  38 92% 55%;
    --danger:    0 84% 65%;

    /* Muscle group hues stay; lightness shifts will be done in tokens.css if needed */

    --shadow: 0 0% 0%;
  }
}
```

**Step 3: Import `tokens.css` in `src/main.tsx`**

Add the import before any existing global CSS:
```ts
import '@/styles/tokens.css';
import '@/styles/animations.css'; // existing; keep for now
import '@/App.css';                // existing
```

**Step 4: Smoke test the tokens render**

Add to `src/test/smoke.test.ts`:
```ts
it('exposes muscle-group token CSS variable', () => {
  // jsdom doesn't load CSS; this verifies tailwind.config.ts compiles
  // Real visual smoke happens in the browser (Task 17)
  expect(true).toBe(true);
});
```

Run:
```bash
npm run test:run && npm run build
```

Expected: build succeeds; check `dist/assets/*.css` contains `--muscle-push` and `bg-muscle-push`.

```bash
grep -c "muscle-push" dist/assets/index-*.css
```

Expected: ≥ 1.

**Step 5: Commit**

```bash
git add tailwind.config.ts src/styles/tokens.css src/main.tsx src/test/smoke.test.ts
git commit -m "feat(design): add semantic design tokens (color, type, motion, spacing)"
```

**Acceptance:** `bg-surface`, `text-ink`, `bg-muscle-push`, `shadow-e2`, `rounded-md`, `duration-snap`, `ease-spring-soft`, `text-metric` all valid Tailwind classes; build succeeds; dark-mode tokens defined.

**Note:** Phase 0 does not yet ship a dark-mode toggle. Tokens exist; toggle is open decision #6 to be locked in Phase 1.

---

## Task 6: Motion principles + utility module

**Goal:** Three named motion variants every animated component reuses. Stop ad-hoc `transition-all duration-300` calls.

**Files:**
- Create: `src/lib/motion.ts`
- Create: `docs/design/motion-principles.md`
- Test: `src/lib/motion.test.ts`

**Step 1: Write the failing test**

`src/lib/motion.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { motion as variants } from '@/lib/motion';

describe('motion variants', () => {
  it('exposes snap, smooth, slow durations', () => {
    expect(variants.duration.snap).toBe(0.12);
    expect(variants.duration.smooth).toBe(0.22);
    expect(variants.duration.slow).toBe(0.38);
  });

  it('exposes named easings', () => {
    expect(variants.ease.springSoft).toEqual([0.32, 0.72, 0, 1]);
    expect(variants.ease.springBouncy).toEqual([0.34, 1.56, 0.64, 1]);
    expect(variants.ease.easeOutExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exposes sheet, fade, scale presets', () => {
    expect(variants.preset.sheetUp).toBeDefined();
    expect(variants.preset.fade).toBeDefined();
    expect(variants.preset.scale).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- motion
```
Expected: FAIL — module not found.

**Step 3: Implement `src/lib/motion.ts`**

```ts
// Single source of truth for animation timings & presets.
// Keep in sync with `tailwind.config.ts` transitionDuration/TimingFunction.

export const motion = {
  duration: {
    snap: 0.12,
    smooth: 0.22,
    slow: 0.38,
  },
  ease: {
    springSoft:   [0.32, 0.72, 0, 1] as const,
    springBouncy: [0.34, 1.56, 0.64, 1] as const,
    easeOutExpo:  [0.16, 1, 0.3, 1] as const,
  },
  preset: {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit:    { opacity: 0 },
      transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
    },
    scale: {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      exit:    { opacity: 0, scale: 0.96 },
      transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
    },
    sheetUp: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit:    { y: '100%' },
      transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] as const },
    },
  },
} as const;
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- motion
```
Expected: PASS.

**Step 5: Write `docs/design/motion-principles.md`**

```markdown
# Motion Principles

## Durations
- **snap (120ms)** — taps, toggles, micro-feedback. The user just acted; confirm immediately.
- **smooth (220ms)** — most UI transitions: enter/exit, hover, layout shift.
- **slow (380ms)** — entering large surfaces (sheets, modals) where the user needs to track origin.

## Easings
- **springSoft** `cubic-bezier(0.32, 0.72, 0, 1)` — default for everything; gentle settle.
- **springBouncy** `cubic-bezier(0.34, 1.56, 0.64, 1)` — celebratory only (PR achieved, set logged with overload).
- **easeOutExpo** `cubic-bezier(0.16, 1, 0.3, 1)` — fades. Linear for opacity feels dead; this gives life without bounce.

## Presets (`src/lib/motion.ts`)
- `fade` — opacity 0 ↔ 1, smooth/easeOutExpo. Use for inline reveal.
- `scale` — fade + 0.96 → 1, smooth/springSoft. Use for popovers, dropdowns.
- `sheetUp` — y 100% → 0, slow/springSoft. Use for bottom sheets.

## Rules
1. **Never animate during a live set** unless the rest timer demands it. `least-intrusive` principle.
2. **Reduce motion respected.** Wrap presets in `useReducedMotion()` checks; fall back to instant change.
3. **No `transition-all`.** Always specify the property and use a named duration class.
4. **Haptics over toasts.** When motion would call attention to a state change mid-workout, prefer Capacitor `Haptics.impact`.
```

**Step 6: Commit**

```bash
git add src/lib/motion.ts src/lib/motion.test.ts docs/design/motion-principles.md
git commit -m "feat(motion): add motion principles + variant module"
```

**Acceptance:** Tests pass; docs reflect the same numbers as the code; Tailwind tokens (Task 5) match these durations/easings.

---

## Task 7: Install Framer Motion

**Goal:** Add the dependency without using it yet (Sheet primitive in Task 16 is the first consumer).

**Files:**
- Modify: `package.json`

**Step 1: Install**

```bash
npm install framer-motion
```

Expected: 1 package added. React 19 compatibility is fine (Framer Motion ≥ 12 supports React 19).

**Step 2: Smoke import test**

Add to `src/test/smoke.test.ts`:
```ts
it('imports framer-motion', async () => {
  const { motion } = await import('framer-motion');
  expect(motion.div).toBeDefined();
});
```

```bash
npm run test:run
```
Expected: PASS.

**Step 3: Commit**

```bash
git add package.json package-lock.json src/test/smoke.test.ts
git commit -m "chore(deps): add framer-motion"
```

**Acceptance:** `framer-motion` resolves; bundle hasn't ballooned (verify with `npm run build` and note size).

---

## Task 8: Install Shadcn UI

**Goal:** Run `shadcn init`, configure the project, generate `lib/utils.ts` `cn()` (replacing the placeholder from Task 2). Phase 0 only initializes — components come in Tasks 11–16.

**Files:**
- Create: `components.json`
- Modify: `src/lib/utils.ts`
- Modify: `src/index.css` or `src/App.css` (Shadcn writes its layer here)
- Modify: `tailwind.config.ts` (Shadcn may add CSS-var-based color names — merge into our token system)

**Step 1: Run the Shadcn init**

```bash
npx shadcn@latest init
```

Answer prompts:
- TypeScript: **yes**
- Style: **new-york** (cleaner default than `default`)
- Base color: pick the closest to our `accent` token (likely **blue** or **slate**)
- Use CSS variables: **yes**
- Tailwind config: `tailwind.config.ts`
- `components.json`: accept default
- Imports: `@/components`, `@/lib/utils`
- React Server Components: **no**

This writes `components.json`, modifies `tailwind.config.ts` (Shadcn-style theme block), creates / overwrites `src/lib/utils.ts`, and writes a `:root` token block to a CSS file.

**Step 2: Reconcile Shadcn's tokens with ours**

Shadcn writes its own `--background`, `--foreground`, etc. We already wrote `--surface`, `--ink`. Two options:

- **Option A (recommended):** Keep both. Map Shadcn's defaults to our tokens — e.g. in `tokens.css`, add aliases:
  ```css
  :root {
    --background: var(--surface);
    --foreground: var(--ink);
    --card: var(--surface-raised);
    --card-foreground: var(--ink);
    --primary: var(--accent);
    --primary-foreground: var(--accent-fg);
    /* etc. */
  }
  ```
  Shadcn primitives keep working out-of-box; our semantic tokens stay primary.

- Option B: Edit every Shadcn-generated component to use our token names. More work, brittle.

Pick **A**. Append the alias block to `src/styles/tokens.css`.

**Step 3: Verify `cn` utility**

`src/lib/utils.ts` should now look like:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

If Task 2's placeholder is still there, replace it.

**Step 4: Update the Task 2 smoke test for the new `cn` semantics**

The new `cn` deduplicates conflicting Tailwind classes:
```ts
it('cn merges and dedupes', () => {
  expect(cn('p-2', 'p-4')).toBe('p-4');
  expect(cn('text-ink', false && 'hidden', 'font-semibold')).toBe('text-ink font-semibold');
});
```

**Step 5: Run**

```bash
npm run test:run && npm run build
```

Expected: green tests, clean build.

**Step 6: Commit**

```bash
git add components.json src/lib/utils.ts src/styles/tokens.css tailwind.config.ts package.json package-lock.json
git commit -m "feat(ui): initialize Shadcn UI, reconcile tokens"
```

**Acceptance:** `components.json` exists; `cn` uses `tailwind-merge`; Shadcn-aliased CSS variables map to our semantic tokens.

---

## Task 9: Custom muscle-group SVG icon set

**Goal:** Seven hand-drawn SVG icons (push, pull, legs, core, cardio, full-body, mobility) sized 24/32/48. Replace the "circle with letter" pattern flagged in the design doc.

**Files:**
- Create: `src/icons/MuscleGroup/Push.tsx`
- Create: `src/icons/MuscleGroup/Pull.tsx`
- Create: `src/icons/MuscleGroup/Legs.tsx`
- Create: `src/icons/MuscleGroup/Core.tsx`
- Create: `src/icons/MuscleGroup/Cardio.tsx`
- Create: `src/icons/MuscleGroup/FullBody.tsx`
- Create: `src/icons/MuscleGroup/Mobility.tsx`
- Create: `src/icons/MuscleGroup/index.ts`
- Create: `src/icons/MuscleGroup/MuscleGroup.tsx` (router component picking the right icon by group key)
- Test: `src/icons/MuscleGroup/MuscleGroup.test.tsx`

**Source the SVGs:** This is open decision #7 in the design doc. Three paths:

- **A. DIY in Claude Design** — generate SVGs in Claude Design or another vector tool, paste raw `<path>` data into each component.
- **B. Open-source set** — use icons from a kit like Iconify's `@iconify/icons-game-icons` or `noun-project` (license-permitting). Wrap as React components.
- **C. Commission** — out of Phase 0 scope.

**Default to A.** If the user hasn't produced SVGs in Claude Design before this task fires, the agent can prompt the user once for any one icon, then mirror that style for the remaining six. If Claude Design output is delayed, generate placeholder SVGs (geometric shapes color-coded by `--muscle-*` token) and flag for replacement.

**Step 1: Define the shared `MuscleIconProps` interface**

`src/icons/MuscleGroup/types.ts`:
```ts
export type MuscleGroup =
  | 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'full-body' | 'mobility';

export interface MuscleIconProps {
  size?: 24 | 32 | 48;
  className?: string;
  'aria-label'?: string;
}
```

**Step 2: Write a single icon (Push) — failing test first**

`src/icons/MuscleGroup/MuscleGroup.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MuscleGroupIcon } from '@/icons/MuscleGroup';

describe('MuscleGroupIcon', () => {
  it('renders the push variant', () => {
    render(<MuscleGroupIcon group="push" size={32} aria-label="Push day" />);
    const svg = screen.getByRole('img', { name: /push day/i });
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('throws nothing for every supported group', () => {
    const groups = ['push','pull','legs','core','cardio','full-body','mobility'] as const;
    groups.forEach((g) => {
      expect(() => render(<MuscleGroupIcon group={g} size={24} />)).not.toThrow();
    });
  });
});
```

```bash
npm run test:run -- MuscleGroup
```
Expected: FAIL — component not found.

**Step 3: Implement each icon**

`src/icons/MuscleGroup/Push.tsx`:
```tsx
import type { MuscleIconProps } from './types';

export function PushIcon({ size = 24, className, ...rest }: MuscleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      className={className}
      {...rest}
    >
      {/* Replace with final art. Placeholder: stylized bench-press bar */}
      <path
        d="M2 12h20M5 9v6M19 9v6M9 11h6v2H9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

Repeat for Pull (vertical bar with handle), Legs (squat silhouette), Core (torso with belt), Cardio (heart pulse), FullBody (figure outline), Mobility (figure with arc lines). Keep `currentColor` so callers can recolor via `text-muscle-push` etc.

**Step 4: Implement the router component**

`src/icons/MuscleGroup/MuscleGroup.tsx`:
```tsx
import { PushIcon } from './Push';
import { PullIcon } from './Pull';
import { LegsIcon } from './Legs';
import { CoreIcon } from './Core';
import { CardioIcon } from './Cardio';
import { FullBodyIcon } from './FullBody';
import { MobilityIcon } from './Mobility';
import type { MuscleGroup, MuscleIconProps } from './types';

const MAP = {
  'push': PushIcon,
  'pull': PullIcon,
  'legs': LegsIcon,
  'core': CoreIcon,
  'cardio': CardioIcon,
  'full-body': FullBodyIcon,
  'mobility': MobilityIcon,
} as const satisfies Record<MuscleGroup, React.FC<MuscleIconProps>>;

export interface MuscleGroupIconProps extends MuscleIconProps {
  group: MuscleGroup;
}

export function MuscleGroupIcon({ group, ...rest }: MuscleGroupIconProps) {
  const Icon = MAP[group];
  return <Icon {...rest} />;
}
```

`src/icons/MuscleGroup/index.ts`:
```ts
export { MuscleGroupIcon } from './MuscleGroup';
export type { MuscleGroup, MuscleIconProps } from './types';
```

**Step 5: Run tests**

```bash
npm run test:run -- MuscleGroup
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/icons/MuscleGroup/
git commit -m "feat(icons): muscle-group SVG icons (push/pull/legs/core/cardio/full-body/mobility)"
```

**Acceptance:** `<MuscleGroupIcon group="push" size={32} />` renders an SVG with `currentColor`; tests pass; visual review pass (Task 17 captures screenshots in Storybook-equivalent).

---

## Task 10: Calendar wireframe (Claude Design + research doc)

**Goal:** Produce the visual wireframe for the redesigned calendar — the user's biggest specific UI complaint. The mockup lives in Claude Design; the project tracks a research doc that links it.

**Files:**
- Create: `docs/research/2026-04-23-calendar-wireframe.md`

**Step 1: Open Claude Design and create the prototype**

User-driven step (Claude can navigate and prompt, but the visual generation lives in `claude.ai/design`):

> Prompt for Claude Design:
>
> *"Design a mobile-first workout calendar view for a fitness tracking app. Requirements:*
> - *Week-glance default; tappable to month-glance*
> - *Each day shows a muscle-group icon (push/pull/legs/core/cardio/full-body/mobility) instead of a colored letter circle*
> - *Distinguish: completed (filled icon, checkmark badge), today (ring outline), upcoming (icon outline only), rest day (no icon, dot only)*
> - *Optional intensity indicator: small bar under the icon (light/medium/heavy)*
> - *Dark mode by default, but generate both modes*
> - *Honors the design system tokens: surface, ink, muscle-{push,pull,legs,core,cardio,full-body,mobility}, accent*
> - *No popups during the live workout — calendar is a planning surface only*
> - *Bottom sheet for day-detail view (not modal)"*

Iterate until the wireframe feels right.

**Step 2: Write the linking doc**

`docs/research/2026-04-23-calendar-wireframe.md`:
```markdown
# Calendar Redesign — Wireframe

**Status:** Approved (Phase 0)
**Source of truth:** [Claude Design link — paste here]
**Mode:** Mobile-first; two breakpoints (≤480px, ≥768px)
**Implementer reference for Phase 2:** `src/components/home/WorkoutCalendar.tsx` (current)

## What changed vs. v1
- Circle-letters → muscle-group SVGs (Task 9)
- Day-detail modal → bottom sheet (Task 16 Sheet primitive)
- Ring-outline today indicator
- Intensity bar
- Dark mode default

## Token usage
| Surface | Token |
|---|---|
| Calendar background | `bg-surface` |
| Today ring | `ring-accent` |
| Muscle icon color | `text-muscle-{push,pull,...}` |
| Completed badge | `bg-success` + check icon |
| Rest-day dot | `bg-ink-subtle/30` |

## Open questions for Phase 2
- (List anything Claude Design surfaced that we didn't decide here)
```

**Step 3: Commit**

```bash
git add docs/research/2026-04-23-calendar-wireframe.md
git commit -m "docs(research): calendar redesign wireframe"
```

**Acceptance:** Doc has the Claude Design link, the token mapping table is filled in, and any open questions are listed.

---

## Tasks 11–16: Base primitives (TDD)

Each primitive follows the same shape:
1. Write failing test
2. Run, confirm fail
3. Implement minimal component
4. Run tests, confirm pass
5. Add visual check (Task 17 batches these)
6. Commit

Tests use `@testing-library/react` and assert: rendering, accessibility (role / aria), variant prop behavior, controlled-state behavior where relevant. **No snapshot tests** — they go stale and don't catch real bugs.

---

### Task 11: `Button` primitive

**Goal:** The first base primitive. CVA-driven variants, ref-forwarding, asChild slot pattern (Shadcn's standard).

**Files:**
- Create: `src/components/ui/button.tsx`
- Test: `src/components/ui/button.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders children and handles click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('respects disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies size and variant classes', () => {
    render(<Button variant="ghost" size="lg">x</Button>);
    const btn = screen.getByRole('button', { name: 'x' });
    expect(btn.className).toMatch(/min-h-touch-lg/);
  });

  it('forwards ref', () => {
    let ref: HTMLButtonElement | null = null;
    render(<Button ref={(el) => (ref = el)}>x</Button>);
    expect(ref).toBeInstanceOf(HTMLButtonElement);
  });
});
```

```bash
npm run test:run -- button
```
Expected: FAIL.

**Step 2: Implement**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-accent text-accent-fg hover:bg-accent/90',
        secondary: 'bg-surface-raised text-ink shadow-e1 hover:bg-surface-raised/90',
        ghost:     'text-ink hover:bg-surface-subtle',
        danger:    'bg-danger text-ink-inverse hover:bg-danger/90',
      },
      size: {
        sm: 'h-9 px-3 text-body-sm',
        md: 'min-h-touch-min px-4 text-body',
        lg: 'min-h-touch-lg px-5 text-body font-semibold',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
```

If `@radix-ui/react-slot` isn't installed (Shadcn init may have skipped it), `npm install @radix-ui/react-slot`.

**Step 3: Run**

```bash
npm run test:run -- button
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/button.test.tsx package.json package-lock.json
git commit -m "feat(ui): Button primitive with variants (primary/secondary/ghost/danger) and sizes (sm/md/lg)"
```

**Acceptance:** Test green; `<Button size="lg">` is ≥ 56px tall (touch-lg); disabled state un-clickable; ref forwarded; variants visually distinct.

---

### Task 12: `IconButton` primitive

**Goal:** Square button that wraps an icon, with required `aria-label`. The "least intrusive during workout" UX leans on these for log/skip/done actions.

**Files:**
- Create: `src/components/ui/icon-button.tsx`
- Test: `src/components/ui/icon-button.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconButton } from '@/components/ui/icon-button';
import { Check } from 'lucide-react';

describe('IconButton', () => {
  it('requires and exposes aria-label', () => {
    render(<IconButton aria-label="Mark set complete"><Check /></IconButton>);
    expect(screen.getByRole('button', { name: /mark set complete/i })).toBeInTheDocument();
  });

  it('size lg meets touch-lg height', () => {
    render(<IconButton aria-label="x" size="lg"><Check /></IconButton>);
    const btn = screen.getByRole('button', { name: 'x' });
    expect(btn.className).toMatch(/min-h-touch-lg/);
    expect(btn.className).toMatch(/min-w-touch-lg/);
  });
});
```

**Step 2: Implement**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-full transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-accent text-accent-fg hover:bg-accent/90',
        ghost:     'text-ink hover:bg-surface-subtle',
        danger:    'bg-danger text-ink-inverse hover:bg-danger/90',
      },
      size: {
        sm: 'h-9  w-9  [&>svg]:h-4 [&>svg]:w-4',
        md: 'min-h-touch-min min-w-touch-min h-touch-min w-touch-min [&>svg]:h-5 [&>svg]:w-5',
        lg: 'min-h-touch-lg  min-w-touch-lg  h-touch-lg  w-touch-lg  [&>svg]:h-7 [&>svg]:w-7',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  'aria-label': string; // required
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
```

**Step 3-5: Run, pass, commit**

```bash
npm run test:run -- icon-button
git add src/components/ui/icon-button.tsx src/components/ui/icon-button.test.tsx
git commit -m "feat(ui): IconButton primitive with required aria-label"
```

**Acceptance:** TypeScript enforces `aria-label`; `lg` size is 56px; ghost variant has no background.

---

### Task 13: `Card` primitive

**Goal:** Surface container with header/body/footer slots. Use everywhere a "raised surface" is needed.

**Files:**
- Create: `src/components/ui/card.tsx`
- Test: `src/components/ui/card.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';

describe('Card', () => {
  it('composes header, body, footer', () => {
    render(
      <Card>
        <CardHeader><CardTitle>Hi</CardTitle></CardHeader>
        <CardBody>body</CardBody>
        <CardFooter>foot</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByText('foot')).toBeInTheDocument();
  });

  it('elevation prop applies shadow', () => {
    const { container } = render(<Card elevation="e2">x</Card>);
    expect(container.firstChild).toHaveClass('shadow-e2');
  });
});
```

**Step 2: Implement**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

type Elevation = 'e0' | 'e1' | 'e2' | 'e3';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
}

export function Card({ elevation = 'e1', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-surface-raised text-ink',
        elevation === 'e0' && 'shadow-e0',
        elevation === 'e1' && 'shadow-e1',
        elevation === 'e2' && 'shadow-e2',
        elevation === 'e3' && 'shadow-e3',
        className,
      )}
      {...props}
    />
  );
}

export const CardHeader = (p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p} className={cn('flex flex-col gap-1 p-4 pb-2', p.className)} />
);
export const CardTitle = (p: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 {...p} className={cn('text-title', p.className)} />
);
export const CardBody = (p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p} className={cn('p-4 pt-2', p.className)} />
);
export const CardFooter = (p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p} className={cn('flex items-center justify-end gap-2 p-4 pt-2', p.className)} />
);
```

**Step 3-5: Run, pass, commit**

```bash
npm run test:run -- card
git add src/components/ui/card.tsx src/components/ui/card.test.tsx
git commit -m "feat(ui): Card + CardHeader/Title/Body/Footer primitive"
```

**Acceptance:** Composition works; elevation tokens drive shadow.

---

### Task 14: `Stack` primitive

**Goal:** Flexbox layout helper with `direction` and `gap` props. Replaces ad-hoc `flex flex-col gap-4` repetition.

**Files:**
- Create: `src/components/ui/stack.tsx`
- Test: `src/components/ui/stack.test.tsx`

**Step 1-2: Test + implement**

```tsx
// stack.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Stack } from '@/components/ui/stack';

describe('Stack', () => {
  it('renders column by default', () => {
    const { container } = render(<Stack gap={4}>x</Stack>);
    expect(container.firstChild).toHaveClass('flex', 'flex-col', 'gap-4');
  });
  it('honors direction=row', () => {
    const { container } = render(<Stack direction="row" gap={2}>x</Stack>);
    expect(container.firstChild).toHaveClass('flex-row', 'gap-2');
  });
});
```

```tsx
// stack.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const GAP_MAP = { 0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8' } as const;
type Gap = keyof typeof GAP_MAP;

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'col';
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

export function Stack({
  direction = 'col', gap = 4, align, justify, className, ...props
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'col' ? 'flex-col' : 'flex-row',
        GAP_MAP[gap],
        align && `items-${align}`,
        justify && `justify-${justify}`,
        className,
      )}
      {...props}
    />
  );
}
```

(Note: `items-${align}` doesn't get extracted by Tailwind's purge unless we safelist or use full class names. **Fix:** swap the dynamic strings for an explicit map or safelist `items-*` and `justify-*` in the Tailwind config. Pick the explicit map for safety:

```ts
const ALIGN_MAP = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' };
const JUSTIFY_MAP = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' };
```

Use these in the `cn(...)` call.)

**Step 3-5: Run, pass, commit**

```bash
git add src/components/ui/stack.tsx src/components/ui/stack.test.tsx
git commit -m "feat(ui): Stack layout primitive"
```

**Acceptance:** Tests pass; Tailwind generates the gap/align/justify classes (verify by inspecting `dist/assets/*.css` after build).

---

### Task 15: `Skeleton` primitive

**Goal:** Loading placeholder. Honors `prefers-reduced-motion`.

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Test: `src/components/ui/skeleton.test.tsx`

**Step 1-2: Test + implement**

```tsx
// skeleton.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('renders with width/height props', () => {
    const { container } = render(<Skeleton width={120} height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('20px');
  });
});
```

```tsx
// skeleton.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ width, height, rounded = 'md', className, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse bg-ink/10 motion-reduce:animate-none',
        rounded === 'sm' && 'rounded-sm',
        rounded === 'md' && 'rounded-md',
        rounded === 'lg' && 'rounded-lg',
        rounded === 'full' && 'rounded-full',
        className,
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}
```

**Step 3-5: Run, pass, commit**

```bash
git add src/components/ui/skeleton.tsx src/components/ui/skeleton.test.tsx
git commit -m "feat(ui): Skeleton loading primitive (motion-reduce aware)"
```

**Acceptance:** Tests pass; `motion-reduce` class disables the pulse.

---

### Task 16: `Sheet` primitive (bottom sheet, Radix Dialog + Framer Motion)

**Goal:** The most-used modal pattern in v2. Replaces every centered modal in Phase 2. Spring animation in/out, drag-to-dismiss optional (defer to Phase 2 if Radix Dialog API doesn't make it trivial).

**Files:**
- Create: `src/components/ui/sheet.tsx`
- Test: `src/components/ui/sheet.test.tsx`

**Step 1: Install Radix Dialog**

```bash
npm install @radix-ui/react-dialog
```

**Step 2: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet';

describe('Sheet', () => {
  it('opens on trigger click and shows title', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Edit Set</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByText('Edit Set')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Open'));
    expect(await screen.findByText('Edit Set')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>x</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText('x')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    // Radix unmounts on close
    expect(screen.queryByText('x')).not.toBeInTheDocument();
  });
});
```

**Step 3: Implement**

```tsx
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { motion as motionTokens } from '@/lib/motion';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = ({ className, ...props }: Dialog.DialogTitleProps) => (
  <Dialog.Title className={cn('text-title', className)} {...props} />
);

export interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  side?: 'bottom';
}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  SheetContentProps
>(({ children, className, ...props }, ref) => {
  const reduceMotion = useReducedMotion();
  return (
    <Dialog.Portal>
      <Dialog.Overlay asChild>
        <motion.div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionTokens.duration.smooth, ease: motionTokens.ease.easeOutExpo as any }}
        />
      </Dialog.Overlay>
      <Dialog.Content asChild ref={ref} {...props}>
        <motion.div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl bg-surface-raised p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-e3',
            'focus:outline-none',
            className,
          )}
          {...(reduceMotion
            ? {}
            : {
                initial: { y: '100%' },
                animate: { y: 0 },
                exit: { y: '100%' },
                transition: { duration: motionTokens.duration.slow, ease: motionTokens.ease.springSoft as any },
              })}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" aria-hidden />
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  );
});
SheetContent.displayName = 'SheetContent';
```

**Note:** Radix Dialog mounts the overlay/content conditionally based on open state. `AnimatePresence` is not required because Radix already handles unmount; we just animate in/out via `initial/animate/exit`. If you find exit animations get cut, wrap `<Dialog.Portal>` contents in `<AnimatePresence>`.

**Step 4: Run**

```bash
npm run test:run -- sheet
```

Expected: PASS. If the Escape test flakes, it's likely a userEvent timing issue — wrap the `keyboard` call in `act` and `await`.

**Step 5: Commit**

```bash
git add src/components/ui/sheet.tsx src/components/ui/sheet.test.tsx package.json package-lock.json
git commit -m "feat(ui): Sheet bottom-sheet primitive (Radix Dialog + Framer Motion)"
```

**Acceptance:** Sheet opens with spring; respects `prefers-reduced-motion`; safe-area inset honored on bottom; backdrop click + Escape both close it; tests pass.

---

## Task 17: Phase 0 wrap-up

**Goal:** Surface the Phase 0 work, prep for Phase 1, and capture a visual baseline.

**Files:**
- Modify: `CLAUDE.md` (note v2 phase status)
- Modify: `docs/plans/2026-04-23-workoutapp-v2-design.md` (mark Phase 0 ✓ in §8 sequencing table)
- Create: `docs/research/2026-04-23-phase-0-baseline.md` (one screenshot per primitive, gap research summary, what's deferred to Phase 1)

**Step 1: Update CLAUDE.md**

Append:
```markdown
## v2 status
- Phase 0 complete (foundations) — see docs/plans/2026-04-23-workoutapp-v2-design.md
- Phase 1 next: ESLint config, console.log cleanup, error boundaries, firestore/serde.ts, redux-persist
- New code lives in: src/components/ui/*, src/icons/*, src/lib/motion.ts, src/styles/tokens.css
- All UI work uses design tokens (no raw color hex), motion presets from src/lib/motion.ts, base primitives from src/components/ui/*
```

**Step 2: Mark Phase 0 done in design doc**

In `docs/plans/2026-04-23-workoutapp-v2-design.md` §8, change the Phase 0 row:
```
| **0** | 1 | UI/UX gap research, design tokens, motion, icons, calendar wireframe, Shadcn + Framer Motion installed, base primitives | ✅ Complete YYYY-MM-DD |
```

**Step 3: Create the baseline doc**

`docs/research/2026-04-23-phase-0-baseline.md`:
```markdown
# Phase 0 Baseline

**Completed:** [date]
**Tasks:** 17 (per docs/plans/2026-04-23-workoutapp-v2-phase-0.md)

## Foundations shipped
- Test infra (Vitest + RTL + jsdom)
- Path alias `@/* → src/*`
- TypeScript Tailwind config
- Design tokens (color, type, motion, elevation, touch sizing) in tailwind.config.ts + tokens.css
- Motion module (`src/lib/motion.ts`) — 3 durations × 3 easings × 3 presets
- Framer Motion installed
- Shadcn UI installed; cn utility upgraded; tokens reconciled
- Muscle-group icon set (7 icons, 3 sizes)
- Base primitives: Button, IconButton, Card, Stack, Skeleton, Sheet — all tested

## Research artifacts
- docs/research/2026-04-23-ui-gap-analysis.md
- docs/research/2026-04-23-calendar-wireframe.md (links Claude Design)

## Deferred to Phase 1
- ESLint config (none currently)
- Delete the 263 console.log calls
- Error boundaries
- firestore/serde.ts unification
- redux-persist setup with Capacitor Preferences adapter
- Kill localStorage paths in BuildPage / WorkoutPage

## Open decisions still pending (from design doc §11)
1. Tool catalog enumeration (Phase 3)
2. Apple Developer + Play Console accounts
3. Existing share-link compatibility
4. Telemetry (Sentry / Firebase Analytics) in v1?
5. Brand identity / app name
6. Dark mode toggle in v1?
7. Custom muscle-group SVGs — final source (DIY in Claude Design vs commission vs open-source)
```

**Step 4: Visual smoke**

Per project's CLAUDE.md, do **not** run `npm run dev` automatically. Tell the user:

> *Please run `npm run dev` to visually verify the primitives. Open the browser, paste this snippet into a temporary route or App.tsx, and confirm: (1) Button variants render; (2) Sheet opens and animates; (3) MuscleGroupIcon renders for each group with correct color; (4) Skeleton pulses unless prefers-reduced-motion is on.*

(Optionally include a `src/dev/Phase0Showcase.tsx` route gated by `import.meta.env.DEV` for visual review. Single ad-hoc page, not committed to main routes.)

**Step 5: Commit**

```bash
git add CLAUDE.md docs/plans/2026-04-23-workoutapp-v2-design.md docs/research/2026-04-23-phase-0-baseline.md
git commit -m "docs: Phase 0 wrap-up — foundations shipped, deferrals captured"
```

**Step 6: Push**

```bash
git push origin main
```

**Acceptance:**
- `npm run typecheck` clean
- `npm run test:run` all green; coverage ≥ 90% on `src/components/ui/*`, `src/lib/motion.ts`, `src/icons/MuscleGroup/*`
- `npm run build` succeeds
- All 17 tasks committed; commits push cleanly to GitHub
- Phase 0 baseline doc lists every deliverable + every deferred item

---

## Total task count: 17 (16 atomic + 1 wrap-up)
## Estimated effort: 5–7 focused working days
## What's not in Phase 0 (intentionally — see design doc §9)
- Capacitor scaffolding (Phase 1)
- ESLint config + console.log cleanup (Phase 1)
- Error boundaries + redux-persist (Phase 1)
- Any change to existing components (Phase 2 onward)
- AI surfaces (Phase 3)
- WorkoutPage decomposition (Phase 4)

---

## Cross-cutting rules during execution

1. **TDD strictly for primitives.** Test first, watch it fail, implement minimum to pass, commit.
2. **No new ad-hoc colors / spacings.** Every value goes through a token. If a token is missing, add it to `tailwind.config.ts` first, then use it.
3. **Every commit independently builds + tests green.** No "WIP" commits to `main`.
4. **`npm run typecheck` after every task.** Catches token-name typos.
5. **Don't touch `src/components/{home,workout,profile}` etc. in Phase 0.** Old components are frozen until Phase 2.
6. **Keep `console.log`s out of new code.** The 263 existing ones are Phase 1 cleanup; don't add to them.
