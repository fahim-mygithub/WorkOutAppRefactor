// Sheet primitive: bottom-sheet modal built on Radix Dialog + Framer Motion.
// Combines Radix's accessibility (focus trap, Escape, ARIA, portal) with
// Framer's enter/exit animations driven by AnimatePresence.
//
// Animation strategy:
//   Radix's Dialog.Overlay / Dialog.Content unmount instantly when `open`
//   flips to false, which kills exit animations. The standard fix is
//   `forceMount` on both — which delegates open-state visibility to us — and
//   then wrapping them in AnimatePresence so Framer can play the exit before
//   unmount. To feed AnimatePresence we need access to the boolean `open`
//   inside SheetContent, so we publish it through a small internal context
//   from the root. Both controlled (open prop given) and uncontrolled (no
//   open prop, internal state) modes are supported.
//
// Motion tokens: panel uses `motion.preset.sheetUp` (slow + springSoft),
// backdrop uses `motion.preset.fade` — see src/lib/motion.ts.
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AnimatePresence,
  motion as fmotion,
  type HTMLMotionProps,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { motion as motionTokens } from '@/lib/motion';

type SheetContextValue = {
  open: boolean;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(): SheetContextValue {
  const ctx = React.useContext(SheetContext);
  if (!ctx) {
    throw new Error(
      'Sheet subcomponents must be rendered inside <Sheet>.',
    );
  }
  return ctx;
}

export type SheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  // Track open in local state when uncontrolled, otherwise mirror the prop so
  // SheetContext always has a boolean to feed AnimatePresence.
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const currentOpen = isControlled ? open : internalOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const ctx = React.useMemo<SheetContextValue>(
    () => ({ open: currentOpen }),
    [currentOpen],
  );

  return (
    <SheetContext.Provider value={ctx}>
      <DialogPrimitive.Root open={currentOpen} onOpenChange={handleOpenChange}>
        {children}
      </DialogPrimitive.Root>
    </SheetContext.Provider>
  );
};
Sheet.displayName = 'Sheet';

export type SheetTriggerProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Trigger
>;

export const SheetTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  SheetTriggerProps
>(({ asChild = true, ...props }, ref) => (
  <DialogPrimitive.Trigger ref={ref} asChild={asChild} {...props} />
));
SheetTrigger.displayName = 'SheetTrigger';

// Public prop surface uses plain div attributes (consumer ergonomics). The
// underlying element is a `motion.div` whose drag/pan handler signatures
// diverge from React DOM's, so we cast the spread at the boundary.
export type SheetContentProps = React.ComponentPropsWithoutRef<'div'>;

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useSheetContext();
    return (
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <fmotion.div
                data-sheet-overlay=""
                className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
                {...motionTokens.preset.fade}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <fmotion.div
                ref={ref}
                // Radix v1.1 stopped emitting `aria-modal` (focus trap is the
                // contract), but the v2 spec asserts on it; set it explicitly.
                aria-modal="true"
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-xl bg-surface-raised p-6 pt-3 shadow-e3',
                  className,
                )}
                {...motionTokens.preset.sheetUp}
                // motion.div's drag/pan handler signatures differ from native
                // React DOM equivalents (PanInfo vs. DragEvent). Consumers
                // pass plain div attrs; the cast bridges that boundary.
                {...(props as HTMLMotionProps<'div'>)}
              >
                <div
                  data-testid="sheet-drag-handle"
                  aria-hidden="true"
                  className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15"
                />
                {children}
              </fmotion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    );
  },
);
SheetContent.displayName = 'SheetContent';

export type SheetTitleProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
>;

export const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  SheetTitleProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-display-lg font-bold text-ink', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

export type SheetDescriptionProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
>;

export const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  SheetDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-body-sm text-ink-subtle', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';
