// Button primitive: CVA-driven variants, ref-forwarding, Radix Slot asChild pattern.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg hover:bg-accent/90',
        secondary:
          'bg-surface-raised text-ink shadow-e1 hover:bg-surface-raised/90',
        ghost:
          'text-ink hover:bg-surface-subtle',
        danger:
          'bg-danger text-ink-inverse hover:bg-danger/90',
      },
      size: {
        sm: 'min-h-9 h-9 px-3 text-body-sm',
        md: 'min-h-touch-min px-4 text-body',
        lg: 'min-h-touch-lg px-5 text-body font-semibold',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, type, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    // HTML buttons default to "submit" inside <form>; the primitive overrides
    // unless the consumer asks for something else. Slot inherits the child's
    // intrinsic semantics, so we only set type when rendering a real <button>.
    const resolvedType = asChild ? type : (type ?? 'button');
    return (
      <Comp
        ref={ref}
        type={resolvedType}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
