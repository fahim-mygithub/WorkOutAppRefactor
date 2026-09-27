import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { bestResolved } from '../../store/slices/trackedLiftsSlice';
import { formatLoad, formatTarget } from '../../lib/trackedLifts';
import type { TrackedLoad, TrackedTarget } from '../../types/trackedLifts';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';

const describe = (load: TrackedLoad, target: TrackedTarget) =>
  [formatLoad(load), formatTarget(target)].filter(Boolean).join(', ');

/**
 * NewBestSheet — after a finished workout, each progression lift whose logged
 * sets beat its benchmark asks once: Update benchmark / Keep. Never shown over
 * the player; closing the sheet leaves the bests queued for next time.
 */
export function NewBestSheet() {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const { pendingBests = [], lifts } = useAppSelector((s) => s.trackedLifts);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const rows = pendingBests
    .map((best) => ({ best, lift: lifts.find((l) => l.id === best.liftId) }))
    .filter((r): r is { best: (typeof pendingBests)[number]; lift: NonNullable<typeof r.lift> } => !!r.lift);

  // A new best arriving re-opens a sheet the user closed earlier.
  useEffect(() => {
    if (dismissedAt !== null && rows.length > dismissedAt) setDismissedAt(null);
  }, [rows.length, dismissedAt]);

  const onPlayer = pathname.startsWith('/workout');
  const open = rows.length > 0 && !onPlayer && dismissedAt === null;

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : setDismissedAt(rows.length))}>
      <SheetContent className="mx-auto max-w-md">
        <SheetTitle className="text-title">{rows.length === 1 ? 'New best' : 'New bests'}</SheetTitle>
        <SheetDescription>Update the benchmark to chase the new number, or keep the old one.</SheetDescription>

        <ul className="mt-5 flex flex-col gap-3">
          {rows.map(({ best, lift }) => (
            <li key={best.liftId} className="rounded-[20px] bg-surface-raised p-4">
              <p className="text-body font-semibold text-ink">{lift.name}</p>
              <p className="mt-1 font-display font-tabular text-title text-accent-2">
                {describe(best.load, best.target)}
              </p>
              <p className="mt-0.5 text-body-sm text-ink-muted">Was {describe(lift.load, lift.target)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => dispatch(bestResolved({ liftId: best.liftId, accept: false }))}
                >
                  Keep
                </Button>
                <Button onClick={() => dispatch(bestResolved({ liftId: best.liftId, accept: true }))}>
                  Update benchmark
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
