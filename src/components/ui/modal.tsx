// Modal primitive: a CENTERED dialog built on Radix Dialog + Framer Motion.
// Sibling to Sheet (which slides up from the bottom) — use this when content
// should sit in the middle of the screen as a closable card.
//
// Animation strategy mirrors Sheet: Radix unmounts Overlay/Content the instant
// `open` flips to false, killing exit animations, so both are `forceMount`ed and
// wrapped in AnimatePresence. The boolean `open` is published through an internal
// context so SheetContent's sibling here can feed AnimatePresence.
//
// Centering note: the panel animates `scale` via Framer (which owns `transform`),
// so it CANNOT also be centered with a `-translate-1/2` transform — Framer would
// overwrite it. Instead the panel is centered transform-free with
// `fixed inset-0 m-auto h-fit` (auto-margins center a fixed, sized box on both
// axes), leaving `transform` entirely to the scale animation.
//
// Motion tokens: panel uses `motion.preset.scale`, backdrop uses
// `motion.preset.fade` — see src/lib/motion.ts.
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AnimatePresence,
  motion as fmotion,
  type HTMLMotionProps,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { motion as motionTokens } from '@/lib/motion';

type ModalContextValue = {
  open: boolean;
};

const ModalContext = React.createContext<ModalContextValue | null>(null);

function useModalContext(): ModalContextValue {
  const ctx = React.useContext(ModalContext);
  if (!ctx) {
    throw new Error('Modal subcomponents must be rendered inside <Modal>.');
  }
  return ctx;
}

export type ModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export const Modal = ({ open, onOpenChange, children }: ModalProps) => {
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

  const ctx = React.useMemo<ModalContextValue>(
    () => ({ open: currentOpen }),
    [currentOpen],
  );

  return (
    <ModalContext.Provider value={ctx}>
      <DialogPrimitive.Root open={currentOpen} onOpenChange={handleOpenChange}>
        {children}
      </DialogPrimitive.Root>
    </ModalContext.Provider>
  );
};
Modal.displayName = 'Modal';

export type ModalContentProps = React.ComponentPropsWithoutRef<'div'>;

export const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = useModalContext();
    return (
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <fmotion.div
                data-modal-overlay=""
                className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
                {...motionTokens.preset.fade}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <fmotion.div
                ref={ref}
                aria-modal="true"
                className={cn(
                  // Transform-free centering (see file header): auto-margins on a
                  // fixed, height-fit box center it on both axes; `transform` is
                  // left to the scale animation.
                  'fixed inset-0 z-50 m-auto flex h-fit max-h-[88svh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-e3',
                  className,
                )}
                {...motionTokens.preset.scale}
                {...(props as HTMLMotionProps<'div'>)}
              >
                {children}
              </fmotion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    );
  },
);
ModalContent.displayName = 'ModalContent';

export type ModalTitleProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
>;

export const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-display-lg font-bold text-ink', className)}
      {...props}
    />
  ),
);
ModalTitle.displayName = 'ModalTitle';

export type ModalDescriptionProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
>;

export const ModalDescription = React.forwardRef<
  HTMLParagraphElement,
  ModalDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-body-sm text-ink-subtle', className)}
    {...props}
  />
));
ModalDescription.displayName = 'ModalDescription';
