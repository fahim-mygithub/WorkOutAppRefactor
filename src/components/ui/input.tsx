// Input primitive: native <input> styled with design tokens, CVA-driven sizes,
// ref-forwarding. Error state is driven by `aria-invalid` (the accessible
// contract) so consumers wire validation once and get both the a11y signal and
// the danger-token styling for free. No external dependency.
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  // Tempo: filled field on the raised surface, no outline at rest. Amber
  // focus ring; aria-invalid draws a danger ring (the accessible contract
  // drives the styling). `font-num` + tabular digits keep typed weights/reps
  // steady while editing.
  'flex w-full rounded-xl border-0 bg-surface-raised font-num font-tabular text-ink transition-shadow duration-snap placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger aria-[invalid=true]:focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'min-h-9 h-9 px-3 text-body-sm',
        md: 'min-h-touch-min px-4 text-body',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export type InputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'size'
> &
  VariantProps<typeof inputVariants>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type ?? 'text'}
        className={cn(inputVariants({ size }), className)}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { inputVariants };
