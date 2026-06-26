/**
 * Push / Pull / Legs barbell-figure glyphs, inspired by the classic PPL
 * infographic (a lifter pressing / hanging / squatting a barbell). Stroke-based
 * with `currentColor` so each inherits its muscle-group hue (red/blue/yellow)
 * from the design tokens — drop-in replacements for the lucide PPL glyphs.
 *
 * API matches lucide icons (`size`, `className`) so MUSCLE_GROUP_META can hold a
 * mix of these and lucide icons under one component type.
 */
import type { SVGProps } from 'react';

export interface PplIconProps {
  size?: number;
  className?: string;
}

function Frame({ size = 24, className, children }: PplIconProps & { children: SVGProps<SVGSVGElement>['children'] }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** PUSH — standing overhead press: a barbell locked out overhead. */
export function PushIcon(props: PplIconProps) {
  return (
    <Frame {...props}>
      {/* barbell + plates, overhead */}
      <line x1="3.5" y1="4" x2="20.5" y2="4" />
      <line x1="6" y1="2.1" x2="6" y2="5.9" />
      <line x1="18" y1="2.1" x2="18" y2="5.9" />
      {/* head */}
      <circle cx="12" cy="9" r="1.8" />
      {/* arms reaching up to the bar */}
      <line x1="10.4" y1="4" x2="11" y2="7.4" />
      <line x1="13.6" y1="4" x2="13" y2="7.4" />
      {/* torso + planted stance */}
      <line x1="12" y1="10.8" x2="12" y2="15.5" />
      <line x1="12" y1="15.5" x2="9.5" y2="20.5" />
      <line x1="12" y1="15.5" x2="14.5" y2="20.5" />
    </Frame>
  );
}

/** PULL — hanging from the bar (pull-up): arms up, knees tucked. */
export function PullIcon(props: PplIconProps) {
  return (
    <Frame {...props}>
      {/* bar + plates at the very top */}
      <line x1="3.5" y1="3.4" x2="20.5" y2="3.4" />
      <line x1="6" y1="1.6" x2="6" y2="5.2" />
      <line x1="18" y1="1.6" x2="18" y2="5.2" />
      {/* arms gripping up to the bar */}
      <line x1="9.2" y1="3.4" x2="10.4" y2="8" />
      <line x1="14.8" y1="3.4" x2="13.6" y2="8" />
      {/* head below the bar */}
      <circle cx="12" cy="7.4" r="1.7" />
      {/* hanging torso */}
      <line x1="12" y1="9.1" x2="12" y2="13.6" />
      {/* tucked legs (knees out, feet in) */}
      <path d="M12 13.6 L9.6 16.4 L11 19.4" />
      <path d="M12 13.6 L14.4 16.4 L13 19.4" />
    </Frame>
  );
}

/** LEGS — back squat: barbell racked on the shoulders, knees bent. */
export function LegsIcon(props: PplIconProps) {
  return (
    <Frame {...props}>
      {/* bar + plates on the shoulders */}
      <line x1="3.5" y1="7.6" x2="20.5" y2="7.6" />
      <line x1="6" y1="5.8" x2="6" y2="9.4" />
      <line x1="18" y1="5.8" x2="18" y2="9.4" />
      {/* head above the bar */}
      <circle cx="12" cy="4.9" r="1.7" />
      {/* arms gripping the bar */}
      <line x1="8.8" y1="7.6" x2="10" y2="10.6" />
      <line x1="15.2" y1="7.6" x2="14" y2="10.6" />
      {/* torso */}
      <line x1="12" y1="6.6" x2="12" y2="13" />
      {/* deep squat: thighs out to the knees, shins down */}
      <path d="M12 13 L8.6 15 L9 20.5" />
      <path d="M12 13 L15.4 15 L15 20.5" />
    </Frame>
  );
}
