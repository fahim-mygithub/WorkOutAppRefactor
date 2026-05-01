import type { MuscleIconProps } from './types';

/**
 * Mobility (stretching / yoga / recovery).
 *
 * Source: Tabler Icons "yoga" (MIT)
 * https://tabler.io/icons/icon/yoga
 */
export function MobilityIcon({
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
        d="M7 7a1 1 0 1 0 2 0a1 1 0 0 0-2 0m6 14l1-9l7-6M3 11h6l5 1m-2.5-3.5L16 5"
      />
    </svg>
  );
}
