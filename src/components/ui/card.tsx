// Card primitive: composable surface container with elevation tokens (e0..e3).
// Subcomponents (Header/Title/Body/Footer) provide consistent padding + layout.
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// `.board-card` (board.css) supplies the board surface, asymmetric hand-drawn
// corners, and the wobbly marker/chalk outline (drawn on a pseudo-element so the
// card's content stays crisp). Elevation shadows layer underneath for depth.
const cardVariants = cva('board-card', {
  variants: {
    elevation: {
      0: 'shadow-e0',
      1: 'shadow-e1',
      2: 'shadow-e2',
      3: 'shadow-e3',
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
      className={cn('text-title font-semibold text-ink', className)}
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
