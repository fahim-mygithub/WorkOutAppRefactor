import React, { useEffect, useMemo, useState } from 'react';
import { Check, Dumbbell, Plus, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setExercises } from '../../store/slices/exerciseSlice';
import { loadExercises } from '../../utils/loadExercises';
import { transformVideoUrl } from '../../utils/videoHelpers';
import type { Exercise } from '../../types/exercise';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** The builder's entry for a newly added exercise: one set of 10, 2 min rest. */
export function newBuilderExercise(exercise: Exercise) {
  return { name: exercise.name, sets: [{ reps: 10, rest: 120 }] };
}

const NO_EXERCISES: Exercise[] = [];

/**
 * The exercise library from the store, loading it once if nothing has yet.
 * Needs no auth context, so it works inside sheets and bare test stores.
 */
export function useExerciseLibrary(): Exercise[] {
  const dispatch = useAppDispatch();
  const hasSlice = useAppSelector((s) => Boolean(s.exercise));
  const exercises = useAppSelector((s) => s.exercise?.exercises ?? NO_EXERCISES);
  const lastUpdated = useAppSelector((s) => s.exercise?.lastUpdated);

  useEffect(() => {
    if (!hasSlice || exercises.length > 0 || lastUpdated) return;
    let cancelled = false;
    loadExercises().then((loaded) => {
      if (!cancelled && loaded.length > 0) dispatch(setExercises(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, hasSlice, exercises.length, lastUpdated]);

  return exercises;
}

/**
 * A small still of the exercise: the first frame of its front-view clip (the
 * `#t=0.1` fragment seeks past the black lead-in frame). A glyph sits behind it
 * and the frame fades in once decoded, so a slow or undecodable clip degrades
 * to the placeholder instead of a black box. Metadata-only preload keeps five
 * open rows cheap.
 */
function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const [loaded, setLoaded] = useState(false);
  const raw = exercise.videoLinks?.[0];
  const url = raw ? transformVideoUrl(raw) : '';

  return (
    <span
      aria-hidden="true"
      className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-subtle"
    >
      <Dumbbell className="h-5 w-5 text-ink-subtle" />
      {url && (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onLoadedData={() => setLoaded(true)}
          className={
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-smooth ' +
            (loaded ? 'opacity-100' : 'opacity-0')
          }
        />
      )}
    </span>
  );
}

interface ExerciseQuickAddProps {
  onAdd: (exercise: Exercise) => void;
  /** Visible label; omitted → the input is labelled for screen readers only. */
  label?: string;
  id?: string;
  /**
   * Controlled text. When set, the field is a name input with suggestions:
   * typing reports through `onValueChange`, and a pick keeps its text (the
   * parent sets it from `onAdd`) instead of clearing.
   */
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

/**
 * ExerciseQuickAdd — a pill search over the exercise library with the top five
 * matches in a dropdown. Uncontrolled, picking one calls `onAdd` and clears the
 * search; controlled (`value`), it doubles as a free-text name field.
 */
export const ExerciseQuickAdd: React.FC<ExerciseQuickAddProps> = ({
  onAdd,
  label,
  id = 'exercise-quick-add',
  value,
  onValueChange,
  placeholder = 'Search exercises to add',
}) => {
  const exercises = useExerciseLibrary();
  const controlled = value !== undefined;
  const [localTerm, setLocalTerm] = useState('');
  const searchTerm = controlled ? value : localTerm;
  // Opens on focus/typing, closes on blur, Escape or (controlled) a pick.
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    const words = term.split(/\s+/);
    // Rank: name starts with the search, name contains it, name has every
    // word (any order), then muscle/equipment hits; shorter names first.
    const rank = (exercise: Exercise): number => {
      const name = exercise.name.toLowerCase();
      if (name.startsWith(term)) return 0;
      if (name.includes(term)) return 1;
      if (words.every((w) => name.includes(w))) return 2;
      if (
        exercise.muscleGroup.toLowerCase().includes(term) ||
        exercise.equipment.toLowerCase().includes(term)
      ) {
        return 3;
      }
      return -1;
    };
    return exercises
      .map((exercise) => ({ exercise, r: rank(exercise) }))
      .filter((m) => m.r >= 0)
      .sort((a, b) => a.r - b.r || a.exercise.name.length - b.exercise.name.length)
      .slice(0, 5)
      .map((m) => m.exercise);
  }, [exercises, searchTerm]);

  const setTerm = (next: string) => {
    if (controlled) onValueChange?.(next);
    else setLocalTerm(next);
    setOpen(true);
  };

  const pick = (exercise: Exercise) => {
    onAdd(exercise);
    if (controlled) setOpen(false);
    else setLocalTerm('');
  };

  const listId = `${id}-results`;
  const showList = open && matches.length > 0;
  const PickIcon = controlled ? Check : Plus;

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
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          autoComplete="off"
          placeholder={placeholder}
          aria-label={label ? undefined : 'Add exercises'}
          value={searchTerm}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          className="rounded-full pl-11"
        />

        {showList && (
          <ul
            id={listId}
            className="absolute left-0 right-0 top-full z-50 mt-2 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface-raised"
          >
            {matches.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  // Keep focus in the input so its blur doesn't close the list first.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(exercise)}
                  className="flex min-h-touch-min w-full items-center gap-3 px-4 py-2.5 text-left text-body-sm text-ink transition-colors duration-snap hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                >
                  <ExerciseThumb exercise={exercise} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{exercise.name}</span>
                    <span className="block truncate text-caption text-ink-muted">
                      {exercise.muscleGroup}
                    </span>
                  </span>
                  <PickIcon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
