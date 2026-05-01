import type { MuscleIconProps } from './types';

/**
 * Core (abs / obliques / lower back).
 *
 * Source: Tabler Icons "body-scan" (MIT)
 * https://tabler.io/icons/icon/body-scan
 */
export function CoreIcon({
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
        d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m-4 12h2a2 2 0 0 0 2-2v-2m-9-8a1 1 0 1 0 2 0a1 1 0 1 0-2 0m-1 9v-1a2 2 0 1 1 4 0v1m-6-7q1 1 2 1h4q1 0 2-1m-4 1v3"
      />
    </svg>
  );
}
