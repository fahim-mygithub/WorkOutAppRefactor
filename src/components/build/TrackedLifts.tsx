import { useMemo, useState } from 'react';
import { Check, Flag, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  liftAdded,
  liftRemoved,
  liftUpdated,
  progressionToggled,
} from '../../store/slices/trackedLiftsSlice';
import { checkpointDue, progressionStatus } from '../../lib/trackedLiftProgression';
import { formatLoad, formatTarget, groupByCategory } from '../../lib/trackedLifts';
import type { TrackedLift, WeightUnit } from '../../types/trackedLifts';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { TrackedLiftEditor } from './TrackedLiftEditor';

/**
 * TrackedLifts — the running list of lifts the user wants to keep an eye on,
 * grouped under their own categories (Push / Pull / Legs to start).
 *
 * Tempo: one subtle card per category, hairline-separated rows, the load in the
 * display voice on the right (the number you glance for), the target muted
 * under the name. Tapping a row opens the editor sheet; "Add" per category and
 * in the section header opens it empty.
 *
 * With `onToggleSelect`, a row becomes a checkbox so lifts can be picked to
 * build a workout from (tap anywhere on it), and a small pencil on the right
 * opens the editor instead. The parent owns the selection and the "Build
 * workout" action.
 *
 * The flag on the right marks a lift for progression (Volume / Strength sets
 * from its log, checkpoint days); flagged rows show that status under the
 * target. Unflagged lifts are accessories, repeated as tracked.
 */

/** `lift`/`category` are kept after closing so the sheet's exit animation
 *  doesn't flash the "add" copy over an edit. */
interface EditorState {
  open: boolean;
  lift: TrackedLift | null;
  category?: string;
}

interface TrackedLiftsProps {
  className?: string;
  /** Ids of the checked lifts (controlled). */
  selectedIds?: readonly string[];
  /** Enables the per-row checkboxes. */
  onToggleSelect?: (id: string) => void;
}

export function TrackedLifts({ className, selectedIds = [], onToggleSelect }: TrackedLiftsProps) {
  const dispatch = useAppDispatch();
  const { status, categories, lifts } = useAppSelector((s) => s.trackedLifts);
  const prefUnit = useAppSelector((s) => s.user.preferences.weightUnit);
  const defaultUnit: WeightUnit = prefUnit === 'kg' ? 'kg' : 'lb';
  const [editor, setEditor] = useState<EditorState>({ open: false, lift: null });

  const groups = useMemo(() => groupByCategory({ categories, lifts }), [categories, lifts]);

  if (status !== 'ready') return null;

  const editing = editor.lift;
  const close = () => setEditor((e) => ({ ...e, open: false }));

  return (
    <section aria-labelledby="tracked-lifts-heading" className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="tracked-lifts-heading" className="font-wide text-title font-bold text-ink">
          Tracked lifts
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setEditor({ open: true, lift: null })}>
          <Plus size={16} aria-hidden="true" />
          Add lift
        </Button>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map(({ category, lifts: rows }) => (
          <div key={category}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <h3 className="text-body-sm font-semibold text-ink">{category}</h3>
              <span className="rounded-full bg-surface-raised px-2 text-caption text-ink-muted">
                {rows.length}
                <span className="sr-only"> {rows.length === 1 ? 'lift' : 'lifts'}</span>
              </span>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={`Add a lift to ${category}`}
                className="ml-auto"
                onClick={() => setEditor({ open: true, lift: null, category })}
              >
                <Plus size={18} aria-hidden="true" />
              </IconButton>
            </div>

            <ul className="overflow-hidden rounded-[20px] bg-surface-subtle">
              {rows.length === 0 && (
                <li className="px-4 py-4 text-body-sm text-ink-muted">No lifts yet.</li>
              )}
              {rows.map((lift, i) => {
                const target = formatTarget(lift.target);
                const checked = selectedIds.includes(lift.id);
                const due = checkpointDue(lift);
                return (
                  <li
                    key={lift.id}
                    className={cn('flex items-stretch', i > 0 && 'border-t border-hairline')}
                  >
                    <button
                      type="button"
                      // Picking lifts for a workout: the whole row is the checkbox
                      // and the pencil edits. Without a selection handler there is
                      // nothing to check, so the row itself opens the editor.
                      role={onToggleSelect ? 'checkbox' : undefined}
                      aria-checked={onToggleSelect ? checked : undefined}
                      onClick={() =>
                        onToggleSelect ? onToggleSelect(lift.id) : setEditor({ open: true, lift })
                      }
                      className={cn(
                        'group flex min-h-[64px] min-w-0 flex-1 items-center gap-4 py-3 pl-4 pr-1 text-left transition-colors duration-snap',
                        'hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                      )}
                    >
                      {onToggleSelect && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors duration-snap',
                            checked
                              ? 'bg-accent-2 text-accent-2-fg'
                              : 'bg-surface-raised text-transparent group-hover:bg-surface-raised/70',
                          )}
                        >
                          <Check size={16} strokeWidth={3} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink">{lift.name}</span>
                        {target && (
                          <span className="mt-0.5 block truncate text-body-sm text-ink-muted">{target}</span>
                        )}
                        {lift.progression && (
                          <span
                            className={cn(
                              'mt-0.5 block text-caption',
                              due ? 'font-semibold text-accent' : 'text-accent-2',
                            )}
                          >
                            {progressionStatus(lift)}
                          </span>
                        )}
                      </span>
                      <span className="max-w-[45%] shrink-0 truncate text-right font-num font-tabular font-wide text-title font-bold text-ink">
                        {formatLoad(lift.load)}
                      </span>
                    </button>
                    {onToggleSelect && (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${lift.name}`}
                        title="Edit lift"
                        onClick={() => setEditor({ open: true, lift })}
                        className="my-auto shrink-0"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </IconButton>
                    )}
                    <button
                      type="button"
                      aria-pressed={!!lift.progression}
                      aria-label={`Track progression for ${lift.name}`}
                      title={lift.progression ? 'Progression lift' : 'Accessory (mark for progression)'}
                      onClick={() => dispatch(progressionToggled(lift.id))}
                      className="group flex w-12 shrink-0 items-center justify-center pr-1 focus-visible:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-snap',
                          'group-focus-visible:ring-2 group-focus-visible:ring-accent',
                          lift.progression
                            ? 'bg-accent-2/15 text-accent-2'
                            : 'text-ink-subtle group-hover:bg-surface-raised group-hover:text-ink-muted',
                        )}
                      >
                        <Flag size={18} fill={lift.progression ? 'currentColor' : 'none'} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <TrackedLiftEditor
        open={editor.open}
        onOpenChange={(o) => (o ? undefined : close())}
        lift={editing}
        categories={categories}
        defaultCategory={editor.category}
        defaultUnit={defaultUnit}
        onSave={(data) => {
          if (editing) dispatch(liftUpdated({ ...data, id: editing.id }));
          else dispatch(liftAdded(data));
          close();
        }}
        onDelete={
          editing
            ? () => {
                dispatch(liftRemoved(editing.id));
                close();
              }
            : undefined
        }
      />
    </section>
  );
}
