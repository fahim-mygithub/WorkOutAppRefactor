// Skeleton primitive: static loading placeholder. Pulses while content is
// loading and respects prefers-reduced-motion via the `motion-safe:` Tailwind
// variant. Decorative by default (`aria-hidden="true"`); the consuming
// container should mark itself `aria-busy="true"` if it wants assistive tech
// to announce the loading state.
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const skeletonVariants = cva('bg-surface-subtle rounded-md', {
  variants: {
    pulse: {
      true: 'motion-safe:animate-pulse',
      false: '',
    },
  },
  defaultVariants: {
    pulse: true,
  },
});

export type SkeletonProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof skeletonVariants> & {
    /**
     * Render as a `<div>` (default, block) or `<span>` (inline). Both DOM
     * nodes accept the same global attrs the primitive cares about, so we
     * keep the prop type as `<'div'>` for ergonomics. The forwarded ref is
     * typed `HTMLDivElement`; `<span>` is also an `HTMLElement` and works
     * fine through the same channel for measurement / focus management.
     */
    as?: 'div' | 'span';
  };

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, pulse, as = 'div', ...props }, ref) => {
    const Comp = as;
    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement & HTMLSpanElement>}
        aria-hidden="true"
        className={cn(skeletonVariants({ pulse }), className)}
        {...props}
      />
    );
  },
);
Skeleton.displayName = 'Skeleton';

export { skeletonVariants };
