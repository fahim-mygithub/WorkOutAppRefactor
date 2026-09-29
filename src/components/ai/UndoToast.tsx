// UndoToast: a change the AI applied on its own (auto tier), with one tap to
// take it back. Closes itself after UNDO_MS.
//
// Positioning: fixed above the bottom nav (the nav is ~3.7rem tall plus the
// bottom safe-area inset), so 5rem + the inset clears it with a small gap.
import * as React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const UNDO_MS = 8000;

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  /**
   * Called once when the toast is finished (timed out or undone). Held in a
   * ref, so passing a new function on re-render does not restart the timer.
   */
  onDone: () => void;
}

export function UndoToast({ message, onUndo, onDone }: UndoToastProps) {
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = React.useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);

  React.useEffect(() => {
    const t = setTimeout(finish, UNDO_MS);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-surface-raised px-4 py-3 shadow-e3"
    >
      <Check className="h-5 w-5 shrink-0 text-accent-2" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-body-sm text-ink">{message}</p>
      <Button
        variant="ghost"
        onClick={() => {
          if (doneRef.current) return;
          onUndo();
          finish();
        }}
      >
        Undo
      </Button>
    </div>
  );
}
UndoToast.displayName = 'UndoToast';
