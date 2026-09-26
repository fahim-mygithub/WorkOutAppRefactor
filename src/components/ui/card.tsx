// Card primitive: composable surface container. In Tempo, depth comes from
// surface steps rather than borders or shadows, so `elevation` selects the
// surface: 0 = ground, 1 = subtle (default card), 2+ = raised (nested/emphasis).
// Subcomponents (Header/Title/Body/Footer) provide consistent padding + layout.
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('relative rounded-[20px] text-ink', {
  variants: {
    elevation: {
      0: 'bg-surface',
      1: 'bg-surface-subtle',
      2: 'bg-surface-raised',
      3: 'bg-surface-raised',
    },
  },
  defaultVariants: {
    elevation: 1,
  },
});

export type CardProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof cardVariants>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ elevation }), className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export type CardHeaderProps = React.ComponentPropsWithoutRef<'div'>;

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pb-2', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export type CardTitleProps = React.ComponentPropsWithoutRef<'h3'>;

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-title font-bold text-ink', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

export type CardBodyProps = React.ComponentPropsWithoutRef<'div'>;

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-2', className)} {...props} />
  ),
);
CardBody.displayName = 'CardBody';

export type CardFooterProps = React.ComponentPropsWithoutRef<'div'>;

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-4 pt-2 flex items-center gap-2', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export { cardVariants };
