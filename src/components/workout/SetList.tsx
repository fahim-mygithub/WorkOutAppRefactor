// SetList — the all-sets overview shared by the single-exercise card and the
// superset card (Tempo): one tappable row per set (set #, last time, reps,
// weight), separated by hairlines. The current set sits on the raised surface
// with an amber number; completed sets show an ice check. Pure presentation +
// callbacks; no Redux. Memoized so a parent re-render does not re-render the
// rows unless their inputs actually change.
import React from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkoutSet } from '../../types/exercise';
import type { ExerciseHistory } from '../../types/exerciseHistory';

interface SetListProps {
  sets: WorkoutSet[];
  currentSetIndex: number;
  previousPerformance?: ExerciseHistory | null;
  onJumpToSet: (index: number) => void;
  onAddSet: () => void;
}

export const SetList: React.FC<SetListProps> = React.memo(
  ({ sets, currentSetIndex, previousPerformance, onJumpToSet, onAddSet }) => {
    return (
      <section aria-label="All sets">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-body-sm font-semibold text-ink">All sets</h4>
          <Button variant="ghost" size="sm" onClick={onAddSet}>
            <Plus size={16} aria-hidden="true" />
            <span>Add set</span>
          </Button>
        </div>

        <div
          aria-hidden="true"
          className="grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-2 px-3 pb-1 text-caption text-ink-subtle"
        >
          <span>Set</span>
          <span>Last time</span>
          <span>Reps</span>
          <span>Weight</span>
        </div>

        <ul className="divide-y divide-hairline">
          {sets.map((set, index) => {
            const previousSet = previousPerformance?.sets?.[index];
            const previousDisplay = previousSet
              ? `${previousSet.actualReps} × ${previousSet.weight}`
              : '–';
            const isCurrent = index === currentSetIndex;

            return (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => onJumpToSet(index)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Set ${index + 1}${set.completed ? ', done' : ''}${isCurrent ? ', current' : ''}`}
                  className={cn(
                    'grid min-h-touch-min w-full grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2 rounded-xl px-3 text-left font-num font-tabular text-body-sm transition-colors duration-snap',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isCurrent
                      ? 'bg-surface-raised text-ink'
                      : set.completed
                        ? 'text-ink hover:bg-surface-raised/50'
                        : 'text-ink-muted hover:bg-surface-raised/50',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center gap-1 font-bold',
                      isCurrent ? 'text-accent' : set.completed ? 'text-accent-2' : undefined,
                    )}
                  >
                    {set.completed && !isCurrent ? (
                      <Check size={14} strokeWidth={3} aria-hidden="true" />
                    ) : null}
                    {index + 1}
                  </span>
                  <span className="text-caption text-ink-subtle">{previousDisplay}</span>
                  <span>{set.reps || '–'}</span>
                  <span>{set.weight ? `${set.weight} lb` : '–'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  },
);
SetList.displayName = 'SetList';
