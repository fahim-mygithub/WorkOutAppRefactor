import { useMemo, useState } from 'react';
import { Shuffle, Pencil, Trash2, Plus } from 'lucide-react';
import type { Exercise } from '../../types/exercise';
import { exercisesForMuscle } from '../../lib/recommendExercises';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { IconButton } from '../ui/icon-button';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';

/** One placed exercise in the draft workout, tagged with the muscle it came from. */
export interface ReviewRow {
  rowId: string;
  term: string;
  exercise: Exercise;
}

export interface RecommendedWorkoutProps {
  name: string;
  onNameChange: (name: string) => void;
  rows: ReviewRow[];
  /** Full catalog — used to populate the per-muscle "swap" picker. */
  exercises: Exercise[];
  onRandomize: (rowId: string) => void;
  onReplace: (rowId: string, exercise: Exercise) => void;
  onRemove: (rowId: string) => void;
  onAddForTerm: (term: string) => void;
}

interface MuscleGroup {
  term: string;
  rows: ReviewRow[];
}

/**
 * RecommendedWorkout — the muscle branch's review screen. Shows one recommended
 * exercise per selected muscle, grouped by muscle, each row offering randomize /
 * swap / remove and each group an "add another". The workout name sits pinned at
 * the top (the keyboard-bearing input, kept in the top half) while only the list
 * scrolls — so the Start button (in the WizardShell footer) and the name stay put.
 */
export function RecommendedWorkout({
  name,
  onNameChange,
  rows,
  exercises,
  onRandomize,
  onReplace,
  onRemove,
  onAddForTerm,
}: RecommendedWorkoutProps) {
  // Which row is being swapped (drives the picker sheet). null = closed.
  const [editing, setEditing] = useState<ReviewRow | null>(null);

  // Group rows by muscle term, preserving the order each term first appears.
  const groups = useMemo<MuscleGroup[]>(() => {
    const order: string[] = [];
    const byTerm = new Map<string, ReviewRow[]>();
    for (const row of rows) {
      if (!byTerm.has(row.term)) {
        byTerm.set(row.term, []);
        order.push(row.term);
      }
      byTerm.get(row.term)!.push(row);
    }
    return order.map((term) => ({ term, rows: byTerm.get(term)! }));
  }, [rows]);

  const swapOptions = useMemo<Exercise[]>(
    () => (editing ? exercisesForMuscle(exercises, editing.term) : []),
    [editing, exercises],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Name — pinned, top-half, keyboard-friendly. */}
      <div className="shrink-0 pb-4">
        <Label htmlFor="workout-name" className="mb-1.5 text-ink-muted">
          Workout name
        </Label>
        <Input
          id="workout-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Name your workout"
          autoComplete="off"
        />
      </div>

      {/* Grouped exercise list — the only scrolling region on this screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-body-sm text-ink-muted">
            No exercises yet. Go back and pick some muscles.
          </p>
        ) : (
          <ul className="space-y-5">
            {groups.map((group) => (
              <li key={group.term}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-body font-semibold text-ink">{group.term}</h2>
                  <span className="text-caption text-ink-muted">
                    <span className="font-tabular">{group.rows.length}</span> exercise
                    {group.rows.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* One subtle card per muscle; exercises are rows split by hairlines. */}
                <div className="rounded-[20px] bg-surface-subtle">
                  <ul className="divide-y divide-hairline">
                    {group.rows.map((row) => (
                      <li key={row.rowId} className="flex items-center gap-1 py-2 pl-4 pr-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-medium text-ink">{row.exercise.name}</p>
                          <p className="mt-0.5 truncate text-caption text-ink-muted">
                            {/* Draft default from buildDefaultSets (3 × 10); the user
                                dials in real weights/reps live during the workout. */}
                            <span className="font-tabular">3 × 10</span>
                            {row.exercise.equipment ? ` · ${row.exercise.equipment}` : ''}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center">
                          <IconButton
                            variant="ghost"
                            size="md"
                            aria-label={`Randomize ${group.term} exercise`}
                            onClick={() => onRandomize(row.rowId)}
                          >
                            <Shuffle size={18} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size="md"
                            aria-label={`Choose a different ${group.term} exercise`}
                            onClick={() => setEditing(row)}
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size="md"
                            aria-label={`Remove ${row.exercise.name}`}
                            onClick={() => onRemove(row.rowId)}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </IconButton>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onAddForTerm(group.term)}
                    className="flex min-h-touch-min w-full items-center gap-2 border-t border-hairline px-4 text-body-sm font-semibold text-ink-muted transition-colors duration-snap hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent rounded-b-[20px]"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add another {group.term.toLowerCase()} exercise
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Swap picker — pick a specific exercise for the row's muscle. */}
      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="max-w-xl">
          <SheetTitle className="text-title">
            {editing ? `${editing.term} exercises` : 'Exercises'}
          </SheetTitle>
          <ul className="mt-3 divide-y divide-hairline">
            {swapOptions.map((option) => {
              const isCurrent = editing?.exercise.id === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (editing) onReplace(editing.rowId, option);
                      setEditing(null);
                    }}
                    className={cn(
                      'flex min-h-touch-lg w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-ink transition-colors duration-snap',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                      !isCurrent && 'hover:text-ink-muted',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-body">{option.name}</span>
                      <span className="block truncate text-caption text-ink-muted">
                        {option.equipment} · {option.difficulty}
                      </span>
                    </span>
                    {isCurrent && (
                      <span className="shrink-0 text-caption font-semibold text-accent-2">Current</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}
