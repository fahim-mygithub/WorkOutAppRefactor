import React from 'react';
import { MuscleGroupIcon } from '@/icons/MuscleGroup';
import type { MuscleGroup } from '@/icons/MuscleGroup';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 0 Design Language Showcase
// Originally Gate 1 (token vocabulary). Extended for Gate 2 (Task 10 calendar
// wireframe) — §05 now demonstrates week view, month view, day-detail flow.
// All token values inline-HSL matching docs/research/2026-04-23-ui-gap-analysis.md §5.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  // Surfaces
  surface:        'hsl(222 47% 8%)',
  surfaceSubtle:  'hsl(222 47% 11%)',
  surfaceRaised:  'hsl(222 47% 14%)',
  // Ink
  ink:            'hsl(210 20% 98%)',
  inkMuted:       'hsl(217 19% 70%)',
  inkSubtle:      'hsl(215 16% 60%)',
  inkInverse:     'hsl(222 47% 8%)',
  // Accent + semantic
  accent:         'hsl(217 91% 65%)',
  accentFg:       'hsl(0 0% 100%)',
  success:        'hsl(142 71% 50%)',
  warning:        'hsl(38 92% 55%)',
  danger:         'hsl(0 84% 65%)',
  // Muscle groups
  push:           'hsl(4 90% 58%)',
  pull:           'hsl(198 85% 48%)',
  legs:           'hsl(35 91% 55%)',
  core:           'hsl(280 75% 60%)',
  cardio:         'hsl(345 85% 58%)',
  fullBody:       'hsl(160 60% 45%)',
  mobility:       'hsl(200 70% 55%)',
};

const HSL = {
  surface: '222 47% 8%',
  surfaceSubtle: '222 47% 11%',
  surfaceRaised: '222 47% 14%',
  ink: '210 20% 98%',
  inkMuted: '217 19% 70%',
  inkSubtle: '215 16% 60%',
  accent: '217 91% 65%',
  success: '142 71% 50%',
  warning: '38 92% 55%',
  danger: '0 84% 65%',
  push: '4 90% 58%',
  pull: '198 85% 48%',
  legs: '35 91% 55%',
  core: '280 75% 60%',
  cardio: '345 85% 58%',
  fullBody: '160 60% 45%',
  mobility: '200 70% 55%',
};

const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_SANS    = "'Inter', system-ui, sans-serif";
const FONT_MONO    = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";

// ─── Atmosphere (grain + aurora) ────────────────────────────────────────────

const grainSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>`;

// ─── Layout primitives ──────────────────────────────────────────────────────

const Page: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      background: T.surface,
      color: T.ink,
      fontFamily: FONT_SANS,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* grain */}
    <div
      style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `url("${grainSvg}")`, opacity: 0.7,
        mixBlendMode: 'overlay',
      }}
    />
    {/* top-edge atmospheric gradient */}
    <div
      style={{
        position: 'absolute', top: -200, left: '50%', width: 1200, height: 600,
        transform: 'translateX(-50%)',
        background: `radial-gradient(ellipse at center, hsl(217 91% 25% / 0.35) 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0, filter: 'blur(40px)',
      }}
    />
    <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 64px' }}>
      {children}
    </div>
  </div>
);

const Section: React.FC<{ num: string; title: string; lede?: string; children: React.ReactNode }> = ({
  num, title, lede, children,
}) => (
  <section style={{ padding: '120px 0', borderTop: `1px solid hsl(${HSL.ink} / 0.08)` }}>
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 80, marginBottom: 56 }}>
      <div>
        <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 16, letterSpacing: '0.12em' }}>
          § {num}
        </div>
        <h2 style={{
          fontFamily: FONT_DISPLAY, fontSize: 40, fontWeight: 600, lineHeight: 1.05,
          letterSpacing: '-0.02em', margin: 0, marginBottom: 12,
        }}>
          {title}
        </h2>
        {lede && (
          <p style={{
            fontSize: 15, lineHeight: 1.55, color: T.inkMuted, margin: 0, maxWidth: 320,
          }}>
            {lede}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  </section>
);

const mono10: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, textTransform: 'uppercase' };
const mono11: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 11, fontWeight: 400 };
const mono12: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 12, fontWeight: 400 };

// ─── Hero ───────────────────────────────────────────────────────────────────

const Hero: React.FC = () => (
  <header style={{ paddingTop: 96, paddingBottom: 120 }}>
    <div style={{ ...mono10, color: T.accent, marginBottom: 32, letterSpacing: '0.16em' }}>
      WORKOUTAPP / V2 / PHASE 0 — GATE 1 REVIEW
    </div>
    <h1 style={{
      fontFamily: FONT_DISPLAY, fontSize: 'clamp(72px, 9vw, 128px)', fontWeight: 700,
      lineHeight: 0.95, letterSpacing: '-0.04em', margin: 0,
    }}>
      Design{' '}
      <span style={{ fontStyle: 'italic', fontWeight: 600, color: T.inkMuted }}>
        language
      </span>
      <br />
      proposal.
    </h1>
    <p style={{
      fontSize: 18, lineHeight: 1.5, color: T.inkMuted, marginTop: 40, maxWidth: 640,
    }}>
      A quiet system designed to disappear during a workout and reward the rest of the time.
      Six surface tokens, seven muscle hues, three motion presets, a calendar that finally reads
      at a glance. Approve once and the rest of Phase 0 ships against these values.
    </p>

    {/* Metadata strip */}
    <div style={{
      marginTop: 56,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
      borderTop: `1px solid hsl(${HSL.ink} / 0.12)`, paddingTop: 24,
    }}>
      {[
        ['Date',     '2026-05-01'],
        ['Source',   'docs/research/2026-04-23-ui-gap-analysis.md'],
        ['Phase',    '0 of 6'],
        ['Status',   'Awaiting approval'],
      ].map(([label, value]) => (
        <div key={label}>
          <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 8 }}>{label}</div>
          <div style={{ ...mono12, color: T.ink, wordBreak: 'break-word' }}>{value}</div>
        </div>
      ))}
    </div>
  </header>
);

// ─── §02 Color ──────────────────────────────────────────────────────────────

const Swatch: React.FC<{ name: string; hsl: string; color: string; fg?: string }> = ({
  name, hsl, color, fg = T.ink,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div
      style={{
        height: 88, borderRadius: 12, background: color,
        border: `1px solid hsl(${HSL.ink} / 0.1)`,
        display: 'flex', alignItems: 'flex-end', padding: 12, color: fg,
        fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600,
      }}
    >
      {name}
    </div>
    <div style={{ ...mono11, color: T.inkSubtle }}>{hsl}</div>
  </div>
);

const SwatchGroup: React.FC<{ title: string; cols: number; children: React.ReactNode }> = ({
  title, cols, children,
}) => (
  <div style={{ marginBottom: 40 }}>
    <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 16 }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
      {children}
    </div>
  </div>
);

const ColorSection: React.FC = () => (
  <Section
    num="02"
    title="Color tokens."
    lede="HSL triplets, dark mode shown. Light mode in tokens.css. Muscle palette is the single largest visual change from v1."
  >
    <SwatchGroup title="Surfaces" cols={3}>
      <Swatch name="surface"        hsl={HSL.surface}       color={T.surface} />
      <Swatch name="surface-subtle" hsl={HSL.surfaceSubtle} color={T.surfaceSubtle} />
      <Swatch name="surface-raised" hsl={HSL.surfaceRaised} color={T.surfaceRaised} />
    </SwatchGroup>

    <SwatchGroup title="Ink" cols={3}>
      <Swatch name="ink"        hsl={HSL.ink}       color={T.ink}        fg={T.inkInverse} />
      <Swatch name="ink-muted"  hsl={HSL.inkMuted}  color={T.inkMuted}   fg={T.inkInverse} />
      <Swatch name="ink-subtle" hsl={HSL.inkSubtle} color={T.inkSubtle}  fg={T.inkInverse} />
    </SwatchGroup>

    <SwatchGroup title="Accent + semantic" cols={4}>
      <Swatch name="accent"  hsl={HSL.accent}  color={T.accent}  fg={T.accentFg} />
      <Swatch name="success" hsl={HSL.success} color={T.success} fg={T.inkInverse} />
      <Swatch name="warning" hsl={HSL.warning} color={T.warning} fg={T.inkInverse} />
      <Swatch name="danger"  hsl={HSL.danger}  color={T.danger}  fg={T.inkInverse} />
    </SwatchGroup>

    <SwatchGroup title="Muscle groups (calendar + iconography)" cols={7}>
      <Swatch name="push"      hsl={HSL.push}     color={T.push}     fg={T.ink} />
      <Swatch name="pull"      hsl={HSL.pull}     color={T.pull}     fg={T.ink} />
      <Swatch name="legs"      hsl={HSL.legs}     color={T.legs}     fg={T.inkInverse} />
      <Swatch name="core"      hsl={HSL.core}     color={T.core}     fg={T.ink} />
      <Swatch name="cardio"    hsl={HSL.cardio}   color={T.cardio}   fg={T.ink} />
      <Swatch name="full-body" hsl={HSL.fullBody} color={T.fullBody} fg={T.ink} />
      <Swatch name="mobility"  hsl={HSL.mobility} color={T.mobility} fg={T.ink} />
    </SwatchGroup>

    <div style={{
      marginTop: 24, padding: '16px 20px', borderRadius: 12,
      background: `hsl(${HSL.accent} / 0.06)`,
      border: `1px solid hsl(${HSL.accent} / 0.2)`,
      ...mono11, color: T.inkMuted, lineHeight: 1.6,
    }}>
      DEVIATIONS FROM PLACEHOLDER → <span style={{ color: T.ink }}>--muscle-pull</span> shifted to cyan
      to avoid colliding with --accent. <span style={{ color: T.ink }}>--ink-muted</span> dropped from
      73% → 70% to clear WCAG AA on surface-raised.
    </div>
  </Section>
);

// ─── §03 Typography ─────────────────────────────────────────────────────────

const TypeRow: React.FC<{
  sample: string; size: number; lh: number; tracking?: string; weight?: number;
  family?: string; spec: string; tabular?: boolean;
}> = ({ sample, size, lh, tracking = '0', weight = 400, family = FONT_DISPLAY, spec, tabular }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1fr 220px', gap: 32, alignItems: 'baseline',
    paddingBottom: 24, marginBottom: 24,
    borderBottom: `1px solid hsl(${HSL.ink} / 0.08)`,
  }}>
    <div style={{
      fontFamily: family, fontSize: size, fontWeight: weight,
      lineHeight: lh, letterSpacing: tracking,
      fontVariantNumeric: tabular ? 'tabular-nums' : 'normal',
      color: T.ink,
    }}>
      {sample}
    </div>
    <div style={{ ...mono11, color: T.inkSubtle, lineHeight: 1.7 }}>
      {spec.split('\n').map((line, i) => <div key={i}>{line}</div>)}
    </div>
  </div>
);

const TypeSection: React.FC = () => (
  <Section
    num="03"
    title="Type scale."
    lede="Inter Tight for display, Inter for body, JetBrains Mono for technical labels. Apple HIG: minimum weight 500. Tabular numerals for live-workout metrics."
  >
    <TypeRow sample="315 × 5"        size={56} lh={1.0}  tracking="-0.02em" weight={700}
             spec={'metric / 56px / 700\nlh 1.0 / -0.02em\ntabular-nums'} tabular />
    <TypeRow sample="Push, Day 12."   size={48} lh={1.05} tracking="-0.02em" weight={700}
             spec={'display-lg / 48px / 700\nlh 1.05 / -0.02em'} />
    <TypeRow sample="This week."      size={32} lh={1.1}  tracking="-0.02em" weight={700}
             spec={'display / 32px / 700\nlh 1.1 / -0.02em'} />
    <TypeRow sample="Today's session" size={22} lh={1.2}  tracking="-0.01em" weight={600}
             spec={'title / 22px / 600\nlh 1.2 / -0.01em'} />
    <TypeRow sample="Bench press, three sets, six reps. Last week you hit 295 for five." size={16} lh={1.5} weight={400} family={FONT_SANS}
             spec={'body / 16px / 400\nlh 1.5\nInter'} />
    <TypeRow sample="Rest 90s." size={14} lh={1.45} weight={500} family={FONT_SANS}
             spec={'body-sm / 14px / 500\nlh 1.45'} />
    <TypeRow sample="ALL SETS COMPLETE" size={12} lh={1.4} tracking="0.01em" weight={500}
             family={FONT_MONO}
             spec={'caption / 12px / 500\nlh 1.4 / 0.01em'} />
  </Section>
);

// ─── §04 Radius + Elevation ─────────────────────────────────────────────────

const RadiusElevation: React.FC = () => (
  <Section
    num="04"
    title="Radius, elevation."
    lede="Six radius stops, four elevation stops. Both are pure visual hierarchy tools — every component pulls from these scales."
  >
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
      {/* Radius */}
      <div>
        <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 20 }}>RADIUS</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[
            ['xs', 4], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 24], ['full', 40],
          ].map(([name, r]) => (
            <div key={name as string} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                width: 80, height: 80, background: T.surfaceRaised,
                borderRadius: name === 'full' ? '9999px' : `${r}px`,
                border: `1px solid hsl(${HSL.ink} / 0.1)`,
              }} />
              <div style={{ ...mono11, color: T.inkSubtle, textAlign: 'center' }}>{name}</div>
              <div style={{ ...mono10, color: T.inkSubtle, textAlign: 'center' }}>
                {name === 'full' ? '∞' : `${r}px`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Elevation */}
      <div>
        <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 20 }}>ELEVATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['e0', 'none'],
            ['e1', `0 1px 2px hsl(${HSL.surface} / 0.4)`],
            ['e2', `0 4px 12px hsl(${HSL.surface} / 0.5)`],
            ['e3', `0 12px 32px hsl(${HSL.surface} / 0.6)`],
          ].map(([name, shadow]) => (
            <div key={name as string} style={{
              padding: 24, height: 100,
              background: T.surfaceRaised, borderRadius: 12,
              boxShadow: shadow as string,
              border: `1px solid hsl(${HSL.ink} / 0.06)`,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ ...mono10, color: T.inkSubtle }}>{name}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600 }}>
                Card surface
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Section>
);

// ─── Theme tokens for §05 light/dark side-by-side ──────────────────────────

type Theme = {
  surface: string; surfaceSubtle: string; surfaceRaised: string;
  ink: string; inkMuted: string; inkSubtle: string;
  accent: string; accentHsl: string;
  inkHsl: string; inkSubtleHsl: string;
  success: string; danger: string;
  label: 'Light' | 'Dark';
};

const darkTheme: Theme = {
  surface: T.surface, surfaceSubtle: T.surfaceSubtle, surfaceRaised: T.surfaceRaised,
  ink: T.ink, inkMuted: T.inkMuted, inkSubtle: T.inkSubtle,
  accent: T.accent, accentHsl: HSL.accent,
  inkHsl: HSL.ink, inkSubtleHsl: HSL.inkSubtle,
  success: T.success, danger: T.danger,
  label: 'Dark',
};

const lightTheme: Theme = {
  surface: 'hsl(0 0% 100%)', surfaceSubtle: 'hsl(0 0% 98%)', surfaceRaised: 'hsl(0 0% 100%)',
  ink: 'hsl(222 47% 11%)', inkMuted: 'hsl(217 19% 35%)', inkSubtle: 'hsl(215 16% 47%)',
  accent: 'hsl(217 91% 60%)', accentHsl: '217 91% 60%',
  inkHsl: '222 47% 11%', inkSubtleHsl: '215 16% 47%',
  success: 'hsl(142 71% 45%)', danger: 'hsl(0 84% 60%)',
  label: 'Light',
};

// ─── §05 Calendar (hero demo) ───────────────────────────────────────────────

type DayState = 'completed' | 'today' | 'upcoming' | 'rest' | 'missed';

const dayCells: { day: string; date: number; state: DayState; group?: string; intensity?: number }[] = [
  { day: 'M', date: 21, state: 'completed', group: 'push',   intensity: 0.75 },
  { day: 'T', date: 22, state: 'completed', group: 'pull',   intensity: 1.0  },
  { day: 'W', date: 23, state: 'today',     group: 'legs',   intensity: 0.5  },
  { day: 'T', date: 24, state: 'upcoming',  group: 'core',   intensity: 0.5  },
  { day: 'F', date: 25, state: 'rest' },
  { day: 'S', date: 26, state: 'missed',    group: 'cardio' },
  { day: 'S', date: 27, state: 'upcoming',  group: 'full-body', intensity: 1.0 },
];

const groupColor = (g?: string): string => {
  switch (g) {
    case 'push': return T.push;
    case 'pull': return T.pull;
    case 'legs': return T.legs;
    case 'core': return T.core;
    case 'cardio': return T.cardio;
    case 'full-body': return T.fullBody;
    case 'mobility': return T.mobility;
    default: return T.inkSubtle;
  }
};

const DayCell: React.FC<typeof dayCells[number] & { theme: Theme }> = ({
  day, date, state, group, intensity, theme,
}) => {
  const color = groupColor(group);
  const isToday = state === 'today';
  const isCompleted = state === 'completed';
  const isUpcoming = state === 'upcoming';
  const isMissed = state === 'missed';
  const isRest = state === 'rest';

  // Per inspiration brief: today = filled accent tint + accent date label,
  // no border. Completed = inline accent dot under the date, not an
  // overhanging badge. Three-channel ceiling per cell (date / glyph / state cue).
  const dateColor = isToday ? theme.accent : theme.inkSubtle;

  return (
    <div
      style={{
        position: 'relative',
        background: isToday
          ? `hsl(${theme.accentHsl} / 0.16)`
          : theme.surfaceRaised,
        border: `1px solid hsl(${theme.inkHsl} / ${isToday ? 0 : 0.08})`,
        borderRadius: 12,
        aspectRatio: '1 / 1.25',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 8px', gap: 6,
      }}
    >
      {/* Date label centered top + completed dot inline beneath */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ ...mono11, color: dateColor, fontWeight: isToday ? 600 : 400 }}>
          {day} {date}
        </div>
        {isCompleted && (
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: theme.success,
          }} />
        )}
      </div>

      {/* Icon area */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, opacity: isUpcoming ? 0.6 : isMissed ? 0.45 : 1,
        position: 'relative', minHeight: 32,
      }}>
        {isRest ? (
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: `hsl(${theme.inkSubtleHsl} / 0.4)`,
          }} />
        ) : group ? (
          <MuscleGroupIcon group={group as MuscleGroup} size={28} />
        ) : null}

        {isMissed && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.danger, opacity: 0.9,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="19" x2="19" y2="5" />
            </svg>
          </div>
        )}
      </div>

      {/* Intensity bar — only on completed days; serves as the secondary metric */}
      {isCompleted && intensity != null ? (
        <div style={{
          width: '70%', height: 2, background: `hsl(${theme.inkHsl} / 0.1)`,
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${intensity * 100}%`, height: '100%',
            background: color, opacity: 0.6,
          }} />
        </div>
      ) : (
        <div style={{ height: 2 }} aria-hidden />
      )}
    </div>
  );
};

// ─── Month-grid compact cell ────────────────────────────────────────────────

type MonthCellState = DayState | 'outside';
type MonthCellData = { date: number; state: MonthCellState; group?: string };

const MonthCell: React.FC<MonthCellData & { theme: Theme }> = ({ date, state, group, theme }) => {
  const color = groupColor(group);
  const isToday = state === 'today';
  const isCompleted = state === 'completed';
  const isUpcoming = state === 'upcoming';
  const isMissed = state === 'missed';
  const isRest = state === 'rest';
  const isOutside = state === 'outside';

  // Per inspiration brief: month cells are perfect square, gap 4, no
  // overhanging badge. Today filled accent tint, no border.
  const dateColor = isToday ? theme.accent : theme.inkSubtle;

  return (
    <div style={{
      position: 'relative',
      background: isOutside ? 'transparent'
        : isToday ? `hsl(${theme.accentHsl} / 0.16)`
        : `hsl(${theme.inkHsl} / 0.02)`,
      border: `1px solid hsl(${theme.inkHsl} / ${isToday || isOutside ? 0 : 0.05})`,
      borderRadius: 8,
      aspectRatio: '1 / 1',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 2px', gap: 1,
      opacity: isOutside ? 0.25 : 1,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <div style={{ ...mono10, fontSize: 9, color: dateColor, fontWeight: isToday ? 600 : 400 }}>
          {date}
        </div>
        {isCompleted && (
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: theme.success }} />
        )}
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, opacity: isUpcoming ? 0.55 : isMissed ? 0.4 : 1,
        position: 'relative', minHeight: 18,
      }}>
        {isOutside ? null
          : isRest ? <div style={{ width: 4, height: 4, borderRadius: '50%', background: `hsl(${theme.inkSubtleHsl} / 0.4)` }} />
          : group ? <MuscleGroupIcon group={group as MuscleGroup} size={18} />
          : null}
        {isMissed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.danger, opacity: 0.8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="19" x2="19" y2="5" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ height: 2 }} aria-hidden />
    </div>
  );
};

// ─── Week strip (parameterized by theme) ────────────────────────────────────

const WeekStrip: React.FC<{ theme: Theme }> = ({ theme }) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 24,
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600,
        letterSpacing: '-0.01em', color: theme.ink,
      }}>
        This week
      </div>
      <div style={{ ...mono10, color: theme.inkSubtle }}>AUG 21–27</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {dayCells.map((c) => <DayCell key={c.date} {...c} theme={theme} />)}
    </div>
  </div>
);

// ─── Month grid data + component ────────────────────────────────────────────

const monthGridData: MonthCellData[] = [
  // Week 1 (partial — outside-month leading)
  { date: 30, state: 'outside' }, { date: 31, state: 'outside' },
  { date: 1, state: 'completed', group: 'push' },
  { date: 2, state: 'completed', group: 'pull' },
  { date: 3, state: 'rest' },
  { date: 4, state: 'completed', group: 'legs' },
  { date: 5, state: 'completed', group: 'cardio' },
  // Week 2
  { date: 6, state: 'rest' },
  { date: 7, state: 'completed', group: 'push' },
  { date: 8, state: 'completed', group: 'pull' },
  { date: 9, state: 'completed', group: 'core' },
  { date: 10, state: 'rest' },
  { date: 11, state: 'missed', group: 'legs' },
  { date: 12, state: 'completed', group: 'mobility' },
  // Week 3
  { date: 13, state: 'rest' },
  { date: 14, state: 'completed', group: 'push' },
  { date: 15, state: 'completed', group: 'pull' },
  { date: 16, state: 'completed', group: 'legs' },
  { date: 17, state: 'rest' },
  { date: 18, state: 'completed', group: 'full-body' },
  { date: 19, state: 'completed', group: 'cardio' },
  // Week 4 (current)
  { date: 20, state: 'rest' },
  { date: 21, state: 'completed', group: 'push' },
  { date: 22, state: 'completed', group: 'pull' },
  { date: 23, state: 'today', group: 'legs' },
  { date: 24, state: 'upcoming', group: 'core' },
  { date: 25, state: 'rest' },
  { date: 26, state: 'upcoming', group: 'cardio' },
  // Week 5 (future)
  { date: 27, state: 'upcoming', group: 'full-body' },
  { date: 28, state: 'rest' },
  { date: 29, state: 'upcoming', group: 'push' },
  { date: 30, state: 'upcoming', group: 'pull' },
  { date: 31, state: 'upcoming', group: 'legs' },
  { date: 1, state: 'outside' }, { date: 2, state: 'outside' },
];

const MonthGrid: React.FC<{ theme: Theme }> = ({ theme }) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 24,
    }}>
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600,
        letterSpacing: '-0.01em', color: theme.ink,
      }}>
        August 2026
      </div>
      <div style={{ ...mono10, color: theme.inkSubtle }}>18 / 23 PLANNED</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <div key={i} style={{ ...mono10, color: theme.inkSubtle, textAlign: 'center' }}>{d}</div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {monthGridData.map((cell, i) => <MonthCell key={i} {...cell} theme={theme} />)}
    </div>
  </div>
);

// ─── Day-detail flow (phone frame with calendar + sheet) ────────────────────

const DayDetailFlow: React.FC = () => (
  <div style={{
    background: T.surfaceSubtle,
    border: `1px solid hsl(${HSL.ink} / 0.06)`,
    borderRadius: 16, padding: 32,
    display: 'grid', gridTemplateColumns: '380px 1fr', gap: 48, alignItems: 'start',
  }}>
    <div style={{
      width: 380, height: 720,
      background: T.surface,
      border: `1px solid hsl(${HSL.ink} / 0.15)`,
      borderRadius: 36, padding: 8,
      boxShadow: `0 24px 64px hsl(${HSL.surface} / 0.6)`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Status bar */}
      <div style={{
        height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', ...mono10, color: T.inkMuted,
      }}>
        <span>9:41</span>
        <span>●●●●●</span>
      </div>
      {/* Calendar background (dimmed) */}
      <div style={{
        position: 'absolute', inset: '40px 8px 8px 8px',
        background: T.surface, borderRadius: 28, padding: 16,
      }}>
        <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 8 }}>AUGUST</div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4,
        }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} style={{ ...mono10, fontSize: 9, color: T.inkSubtle, textAlign: 'center' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {monthGridData.slice(0, 21).map((cell, i) => <MonthCell key={i} {...cell} theme={darkTheme} />)}
        </div>
      </div>
      {/* Dim overlay */}
      <div style={{
        position: 'absolute', inset: '40px 8px 8px 8px', borderRadius: 28,
        background: `hsl(${HSL.surface} / 0.55)`, backdropFilter: 'blur(3px)',
      }} />
      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 8, right: 8, bottom: 8,
        background: T.surfaceRaised,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        padding: '12px 24px 32px',
        boxShadow: `0 -12px 48px hsl(${HSL.surface} / 0.8)`,
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: `hsl(${HSL.ink} / 0.15)`, margin: '0 auto 20px',
        }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...mono10, color: T.inkSubtle }}>WED, AUG 23</div>
          <div style={{ ...mono10, color: T.accent }}>TODAY</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ color: T.legs, display: 'flex' }}>
            <MuscleGroupIcon group="legs" size={32} />
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700,
            letterSpacing: '-0.01em', color: T.ink,
          }}>
            Legs, Day 12
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {[
            { name: 'Back squat',           sets: '4 × 5',  done: true  },
            { name: 'Romanian deadlift',    sets: '3 × 8',  done: true  },
            { name: 'Bulgarian split sq.',  sets: '3 × 10', done: false },
            { name: 'Calf raise',           sets: '3 × 15', done: false },
          ].map((ex) => (
            <div key={ex.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8,
              background: ex.done ? `hsl(${HSL.success} / 0.08)` : T.surfaceSubtle,
              border: `1px solid hsl(${HSL.ink} / 0.06)`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, opacity: ex.done ? 0.7 : 1 }}>
                {ex.name}
              </div>
              <div style={{ ...mono11, color: ex.done ? T.success : T.inkSubtle }}>
                {ex.sets} {ex.done && '✓'}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: T.surfaceSubtle,
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16,
        }}>
          <div style={{ ...mono10, color: T.inkSubtle }}>VOLUME</div>
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700,
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: T.ink,
          }}>
            7,420 lbs
          </div>
        </div>
        <button style={{
          width: '100%', height: 48,
          background: T.accent, color: T.accentFg,
          borderRadius: 12, border: 'none',
          fontFamily: FONT_SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          Edit session
        </button>
      </div>
    </div>
    <div style={{ paddingTop: 16 }}>
      {[
        ['DAY-DETAIL TRIGGER', 'Tap any non-rest day cell. Rest cells are non-interactive.'],
        ['SHEET CONTENT',     'Date · muscle icon + session name · exercise list with set counts and completion checks · total volume · single primary CTA.'],
        ['CTA BEHAVIOR',      'Today: "Mark complete" / "Start session". Past+done: "Edit session". Past+missed: "Reschedule". Future: "Edit plan".'],
        ['DISMISSAL',         'Backdrop tap, Escape, swipe-down on drag handle. No X button — drag handle replaces it.'],
      ].map(([label, body]) => (
        <div key={label} style={{
          paddingBottom: 20, marginBottom: 20,
          borderBottom: `1px solid hsl(${HSL.ink} / 0.08)`,
        }}>
          <div style={{ ...mono10, color: T.accent, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 15, color: T.inkMuted, lineHeight: 1.55, maxWidth: 460 }}>
            {body}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── §05 Sub-section helpers ────────────────────────────────────────────────

const SubHeading: React.FC<{ label: string; title: string; lede?: string }> = ({
  label, title, lede,
}) => (
  <div style={{ marginBottom: 24, marginTop: 64 }}>
    <div style={{ ...mono10, color: T.accent, marginBottom: 8, letterSpacing: '0.12em' }}>
      {label}
    </div>
    <h3 style={{
      fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em',
      margin: 0, marginBottom: lede ? 8 : 0, color: T.ink,
    }}>
      {title}
    </h3>
    {lede && (
      <p style={{ fontSize: 15, lineHeight: 1.55, color: T.inkMuted, margin: 0, maxWidth: 720 }}>
        {lede}
      </p>
    )}
  </div>
);

const ThemedFrame: React.FC<{ theme: Theme; children: React.ReactNode }> = ({
  theme, children,
}) => (
  <div style={{
    background: theme.surface,
    border: `1px solid hsl(${theme.inkHsl} / 0.1)`,
    borderRadius: 16, padding: 24,
  }}>
    <div style={{
      ...mono10, color: theme.inkSubtle, marginBottom: 16, letterSpacing: '0.12em',
    }}>
      {theme.label.toUpperCase()}
    </div>
    {children}
  </div>
);

const Legend: React.FC = () => (
  <div style={{
    background: T.surfaceSubtle,
    border: `1px solid hsl(${HSL.ink} / 0.06)`,
    borderRadius: 12, padding: 24,
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, marginTop: 24,
  }}>
    {[
      { state: 'Completed', desc: 'Full color + dot under date', group: 'push' as const },
      { state: 'Today',     desc: 'Filled accent tint',          group: 'legs' as const },
      { state: 'Upcoming',  desc: '60% opacity glyph',           group: 'core' as const },
      { state: 'Rest',      desc: 'Subtle dot only',             group: undefined },
      { state: 'Missed',    desc: 'Dim + slash + danger',        group: 'cardio' as const },
    ].map((row) => {
      const color = groupColor(row.group);
      const isToday = row.state === 'Today';
      const isCompleted = row.state === 'Completed';
      const isMissed = row.state === 'Missed';
      const isUpcoming = row.state === 'Upcoming';
      return (
        <div key={row.state} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            position: 'relative',
            width: 64, height: 80, borderRadius: 12,
            background: isToday ? `hsl(${HSL.accent} / 0.16)` : T.surfaceRaised,
            border: `1px solid hsl(${HSL.ink} / ${isToday ? 0 : 0.06})`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 8px', gap: 4,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ ...mono11, color: isToday ? T.accent : T.inkSubtle, fontWeight: isToday ? 600 : 400 }}>
                W 23
              </div>
              {isCompleted && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.success }} />
              )}
            </div>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, opacity: isUpcoming ? 0.6 : isMissed ? 0.45 : 1,
              position: 'relative', minHeight: 28,
            }}>
              {row.group ? <MuscleGroupIcon group={row.group} size={24} /> : (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: `hsl(${HSL.inkSubtle} / 0.4)`,
                }} />
              )}
              {isMissed && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: T.danger, opacity: 0.9,
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="5" y1="19" x2="19" y2="5" />
                  </svg>
                </div>
              )}
            </div>
            <div style={{ height: 2 }} aria-hidden />
          </div>
          <div>
            <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 4 }}>
              {row.state.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.4 }}>
              {row.desc}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const CalendarSection: React.FC = () => (
  <Section
    num="05"
    title="Calendar — wireframe."
    lede="Task 10 / Gate 2. Week view default, month one tap deeper, day-detail in a bottom sheet. Real muscle-group icons (Task 9). Light + dark side-by-side."
  >
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: '-40px -80px',
        background: `radial-gradient(ellipse at 30% 50%, hsl(${HSL.pull} / 0.15), transparent 60%),
                     radial-gradient(ellipse at 80% 50%, hsl(${HSL.legs} / 0.12), transparent 60%)`,
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <SubHeading
          label="05.1 — WEEK VIEW (DEFAULT)"
          title="Glance, then plan."
          lede="The week strip is what greets the user on Home. One muscle glyph per day, color = group. Today is filled accent. Dark first (the app default), light below."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <ThemedFrame theme={darkTheme}><WeekStrip theme={darkTheme} /></ThemedFrame>
          <ThemedFrame theme={lightTheme}><WeekStrip theme={lightTheme} /></ThemedFrame>
        </div>
        <Legend />

        <SubHeading
          label="05.2 — MONTH VIEW"
          title="One tap deeper for planning."
          lede="Tap the week-header date range to expand to a 5-week month grid. Same vocabulary at half scale. For when the user is planning a training block, not running today."
        />
        <ThemedFrame theme={darkTheme}><MonthGrid theme={darkTheme} /></ThemedFrame>

        <SubHeading
          label="05.3 — DAY-DETAIL FLOW"
          title="Tap a day, sheet up."
          lede="Day-detail uses the v2 bottom-sheet primitive (Task 16) — replaces v1's centered-modal pattern. Mock shows the resting state: backdrop dimmed, sheet docked, drag-handle visible."
        />
        <DayDetailFlow />

        <div style={{ ...mono11, color: T.inkSubtle, marginTop: 24, lineHeight: 1.6 }}>
          NOTE → muscle-group glyphs from Tabler Icons (MIT). Wireframe shows
          static states; spring motion (slow / springSoft) lands with Task 16 Sheet.
        </div>
      </div>
    </div>
  </Section>
);

// ─── §06 Bottom sheet ───────────────────────────────────────────────────────

const SheetSection: React.FC = () => (
  <Section
    num="06"
    title="Bottom sheet."
    lede="The new default modal pattern. Slides up on slow + springSoft. Replaces every centered overlay in v1."
  >
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 64, alignItems: 'start' }}>
      {/* Phone frame */}
      <div style={{
        width: 380, height: 720,
        background: T.surface,
        border: `1px solid hsl(${HSL.ink} / 0.15)`,
        borderRadius: 36, padding: 8,
        boxShadow: `0 24px 64px hsl(${HSL.surface} / 0.6)`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* status bar */}
        <div style={{
          height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', ...mono10, color: T.inkMuted,
        }}>
          <span>9:41</span>
          <span>●●●●●</span>
        </div>

        {/* fake app body (dimmed) */}
        <div style={{
          position: 'absolute', inset: '40px 8px 8px 8px',
          background: T.surface, borderRadius: 28,
          opacity: 0.4, padding: 24,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
            Push, Day 12
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 64, borderRadius: 12, background: T.surfaceRaised, marginBottom: 12,
            }} />
          ))}
        </div>

        {/* dim overlay */}
        <div style={{
          position: 'absolute', inset: '40px 8px 8px 8px', borderRadius: 28,
          background: `hsl(${HSL.surface} / 0.5)`, backdropFilter: 'blur(4px)',
        }} />

        {/* sheet */}
        <div style={{
          position: 'absolute', left: 8, right: 8, bottom: 8,
          background: T.surfaceRaised,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
          padding: '12px 24px 32px',
          boxShadow: `0 -12px 48px hsl(${HSL.surface} / 0.8)`,
        }}>
          {/* drag handle */}
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: `hsl(${HSL.ink} / 0.15)`,
            margin: '0 auto 20px',
          }} />
          <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 8 }}>
            EDIT SET
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, marginBottom: 4,
          }}>
            Bench press
          </div>
          <div style={{ fontSize: 14, color: T.inkMuted, marginBottom: 24 }}>
            Set 3 of 4
          </div>

          {/* metric row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[['WEIGHT', '225'], ['REPS', '5'], ['RPE', '8']].map(([label, val]) => (
              <div key={label} style={{
                flex: 1, padding: 16, borderRadius: 12,
                background: T.surfaceSubtle,
                border: `1px solid hsl(${HSL.ink} / 0.08)`,
              }}>
                <div style={{ ...mono10, color: T.inkSubtle, marginBottom: 6 }}>{label}</div>
                <div style={{
                  fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700,
                  letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
                }}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button style={{
            width: '100%', height: 56,
            background: T.accent, color: T.accentFg,
            borderRadius: 12, border: 'none',
            fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600,
            cursor: 'pointer',
          }}>
            Mark complete
          </button>
        </div>
      </div>

      {/* Notes */}
      <div style={{ paddingTop: 40 }}>
        {[
          ['DEFAULT IN V2',
           'Every "open this thing" interaction is a sheet. Centered modals reserved for confirm/destructive prompts only.'],
          ['DRAG HANDLE',
           '40 × 4 px, ink/15. Communicates dismissibility without decorating the surface.'],
          ['SAFE-AREA HONORED',
           'Bottom padding uses env(safe-area-inset-bottom) so iOS home-indicator never overlaps the CTA.'],
          ['MOTION',
           'Enter: y 100% → 0 over slow / springSoft. Exit: reversed. Reduced-motion: instant snap.'],
        ].map(([label, body]) => (
          <div key={label} style={{
            paddingBottom: 24, marginBottom: 24,
            borderBottom: `1px solid hsl(${HSL.ink} / 0.08)`,
          }}>
            <div style={{ ...mono10, color: T.accent, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 16, color: T.inkMuted, lineHeight: 1.55, maxWidth: 480 }}>
              {body}
            </div>
          </div>
        ))}
      </div>
    </div>
  </Section>
);

// ─── §07 Motion ─────────────────────────────────────────────────────────────

const MotionSection: React.FC = () => (
  <Section
    num="07"
    title="Motion presets."
    lede="Three durations × three easings × three composed presets. Every motion in the app pulls from these. No more transition-all duration-300."
  >
    <style>{`
      @keyframes loopSnap {
        0%, 5%   { transform: translateX(0);    background: hsl(${HSL.surfaceRaised}); }
        50%, 60% { transform: translateX(180px); background: hsl(${HSL.accent}); }
        100%     { transform: translateX(0);    background: hsl(${HSL.surfaceRaised}); }
      }
      .motion-snap   { animation: loopSnap 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
      .motion-smooth { animation: loopSnap 3.0s cubic-bezier(0.32, 0.72, 0, 1) infinite; }
      .motion-slow   { animation: loopSnap 3.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
    `}</style>

    {[
      { name: 'snap',   ms: 120, ease: 'easeOutExpo',   bezier: '0.16, 1, 0.3, 1',
        use: 'Taps, toggles, micro-feedback.', cls: 'motion-snap' },
      { name: 'smooth', ms: 220, ease: 'springSoft',    bezier: '0.32, 0.72, 0, 1',
        use: 'Default UI transitions, hover, layout shift.', cls: 'motion-smooth' },
      { name: 'slow',   ms: 380, ease: 'springBouncy',  bezier: '0.34, 1.56, 0.64, 1',
        use: 'Sheet enter, large-surface reveal, PR celebration.', cls: 'motion-slow' },
    ].map((m) => (
      <div key={m.name} style={{
        display: 'grid', gridTemplateColumns: '120px 280px 1fr', gap: 32, alignItems: 'center',
        padding: '32px 0', borderBottom: `1px solid hsl(${HSL.ink} / 0.08)`,
      }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {m.name}
          </div>
          <div style={{ ...mono11, color: T.inkSubtle, marginTop: 4 }}>{m.ms}ms</div>
        </div>

        {/* Live demo */}
        <div style={{
          height: 56, background: `hsl(${HSL.ink} / 0.04)`, borderRadius: 12,
          padding: 12, position: 'relative', overflow: 'hidden',
        }}>
          <div className={m.cls} style={{
            width: 32, height: 32, borderRadius: 8, background: T.surfaceRaised,
          }} />
        </div>

        <div>
          <div style={{ ...mono11, color: T.inkSubtle, marginBottom: 8 }}>
            {m.ease} → cubic-bezier({m.bezier})
          </div>
          <div style={{ fontSize: 15, color: T.inkMuted, lineHeight: 1.5 }}>
            {m.use}
          </div>
        </div>
      </div>
    ))}

    <div style={{
      marginTop: 32, padding: '20px 24px', borderRadius: 12,
      background: `hsl(${HSL.warning} / 0.05)`,
      border: `1px solid hsl(${HSL.warning} / 0.2)`,
      ...mono11, color: T.inkMuted, lineHeight: 1.6,
    }}>
      RULES → never animate during a live set unless the rest timer demands it.
      prefers-reduced-motion respected on every preset (instant fallback).
      no transition-all — always specify the property.
    </div>
  </Section>
);

// ─── Footer ─────────────────────────────────────────────────────────────────

const Footer: React.FC = () => (
  <footer style={{
    padding: '120px 0 80px', borderTop: `1px solid hsl(${HSL.ink} / 0.08)`,
  }}>
    <div style={{ maxWidth: 720 }}>
      <div style={{ ...mono10, color: T.accent, marginBottom: 24, letterSpacing: '0.16em' }}>
        APPROVAL PROMPT
      </div>
      <h3 style={{
        fontFamily: FONT_DISPLAY, fontSize: 56, fontWeight: 700, lineHeight: 1.0,
        letterSpacing: '-0.03em', margin: 0, marginBottom: 24,
      }}>
        Approve this design language for{' '}
        <span style={{ color: T.accent }}>Task 5</span>?
      </h3>
      <p style={{ fontSize: 16, color: T.inkMuted, lineHeight: 1.55, marginBottom: 40 }}>
        Approving locks the color, type, radius, elevation, and motion tokens into{' '}
        <code style={{ ...mono12, color: T.ink }}>tailwind.config.ts</code>. Tasks 6–17 build against
        these values. Reworking after Task 8 (Shadcn init) gets expensive — speak now.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{
          padding: '14px 20px', borderRadius: 12,
          background: `hsl(${HSL.success} / 0.1)`,
          border: `1px solid hsl(${HSL.success} / 0.4)`,
          ...mono11, color: T.success, letterSpacing: '0.04em',
        }}>
          REPLY "APPROVE" → PROCEED TO TASK 5
        </div>
        <div style={{
          padding: '14px 20px', borderRadius: 12,
          background: `hsl(${HSL.warning} / 0.08)`,
          border: `1px solid hsl(${HSL.warning} / 0.3)`,
          ...mono11, color: T.warning, letterSpacing: '0.04em',
        }}>
          OR FLAG SPECIFIC TOKENS TO REVISE
        </div>
      </div>

      <div style={{
        marginTop: 80, paddingTop: 24,
        borderTop: `1px solid hsl(${HSL.ink} / 0.08)`,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
        ...mono10, color: T.inkSubtle,
      }}>
        <div>WORKOUTAPP V2</div>
        <div>PHASE 0 / 17 TASKS</div>
        <div>GATE 1 OF 4</div>
        <div>{new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  </footer>
);

// ─── Root ───────────────────────────────────────────────────────────────────

export default function Phase0Showcase() {
  return (
    <Page>
      <Hero />
      <ColorSection />
      <TypeSection />
      <RadiusElevation />
      <CalendarSection />
      <SheetSection />
      <MotionSection />
      <Footer />
    </Page>
  );
}
