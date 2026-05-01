// Single source of truth for animation timings, easings, and presets.
//
// Durations are in SECONDS (not milliseconds) for direct compatibility with
// Framer Motion's `transition.duration` API. Easings are cubic-bezier tuples,
// also Framer Motion's native shape.
//
// IMPORTANT: keep these values in sync with `tailwind.config.ts`:
//   - theme.extend.transitionDuration       (snap=120ms, smooth=220ms, slow=380ms)
//   - theme.extend.transitionTimingFunction (spring-soft, spring-bouncy, ease-out-expo)
//
// This module is intentionally pure JS — no React, no Framer Motion imports.
// Consumers feed these literal values into Framer Motion / CSS / Tailwind.

export const motion = {
  duration: {
    snap: 0.12,
    smooth: 0.22,
    slow: 0.38,
  },
  ease: {
    springSoft: [0.32, 0.72, 0, 1] as const,
    springBouncy: [0.34, 1.56, 0.64, 1] as const,
    easeOutExpo: [0.16, 1, 0.3, 1] as const,
  },
  preset: {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
    },
    scale: {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.96 },
      transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
    },
    sheetUp: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
      transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] as const },
    },
  },
} as const;
