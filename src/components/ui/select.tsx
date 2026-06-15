// Select primitive: a token-styled, accessible dropdown built on Radix Select.
//
// Composition mirrors Radix's own (Root / Trigger / Value / Content / Item) so
// consumers get the full a11y contract for free: the trigger is a `combobox`,
// the list is a `listbox`, items are `option`s, keyboard navigation (type-ahead,
// arrows, Home/End, Enter/Space, Escape) and focus management all come from
// Radix. We only own styling (design tokens, no raw hex / gray-*) and the
// open/close animation.
//
// Open animation: Radix owns Content's mount/unmount lifecycle. We wrap the
// Viewport in a `motion.div` (AnimatePresence) that plays the tokenised
// `motion.preset.scale` enter when Radix mounts the popover. Letting Radix own
// the lifecycle keeps behaviour deterministic in jsdom while still giving a
// branded open animation. See SelectContent for the wiring.
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion as fmotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { motion as motionTokens } from '@/lib/motion';

// --- Root / Value (thin re-exports; no styling needed) ----------------------

export const Select = SelectPrimitive.Root;
Select.displayName = 'Select';

export const SelectGroup = SelectPrimitive.Group;
SelectGroup.displayName = 'SelectGroup';

export const SelectValue = SelectPrimitive.Value;

// --- Trigger ----------------------------------------------------------------

export type SelectTriggerProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Trigger
>;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex min-h-touch-min w-full items-center justify-between gap-2 rounded-md bg-surface-raised px-4 text-body text-ink shadow-e1',
      'transition-colors duration-snap',
      'placeholder:text-ink-subtle data-[placeholder]:text-ink-subtle',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

// --- Scroll buttons ---------------------------------------------------------

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1 text-ink-subtle',
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1 text-ink-subtle',
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

// --- Content ----------------------------------------------------------------
export type SelectContentProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Content
>;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-hidden rounded-md bg-surface-raised text-ink shadow-e3',
        position === 'popper' &&
          'w-full min-w-[var(--radix-select-trigger-width)]',
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <AnimatePresence initial={false}>
        <fmotion.div
          key="select-viewport"
          initial={motionTokens.preset.scale.initial}
          animate={motionTokens.preset.scale.animate}
          transition={motionTokens.preset.scale.transition}
        >
          <SelectPrimitive.Viewport
            className={cn(
              'p-1',
              position === 'popper' &&
                'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
        </fmotion.div>
      </AnimatePresence>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

// --- Item -------------------------------------------------------------------

export type SelectItemProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Item
>;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex min-h-touch-min w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-body text-ink outline-none',
      'transition-colors duration-snap',
      'focus:bg-surface-subtle data-[highlighted]:bg-surface-subtle data-[highlighted]:outline-none',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-accent" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

// --- Label / Separator (styled passthroughs for grouped menus) --------------

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-body-sm font-semibold text-ink-subtle', className)}
    {...props}
  />
));
SelectLabel.displayName = 'SelectLabel';

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-surface-subtle', className)}
    {...props}
  />
));
SelectSeparator.displayName = 'SelectSeparator';
