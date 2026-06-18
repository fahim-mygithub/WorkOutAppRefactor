import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Shadcn-style aliases (preserved from Task 3) ---
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // --- v2 semantic design tokens (Task 5) ---
        // Surface
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          subtle: 'hsl(var(--surface-subtle))',
          raised: 'hsl(var(--surface-raised))',
        },
        // Text / ink
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          muted: 'hsl(var(--ink-muted))',
          subtle: 'hsl(var(--ink-subtle))',
          inverse: 'hsl(var(--ink-inverse))',
        },
        // Brand / accent (extends preserved Shadcn alias with new `fg` key)
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          fg: 'hsl(var(--accent-fg))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Semantic state
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        // Muscle groups (drives icon backgrounds + calendar dots — Tasks 9/10)
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
        e0: 'none',
        e1: '0 1px 2px hsl(var(--shadow) / 0.06)',
        e2: '0 2px 8px hsl(var(--shadow) / 0.08)',
        e3: '0 8px 24px hsl(var(--shadow) / 0.10)',
      },
      fontFamily: {
        // Default/body voice = legible handwriting (Kalam). The whole board
        // speaks in handwriting; numbers/inputs opt back out via `font-num`.
        sans: ['Kalam', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Display / headers / labels = chalk handwriting. Kalam (bold via the
        // `.font-marker`/`.font-display` weight rule in board.css) reads clearer
        // and lighter than the old Permanent Marker while staying on-theme.
        marker: ['Kalam', 'ui-sans-serif', 'cursive'],
        display: ['Kalam', 'ui-sans-serif', 'sans-serif'],
        // Explicit legible-handwriting body voice.
        hand: ['Kalam', 'ui-sans-serif', 'cursive'],
        // Crisp numeric/data face — weight/reps/timers stay glanceable mid-set.
        // Deliberately NOT handwritten (the one skeuomorphic exception).
        num: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'caption':    ['12px', { lineHeight: '1.4',  letterSpacing: '0.01em',  fontWeight: '500' }],
        'body-sm':    ['14px', { lineHeight: '1.45',                            fontWeight: '500' }],
        'body':       ['16px', { lineHeight: '1.5',                             fontWeight: '400' }],
        'title':      ['22px', { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'display':    ['32px', { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['48px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'metric':     ['56px', { lineHeight: '1.0',  letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      spacing: {
        // 4-pt baseline already covered by Tailwind defaults; add semantic touch sizes
        'touch-min': '44px', // iOS HIG minimum
        'touch-lg': '56px',  // primary live-workout buttons
      },
      transitionDuration: {
        snap: '120ms',
        smooth: '220ms',
        slow: '380ms',
      },
      transitionTimingFunction: {
        'spring-soft': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'spring-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
