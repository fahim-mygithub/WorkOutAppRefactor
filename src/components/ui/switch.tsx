// Switch primitive: token-styled wrapper over Radix Switch for settings
// toggles (incl. the theme toggle). Renders a <button role="switch"> track
// with a sliding thumb. Accent fill when on, muted surface when off; brand
// focus-visible ring matching Button. Forwards ref to the underlying button
// and supports aria-label for accessible naming.
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export type SwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive.Root
>;

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // Track
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-snap',
      // Focus ring (matches Button's brand ring)
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      // State colors
      'data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-subtle',
      // Disabled
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-surface-raised shadow-e1 ring-0 transition-transform duration-snap',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
