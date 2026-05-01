/**
 * Muscle group taxonomy used across the app's icon set.
 *
 * Source icons are silhouette glyphs from game-icons.net (CC BY 3.0).
 * Each component below renders with `fill="currentColor"` so callers can
 * tint via the `text-muscle-{group}` Tailwind utility tokens defined in
 * `tailwind.config.ts`.
 */
export type MuscleGroup =
  | 'push'
  | 'pull'
  | 'legs'
  | 'core'
  | 'cardio'
  | 'full-body'
  | 'mobility';

export interface MuscleIconProps {
  /** Pixel size — matches the design-system step scale. Defaults to 24. */
  size?: 24 | 32 | 48;
  /** Optional class for layout/positioning and color tinting. */
  className?: string;
  /**
   * If supplied, the SVG renders with `role="img"` and is announced to
   * assistive tech. Omit to mark the icon as decorative (`aria-hidden`).
   */
  'aria-label'?: string;
}
