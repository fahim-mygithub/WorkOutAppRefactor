import type { MuscleIconProps } from './types';

/**
 * Full-body (compound / total-body sessions).
 *
 * Source: Tabler Icons "gymnastics" (MIT) -- a dynamic full-body figure,
 * chosen over `stretching` so it differentiates visually from the mobility
 * (yoga) glyph.
 * https://tabler.io/icons/icon/gymnastics
 */
export function FullBodyIcon({
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
        d="M11 4a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 20h4l1.5-3m7.5 3l-1-5h-5l1-7"
      />
      <path
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 10l4-1l4-1l4 1.5l4 1.5"
      />
    </svg>
  );
}
