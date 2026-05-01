import type { MuscleIconProps } from './types';

/**
 * Legs (quads / hamstrings / glutes / calves).
 *
 * Source: Tabler Icons "run" (MIT)
 * https://tabler.io/icons/icon/run
 */
export function LegsIcon({
  size = 24,
  className,
  'aria-label': ariaLabel,
}: MuscleIconProps) {
  const labelled = typeof ariaLabel === 'string' && ariaLabel.length > 0;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? ariaLabel : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <path
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 17l5 1l.75-1.5M15 21v-4l-4-3l1-6"
      />
      <path
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 12V9l5-1l3 3l3 1"
      />
    </svg>
  );
}
