import type { MuscleIconProps } from './types';

/**
 * Pull (back / biceps / rear delts).
 *
 * Source: Tabler Icons "weight" (MIT) -- a kettlebell silhouette, evoking
 * pull/swing patterns. Used as the closest-fit because Tabler does not
 * currently publish a `pull-up` or `chinstrap` glyph.
 * https://tabler.io/icons/icon/weight
 */
export function PullIcon({
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
        d="M9 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0"
      />
      <path
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.835 9h10.33a1 1 0 0 1 .984.821l1.637 9A1 1 0 0 1 18.802 20H5.198a1 1 0 0 1-.984-1.179l1.637-9A1 1 0 0 1 6.835 9"
      />
    </svg>
  );
}
