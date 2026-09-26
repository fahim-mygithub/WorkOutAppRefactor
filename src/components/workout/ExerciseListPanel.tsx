// ExerciseListPanel — the side-panel list of all exercises / superset groups in
// the active workout. Each row jumps to that exercise; an edit affordance opens
// the set editor. Extracted from WorkoutPage; the grouping logic is computed by
// the parent and passed in as `groups`. Memoized so the per-second duration tick
// (and other unrelated parent renders) don't re-render this list.
import React from 'react';
import { Edit } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import type { WorkoutExercise } from '../../types/exercise';

export interface ExerciseDisplayGroup {
  id: string;
  name: string;
  isSuperset: boolean;
  exercises: WorkoutExercise[];
  totalSets: number;
  completedSets: number;
  isActive: boolean;
}

interface ExerciseListPanelProps {
  groups: ExerciseDisplayGroup[];
  exercises: WorkoutExercise[];
  onJumpToExercise: (exerciseIndex: number) => void;
  onEditExercise: (exercise: WorkoutExercise) => void;
}

export const ExerciseListPanel: React.FC<ExerciseListPanelProps> = React.memo(
  ({ groups, exercises, onJumpToExercise, onEditExercise }) => {
    return (
      <Card elevation={1} className="p-4">
        <h3 className="mb-2 px-1 text-body-sm font-semibold text-ink-muted">Exercises</h3>
        <ul className="divide-y divide-hairline">
          {groups.map((group) => {
            const exerciseIndex = group.isSuperset
              ? exercises.findIndex((ex) => ex.supersetId === group.id)
              : exercises.findIndex((ex) => ex.id === group.id);
            const done = group.totalSets > 0 && group.completedSets === group.totalSets;

            return (
              <li key={group.id} className="flex items-center gap-1 py-1">
                <button
                  type="button"
                  onClick={() =>
                    exerciseIndex !== -1 && onJumpToExercise(exerciseIndex)
                  }
                  aria-current={group.isActive ? 'step' : undefined}
                  className={cn(
                    'flex min-h-touch-min flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-snap',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    group.isActive ? 'bg-surface-raised' : 'hover:bg-surface-raised/50',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      group.isActive ? 'bg-accent' : done ? 'bg-accent-2' : 'bg-surface-raised',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-body font-semibold leading-tight',
                        group.isActive ? 'text-ink' : 'text-ink-muted',
                      )}
                    >
                      {group.name}
                    </span>
                    <span className="block text-caption text-ink-muted">
                      <span className="font-num font-tabular">{group.completedSets}</span> of{' '}
                      <span className="font-num font-tabular">{group.totalSets}</span> sets
                      {group.isSuperset && (
                        <>
                          {' '}· superset of{' '}
                          <span className="font-num font-tabular">{group.exercises.length}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>

                <IconButton
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditExercise(group.exercises[0]);
                  }}
                  aria-label={`Edit ${group.name}`}
                  title="Edit exercise"
                >
                  <Edit className="h-4 w-4" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  },
);
ExerciseListPanel.displayName = 'ExerciseListPanel';
