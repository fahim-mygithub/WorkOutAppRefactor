// Stack primitive: flex-layout container with fixed Tailwind class variants.
// Every variant maps to a literal class string so the JIT compiler picks them up
// (no template literals like `gap-${n}` — those are invisible to Tailwind).
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const stackVariants = cva('flex', {
  variants: {
    direction: {
      row: 'flex-row',
      column: 'flex-col',
    },
    gap: {
      0: 'gap-0',
      1: 'gap-1',
      2: 'gap-2',
      3: 'gap-3',
      4: 'gap-4',
      5: 'gap-5',
      6: 'gap-6',
      8: 'gap-8',
      10: 'gap-10',
      12: 'gap-12',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    },
    wrap: {
      true: 'flex-wrap',
      false: '',
    },
  },
  defaultVariants: {
    direction: 'column',
    gap: 4,
    align: 'stretch',
    justify: 'start',
    wrap: false,
  },
});

export type StackProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof stackVariants>;

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, direction, gap, align, justify, wrap, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        stackVariants({ direction, gap, align, justify, wrap }),
        className,
      )}
      {...props}
    />
  ),
);
Stack.displayName = 'Stack';

export { stackVariants };
