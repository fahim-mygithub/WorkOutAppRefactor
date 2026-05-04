import { describe, it, expect, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

// Helper: a controlled wrapper exposing the open state to the test, so we can
// assert that consumer-side state (and onOpenChange) wires through Radix.
function ControlledHarness({
  initialOpen = false,
  onOpenChangeSpy,
}: {
  initialOpen?: boolean;
  onOpenChangeSpy?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChangeSpy?.(next);
        setOpen(next);
      }}
    >
      <SheetTrigger>
        <button type="button">open me</button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle>Day detail</SheetTitle>
        <SheetDescription>Tuesday, May 5</SheetDescription>
        <p>panel body</p>
      </SheetContent>
    </Sheet>
  );
}

describe('Sheet', () => {
  it('does not render content when uncontrolled and never opened (closed by default)', () => {
    render(
      <Sheet>
        <SheetTrigger>
          <button type="button">open</button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens via trigger click and reveals SheetContent children', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>
          <button type="button">open</button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>
          <button type="button">open</button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // Wait for the AnimatePresence exit + Radix unmount to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>
          <button type="button">open</button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole('button', { name: /open/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Radix renders Dialog.Overlay as a sibling within the portal. We look it
    // up by data attribute so we don't depend on Tailwind classes for the test.
    const overlay = document.querySelector('[data-sheet-overlay]');
    expect(overlay).toBeInTheDocument();
    await user.click(overlay as Element);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
  });

  it('controlled mode: open=true shows content, flipping prop hides it', async () => {
    const { rerender } = render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('panel body')).toBeInTheDocument();

    rerender(
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
  });

  it('fires onOpenChange when the user dismisses via Escape (controlled mode)', async () => {
    const user = userEvent.setup();
    const onOpenChangeSpy = vi.fn();
    render(
      <ControlledHarness initialOpen={true} onOpenChangeSpy={onOpenChangeSpy} />,
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChangeSpy).toHaveBeenCalledWith(false);
  });

  it('fires onOpenChange when the user dismisses via backdrop click (controlled mode)', async () => {
    const user = userEvent.setup();
    const onOpenChangeSpy = vi.fn();
    render(
      <ControlledHarness initialOpen={true} onOpenChangeSpy={onOpenChangeSpy} />,
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const overlay = document.querySelector('[data-sheet-overlay]');
    await user.click(overlay as Element);
    expect(onOpenChangeSpy).toHaveBeenCalledWith(false);
  });

  it('SheetTitle renders as a heading with the provided text', async () => {
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Day detail</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    const heading = await screen.findByRole('heading', { name: /day detail/i });
    expect(heading).toBeInTheDocument();
  });

  it('SheetDescription renders the provided text when supplied', async () => {
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Day detail</SheetTitle>
          <SheetDescription>Tuesday, May 5</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(await screen.findByText('Tuesday, May 5')).toBeInTheDocument();
  });

  it('SheetContent renders a drag handle as the first child of the panel', async () => {
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <p>panel body</p>
        </SheetContent>
      </Sheet>,
    );
    const handle = await screen.findByTestId('sheet-drag-handle');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('aria-hidden', 'true');
  });

  it('SheetContent merges a consumer className via tailwind-merge', async () => {
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent className="bg-blue-500">
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toMatch(/bg-blue-500/);
    // Consumer override wins for the conflicting base utility.
    const tokens = dialog.className.split(/\s+/);
    expect(tokens).not.toContain('bg-surface-raised');
  });

  it('forwards SheetContent ref to the panel <div>', async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent ref={ref}>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    // Wait for portal mount.
    await screen.findByRole('dialog');
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute('role')).toBe('dialog');
  });

  it('forwards SheetTitle ref to the underlying heading element', async () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle ref={ref}>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    await screen.findByRole('heading', { name: /title/i });
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    // Radix Dialog.Title defaults to <h2>.
    expect(ref.current?.tagName).toBe('H2');
  });

  it('SheetContent has correct ARIA: role="dialog" and aria-modal="true"', async () => {
    render(
      <Sheet open={true} onOpenChange={() => {}}>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
