import { useState, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { searchExercises, filterByMuscleGroup, filterByMuscle, setSelectedExercise } from '../store/slices/exerciseSlice';
import { ExerciseVideo } from '../components/ExerciseVideo';
import { CustomExerciseBadge } from '../components/workout/CustomExerciseBadge';
import { Exercise } from '../types/exercise';
import { selectCustomExercises } from '../store/slices/customExerciseSlice';
import { useExercises } from '../hooks/useExercises';
import { ALL_MUSCLE_TERMS } from '../lib/muscleTerms';
import { ExerciseHueDot } from '../components/ExerciseThumbnail';
import { Skeleton } from '../components/ui/skeleton';
import { IconButton } from '../components/ui/icon-button';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { cn } from '../lib/utils';

// Rows render in pages of this size; "Show more" appends the next page so the
// list stays scannable without page-number chrome.
const PAGE_SIZE = 40;

function ExerciseRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="h-2.5 w-2.5 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

/**
 * Library (Tempo): a raised search pill, one scrolling row of muscle filter
 * chips, and the catalog as hairline-separated rows on a subtle card. Each row
 * is a hue dot, the name, and a muted muscles/equipment line; tapping opens the
 * detail (video + instructions) in a sheet.
 *
 * Muscle chips share the Home body map's vocabulary and drive the same
 * `?muscle=` deep link, so arriving from the map and tapping a chip are one path.
 */
export default function ExercisesPage() {
  const dispatch = useAppDispatch();
  // Trigger the lazy exercise-database load for this route. Previously the
  // Directory free-rode on the eager useExercises() call in AppRouter; that
  // root call was removed for cold-start perf, so the load now lives here.
  // The hook's return is unused: this page reads state.exercise via selector.
  useExercises();
  const { filteredExercises, exercises, selectedExercise, isLoading, error } = useAppSelector((state) => state.exercise);
  const customExercises = useAppSelector(selectCustomExercises);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMuscle, setActiveMuscle] = useState(() => searchParams.get('muscle') ?? '');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Deep-link support: the Home body map (and the chips below) navigate here
  // with ?muscle=<name>. Apply the substring muscle filter once the exercise
  // database has loaded (and whenever the param changes). The search term is
  // reset so the muscle filter is the sole active criterion on arrival.
  useEffect(() => {
    const muscle = searchParams.get('muscle') ?? '';
    setActiveMuscle(muscle);
    // Re-apply whenever the exercise list changes (the database loads async, so
    // the first run usually sees an empty list — depending on `exercises` rather
    // than a one-shot flag ensures the filter lands once the data arrives).
    if (muscle && exercises.length > 0) {
      setSearchTerm('');
      setVisibleCount(PAGE_SIZE);
      dispatch(filterByMuscle(muscle));
    }
  }, [searchParams, exercises, dispatch]);

  // Dropping the muscle deep-link when the user searches keeps the selected
  // chip honest (search and muscle filter are separate criteria in the store).
  const clearMuscleParam = () => {
    if (!activeMuscle) return;
    setActiveMuscle('');
    setSearchParams({}, { replace: true });
  };

  const clearMuscleFilter = () => {
    clearMuscleParam();
    setSearchTerm('');
    setVisibleCount(PAGE_SIZE);
    dispatch(filterByMuscleGroup('all'));
  };

  const selectMuscle = (term: string) => {
    if (term.toLowerCase() === activeMuscle.toLowerCase()) {
      clearMuscleFilter();
      return;
    }
    setSearchParams({ muscle: term }, { replace: true });
  };

  // Helper to check if an exercise is custom
  const isCustomExercise = (exerciseId: string) => {
    return customExercises.some(custom => custom.id === exerciseId || exerciseId.startsWith('custom-'));
  };

  const handleSearch = (term: string) => {
    clearMuscleParam();
    setSearchTerm(term);
    setVisibleCount(PAGE_SIZE);
    dispatch(searchExercises(term));
  };

  const handleExerciseClick = (exercise: Exercise) => {
    dispatch(setSelectedExercise(exercise));
  };

  // A deep-linked muscle outside the chip vocabulary still gets a chip, first.
  const chipTerms =
    activeMuscle && !ALL_MUSCLE_TERMS.some((t) => t.toLowerCase() === activeMuscle.toLowerCase())
      ? [activeMuscle, ...ALL_MUSCLE_TERMS]
      : ALL_MUSCLE_TERMS;

  const visibleExercises = filteredExercises.slice(0, visibleCount);
  const remaining = filteredExercises.length - visibleExercises.length;

  if (error) {
    return (
      <div className="min-h-full bg-surface px-4 pb-8 pt-6">
        <h1 className="font-display text-display text-ink">Library</h1>
        <p className="mt-3 max-w-[34ch] text-body text-ink-muted">
          The exercise list didn't load. Check your connection and reopen this tab.
        </p>
        <p className="mt-2 text-body-sm text-ink-subtle">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-4 pb-8 pt-6">
      <div className="mx-auto max-w-2xl">
        <header>
          <p className="text-body-sm text-ink-muted">
            {isLoading ? 'Loading exercises' : `${exercises.length.toLocaleString()} exercises`}
          </p>
          <h1 className="mt-1 font-display text-display text-ink">Library</h1>
        </header>

        <div className="relative mt-5">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            type="search"
            placeholder="Search exercises"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search exercises"
            className="h-touch-lg w-full rounded-full bg-surface-raised pl-11 pr-12 text-body text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&::-webkit-search-cancel-button]:hidden"
          />
          {searchTerm && (
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Clear search"
              onClick={() => handleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X size={16} aria-hidden="true" />
            </IconButton>
          )}
        </div>

        {/* Muscle filter chips: one horizontally scrolling row, bled to the
            screen edge so the row reads as scrollable. */}
        <div
          role="group"
          aria-label="Filter by muscle"
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <FilterChip selected={!activeMuscle} onClick={clearMuscleFilter}>
            All
          </FilterChip>
          {chipTerms.map((term) => (
            <FilterChip
              key={term}
              selected={term.toLowerCase() === activeMuscle.toLowerCase()}
              onClick={() => selectMuscle(term)}
            >
              {term}
            </FilterChip>
          ))}
        </div>

        {isLoading ? (
          <div aria-busy="true" className="mt-4 overflow-hidden rounded-[20px] bg-surface-subtle">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={i > 0 ? 'border-t border-hairline' : undefined}>
                <ExerciseRowSkeleton />
              </div>
            ))}
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-body text-ink">No exercises match</p>
            <p className="mt-1 text-body-sm text-ink-muted">Try a shorter search or another muscle.</p>
            {(searchTerm || activeMuscle) && (
              <Button variant="secondary" size="md" className="mt-4" onClick={clearMuscleFilter}>
                Show all exercises
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2 mt-4 px-1 text-body-sm text-ink-muted" aria-live="polite">
              {activeMuscle || searchTerm
                ? `${filteredExercises.length.toLocaleString()} ${filteredExercises.length === 1 ? 'match' : 'matches'}`
                : 'All exercises'}
            </p>

            <ul className="overflow-hidden rounded-[20px] bg-surface-subtle">
              {visibleExercises.map((exercise, i) => {
                return (
                  <li key={exercise.id} className={i > 0 ? 'border-t border-hairline' : undefined}>
                    <button
                      type="button"
                      onClick={() => handleExerciseClick(exercise)}
                      className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <ExerciseHueDot muscleGroup={exercise.muscleGroup} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body font-semibold text-ink">{exercise.name}</span>
                          {isCustomExercise(exercise.id) && <CustomExerciseBadge size="sm" className="shrink-0" />}
                        </span>
                        <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                          {exercise.muscleGroup}
                          {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                        </span>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {remaining > 0 && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Show more
                </Button>
                <p className="text-body-sm text-ink-subtle">
                  <span className="font-num font-tabular">{visibleExercises.length.toLocaleString()}</span> of{' '}
                  <span className="font-num font-tabular">{filteredExercises.length.toLocaleString()}</span>
                </p>
              </div>
            )}
          </>
        )}

        {/* Exercise detail sheet */}
        <Sheet
          open={!!selectedExercise}
          onOpenChange={(open) => {
            if (!open) dispatch(setSelectedExercise(null));
          }}
        >
          <SheetContent className="mx-auto max-w-2xl">
            {selectedExercise && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-start gap-3">
                    <SheetTitle className="min-w-0 flex-1 break-words text-title font-display">
                      {selectedExercise.name}
                    </SheetTitle>
                    {isCustomExercise(selectedExercise.id) && (
                      <CustomExerciseBadge size="md" className="mt-1 shrink-0" />
                    )}
                  </div>
                  <SheetDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <ExerciseHueDot muscleGroup={selectedExercise.muscleGroup} />
                    <span>{selectedExercise.muscleGroup}</span>
                  </SheetDescription>
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface-raised px-4 py-3">
                    <dt className="text-body-sm text-ink-muted">Equipment</dt>
                    <dd className="mt-0.5 text-body font-semibold text-ink">{selectedExercise.equipment || 'None'}</dd>
                  </div>
                  <div className="rounded-2xl bg-surface-raised px-4 py-3">
                    <dt className="text-body-sm text-ink-muted">Difficulty</dt>
                    <dd className="mt-0.5 text-body font-semibold text-ink">{selectedExercise.difficulty}</dd>
                  </div>
                </dl>

                {selectedExercise.videoLinks.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedExercise.videoLinks.slice(0, 2).map((videoUrl, index) => (
                      <ExerciseVideo
                        key={index}
                        videoUrl={videoUrl}
                        exerciseName={`${selectedExercise.name} - ${index === 0 ? 'Front' : 'Side'} View`}
                        autoPlay={index === 0}
                        muted={true}
                        fallbackVideoUrls={selectedExercise.videoLinks.slice(index + 1)}
                        instructions={selectedExercise.instructions}
                      />
                    ))}
                  </div>
                )}

                {selectedExercise.instructions.length > 0 && (
                  <section aria-labelledby="exercise-instructions-heading">
                    <h3 id="exercise-instructions-heading" className="mb-3 text-body font-semibold text-ink">
                      How to do it
                    </h3>
                    <ol className="space-y-3">
                      {selectedExercise.instructions.map((instruction, index) => (
                        <li key={index} className="flex gap-3 text-body text-ink-muted">
                          <span
                            aria-hidden="true"
                            className="w-5 shrink-0 text-right font-num font-tabular font-bold text-ink"
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0">{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-touch-min shrink-0 whitespace-nowrap rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        selected
          ? 'bg-accent-2 text-accent-2-fg'
          : 'bg-surface-raised text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
