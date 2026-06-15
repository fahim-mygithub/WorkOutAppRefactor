// Textarea primitive: native <textarea> matching Input field styling.
// CVA-driven so the error variant composes the same way Button's variants do.
// Tokens only (surface/ink/border/accent/danger) — no raw gray-*/hex. Ref is
// forwarded to the underlying <textarea>; `error` is sugar that flips both the
// danger border variant and `aria-invalid` (an explicit aria-invalid override
// still wins). `rows` is the standard native vertical-sizing knob.
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  'flex w-full min-h-[5rem] rounded-md border bg-surface px-3 py-2 text-body text-ink shadow-e1 transition-colors duration-snap placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      error: {
        true: 'border-danger focus-visible:ring-danger',
        false: 'border-input',
      },
    },
    defaultVariants: {
      error: false,
    },
  },
);

export type TextareaProps = React.ComponentPropsWithoutRef<'textarea'> &
  Omit<VariantProps<typeof textareaVariants>, 'error'> & {
    /** Error state — flips the danger border and sets aria-invalid. */
    error?: boolean;
  };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, 'aria-invalid': ariaInvalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={cn(textareaVariants({ error }), className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { textareaVariants };
