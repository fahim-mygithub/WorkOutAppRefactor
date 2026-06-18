// SetList — the "All Sets" overview grid shared by the single-exercise card and
// the superset card. Renders one tappable row per set (set #, previous best,
// reps, weight) with current/completed/pending styling, plus an "Add Set"
// action. Pure presentation + callbacks; no Redux. Memoized so a parent
// re-render (e.g. the duration tick before isolation, or progression updates)
// does not re-render the rows unless their inputs actually change.
import React from 'react';
import { Plus } from 'lucide-react';
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-marker text-title text-ink">
            <span className="marker-underline">All sets</span>
          </h4>
          <button
            type="button"
            onClick={onAddSet}
            className="flex items-center gap-1 font-marker tracking-wide text-accent transition-colors duration-snap hover:text-accent/80"
          >
            <Plus className="h-4 w-4" />
            <span className="text-body-sm">Add set</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 font-marker text-caption uppercase tracking-wide text-ink-subtle">
          <span>Set</span>
          <span>Prev</span>
          <span>Reps</span>
          <span>Weight</span>
        </div>

        {sets.map((set, index) => {
          const previousSet = previousPerformance?.sets?.[index];
          const previousDisplay = previousSet
            ? `${previousSet.actualReps}×${previousSet.weight}`
            : '-';
          const isCurrent = index === currentSetIndex;

          return (
            <div
              key={set.id}
              onClick={() => onJumpToSet(index)}
              className={cn(
                'grid grid-cols-4 gap-2 rounded-md p-2 text-body-sm cursor-pointer transition-all duration-snap hover:ring-2 hover:ring-accent/60',
                isCurrent
                  ? 'bg-accent text-accent-fg shadow-e1'
                  : set.completed
                    ? 'bg-success text-ink-inverse'
                    : 'bg-surface-subtle text-ink-muted',
              )}
            >
              <span className="font-num font-tabular font-bold">
                {index + 1}
              </span>
              <span className="font-num font-tabular text-caption">
                {previousDisplay}
              </span>
              <span className="font-num font-tabular">{set.reps || '-'}</span>
              <span className="font-num font-tabular">
                {set.weight ? `${set.weight} lbs` : '-'}
              </span>
              {isCurrent && (
                <div className="col-span-4 mt-1 text-center font-marker text-caption opacity-90">
                  Current set
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
SetList.displayName = 'SetList';
