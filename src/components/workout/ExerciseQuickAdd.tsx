import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { Exercise } from '../../types/exercise';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** The builder's entry for a newly added exercise: one set of 10, 2 min rest. */
export function newBuilderExercise(exercise: Exercise) {
  return { name: exercise.name, sets: [{ reps: 10, rest: 120 }] };
}

interface ExerciseQuickAddProps {
  onAdd: (exercise: Exercise) => void;
  /** Visible label; omitted → the input is labelled for screen readers only. */
  label?: string;
  id?: string;
}

/**
 * ExerciseQuickAdd — a pill search over the exercise library with the top five
 * matches in a dropdown; picking one calls `onAdd` and clears the search.
 */
export const ExerciseQuickAdd: React.FC<ExerciseQuickAddProps> = ({
  onAdd,
  label,
  id = 'exercise-quick-add',
}) => {
  const { exercises } = useAppSelector((state) => state.exercise);
  const [searchTerm, setSearchTerm] = useState('');

  const matches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return exercises
      .filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(term) ||
          exercise.muscleGroup.toLowerCase().includes(term) ||
          exercise.equipment.toLowerCase().includes(term),
      )
      .slice(0, 5);
  }, [exercises, searchTerm]);

  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={id} className="text-ink-muted">
          {label}
        </Label>
      )}
      <div className="relative z-10">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        />
        <Input
          id={id}
          type="text"
          placeholder="Search exercises to add"
          aria-label={label ? undefined : 'Add exercises'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-full pl-11"
        />

        {matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-2 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface-raised">
            {matches.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(exercise);
                    setSearchTerm('');
                  }}
                  className="flex min-h-touch-min w-full items-center gap-3 px-4 py-2 text-left text-body-sm text-ink transition-colors duration-snap hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                >
                  <Plus className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{exercise.name}</span>
                    <span className="block truncate text-caption text-ink-muted">
                      {exercise.muscleGroup}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
