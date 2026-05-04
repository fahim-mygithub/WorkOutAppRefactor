// IconButton primitive: square, icon-only button. Mirrors Button's CVA structure
// but drops horizontal padding / gap and locks the aspect ratio per size token.
// `aria-label` is required since there is no visible text.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent/90',
        secondary:
          'bg-surface-raised text-ink shadow-e1 hover:bg-surface-raised/90',
        ghost: 'text-ink hover:bg-surface-subtle',
        danger: 'bg-danger text-ink-inverse hover:bg-danger/90',
      },
      size: {
        sm: 'h-9 w-9',
        md: 'h-touch-min w-touch-min min-h-touch-min min-w-touch-min',
        lg: 'h-touch-lg w-touch-lg min-h-touch-lg min-w-touch-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type IconButtonProps = Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'aria-label'
> &
  VariantProps<typeof iconButtonVariants> & {
    /** Required accessible label — IconButton has no visible text. */
    'aria-label': string;
    asChild?: boolean;
  };

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    // HTML buttons default to "submit" inside <form>; the primitive overrides
    // unless the consumer asks for something else. Slot inherits the child's
    // intrinsic semantics, so we only set type when rendering a real <button>.
    const resolvedType = asChild ? type : (type ?? 'button');
    return (
      <Comp
        ref={ref}
        type={resolvedType}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export { iconButtonVariants };
