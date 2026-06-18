// ExerciseListPanel — the side-panel list of all exercises / superset groups in
// the active workout. Each row jumps to that exercise; an edit affordance opens
// the set editor. Extracted from WorkoutPage; the grouping logic is computed by
// the parent and passed in as `groups`. Memoized so the per-second duration tick
// (and other unrelated parent renders) don't re-render this list.
import React from 'react';
import { Edit } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
        <h3 className="mb-3 font-marker text-title text-ink">
          <span className="marker-underline">Exercises</span>
        </h3>
        <div className="space-y-2">
          {groups.map((group) => {
            const exerciseIndex = group.isSuperset
              ? exercises.findIndex((ex) => ex.supersetId === group.id)
              : exercises.findIndex((ex) => ex.id === group.id);

            return (
              <div
                key={group.id}
                className={cn(
                  'rounded-md text-body-sm transition-all duration-snap',
                  group.isActive
                    ? 'bg-accent text-accent-fg shadow-e1 ring-2 ring-accent/60'
                    : 'bg-surface-subtle text-ink-muted',
                )}
              >
                <div className="flex">
                  <button
                    type="button"
                    onClick={() =>
                      exerciseIndex !== -1 && onJumpToExercise(exerciseIndex)
                    }
                    className="flex-1 p-3 text-left transition-all duration-snap hover:opacity-90"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-marker text-body leading-tight">
                          {group.name}
                        </p>
                        <p className="text-caption opacity-75">
                          <span className="font-num font-tabular">
                            {group.completedSets}
                          </span>{' '}
                          /{' '}
                          <span className="font-num font-tabular">
                            {group.totalSets}
                          </span>{' '}
                          sets
                        </p>
                        {group.isSuperset && (
                          <p className="mt-1 text-caption opacity-60">
                            Superset (
                            <span className="font-num font-tabular">
                              {group.exercises.length}
                            </span>{' '}
                            exercises)
                          </p>
                        )}
                      </div>
                      {group.isActive && (
                        <div className="ml-2 flex-shrink-0">
                          <span className="block h-2 w-2 animate-pulse rounded-full bg-accent-fg" />
                        </div>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditExercise(group.exercises[0]);
                    }}
                    className={cn(
                      'border-l p-3 transition-colors duration-snap',
                      group.isActive
                        ? 'border-accent-fg/30 hover:bg-accent/80'
                        : 'border-border hover:bg-surface',
                    )}
                    title="Edit exercise"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  },
);
ExerciseListPanel.displayName = 'ExerciseListPanel';
