// Label primitive: CVA-driven sizes, ref-forwarding, wraps Radix Label for
// click-to-focus + a11y association with form controls. Adds a token-styled
// required indicator and a `disabled` visual state surfaced via a data attr
// (so it composes with disabled form fields without altering the DOM contract).
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { extendTailwindMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';

// The shared `cn` (src/lib/utils) uses the stock tailwind-merge config, which
// classifies the project's custom `text-{caption,body-sm,...}` type-scale
// tokens as text-COLOUR utilities. That makes a size token (`text-body-sm`) and
// the ink colour (`text-ink`) collapse into one — only the last survives. This
// label-local merge teaches tailwind-merge that the type-scale tokens are
// font-SIZE, so size + colour coexist while a consumer `text-*` colour override
// still wins. Kept local so the shared `cn` contract is untouched.
const twMergeLabel = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-caption',
        'text-body-sm',
        'text-body',
        'text-display-lg',
      ],
    },
  },
});
const cn = (...inputs: ClassValue[]) => twMergeLabel(clsx(inputs));

const labelVariants = cva(
  'inline-flex items-center gap-1 font-medium text-ink data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'text-caption',
        md: 'text-body-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export type LabelProps = React.ComponentPropsWithoutRef<
  typeof LabelPrimitive.Root
> &
  VariantProps<typeof labelVariants> & {
    /** Renders a token-styled asterisk after the label text. */
    required?: boolean;
    /** Dims the label and disables the pointer cursor (visual state only). */
    disabled?: boolean;
  };

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, size, required = false, disabled = false, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    // `data-disabled` is only present when truthy so consumers can target it
    // with a selector and tests can assert its absence in the default state.
    data-disabled={disabled ? 'true' : undefined}
    className={cn(labelVariants({ size }), className)}
    {...props}
  >
    {children}
    {required ? (
      <span
        data-testid="label-required-indicator"
        aria-hidden="true"
        className="text-danger"
      >
        *
      </span>
    ) : null}
  </LabelPrimitive.Root>
));
Label.displayName = 'Label';

export { labelVariants };
