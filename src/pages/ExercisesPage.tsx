import { useState, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  searchExercises,
  filterByMuscleGroup,
  filterByMuscle,
  setSelectedExercise,
} from '../store/slices/exerciseSlice';
import {
  selectCustomExercises,
  selectIsLoadingCustomExercises,
  deleteCustomExercise,
  loadCustomExercises,
} from '../store/slices/customExerciseSlice';
import { ExerciseHueDot } from '../components/ExerciseThumbnail';
import { CustomExerciseBadge } from '../components/workout/CustomExerciseBadge';
import { Exercise } from '../types/exercise';
import { type CustomExercise } from '../services/customExerciseService';
import { useExercises } from '../hooks/useExercises';
import { ALL_MUSCLE_TERMS } from '../lib/muscleTerms';
import { Skeleton } from '../components/ui/skeleton';
import { IconButton } from '../components/ui/icon-button';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { cn } from '../lib/utils';
import { LibraryMediaClip } from '../components/library/LibraryMediaClip';
import { CustomExerciseSheet } from '../components/library/CustomExerciseSheet';

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
 * detail (video/media + instructions) in a sheet.
 *
 * Includes:
 * - "My exercises" filter for user-created / AI-created exercises with media
 * - Create & edit custom exercises with media attachment
 * - Search fallback to offer creating a custom exercise prefilled with the query
 */
export default function ExercisesPage() {
  const dispatch = useAppDispatch();
  useExercises();

  const { filteredExercises, exercises, selectedExercise, isLoading, error } = useAppSelector(
    (state) => state.exercise,
  );
  const customExercises = useAppSelector(selectCustomExercises);
  const isLoadingCustom = useAppSelector(selectIsLoadingCustomExercises);
  const userId = useAppSelector((state) => state.user?.profile?.uid);

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMuscle, setActiveMuscle] = useState(() => searchParams.get('muscle') ?? '');
  const [isMyExercisesFilter, setIsMyExercisesFilter] = useState(() => searchParams.get('tab') === 'my');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Custom exercise modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCustomExercise, setEditingCustomExercise] = useState<CustomExercise | null>(null);
  const [prefillExerciseName, setPrefillExerciseName] = useState('');

  // Load custom exercises on mount if user is signed in
  useEffect(() => {
    if (userId) {
      dispatch(loadCustomExercises(userId));
    }
  }, [userId, dispatch]);

  // Deep-link support: ?muscle=<name> and ?tab=my
  useEffect(() => {
    const muscle = searchParams.get('muscle') ?? '';
    const tab = searchParams.get('tab') ?? '';
    if (tab === 'my') {
      setIsMyExercisesFilter(true);
      setActiveMuscle('');
    } else {
      setIsMyExercisesFilter(false);
      setActiveMuscle(muscle);
      if (muscle && exercises.length > 0) {
        setSearchTerm('');
        setVisibleCount(PAGE_SIZE);
        dispatch(filterByMuscle(muscle));
      }
    }
  }, [searchParams, exercises, dispatch]);

  const clearMuscleParam = () => {
    if (!activeMuscle) return;
    setActiveMuscle('');
    if (!isMyExercisesFilter) {
      setSearchParams({}, { replace: true });
    }
  };

  const clearMuscleFilter = () => {
    setActiveMuscle('');
    setIsMyExercisesFilter(false);
    setSearchParams({}, { replace: true });
    setSearchTerm('');
    setVisibleCount(PAGE_SIZE);
    dispatch(filterByMuscleGroup('all'));
  };

  const selectMuscle = (term: string) => {
    setIsMyExercisesFilter(false);
    if (term.toLowerCase() === activeMuscle.toLowerCase()) {
      clearMuscleFilter();
      return;
    }
    setSearchParams({ muscle: term }, { replace: true });
  };

  const selectMyExercises = () => {
    setActiveMuscle('');
    setSearchTerm('');
    setVisibleCount(PAGE_SIZE);
    setIsMyExercisesFilter(true);
    setSearchParams({ tab: 'my' }, { replace: true });
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

  const isCustomExercise = (exerciseId: string) => {
    return customExercises.some((custom) => custom.id === exerciseId || exerciseId.startsWith('custom-'));
  };

  const getCustomExerciseData = (exerciseId: string): CustomExercise | undefined => {
    return customExercises.find((c) => c.id === exerciseId);
  };

  const openCreateModal = (prefill = '') => {
    setEditingCustomExercise(null);
    setPrefillExerciseName(prefill);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (exercise: CustomExercise) => {
    setEditingCustomExercise(exercise);
    setPrefillExerciseName('');
    setIsCreateModalOpen(true);
  };

  const handleDeleteCustomExercise = async (id: string) => {
    if (!userId) return;
    await dispatch(deleteCustomExercise({ userId, exerciseId: id }));
    dispatch(setSelectedExercise(null));
  };

  // Filter custom exercises when "My exercises" filter is active
  const filteredCustomExercises = isMyExercisesFilter
    ? customExercises.filter((ex) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          ex.name.toLowerCase().includes(q) ||
          ex.muscleGroup.toLowerCase().includes(q) ||
          ex.equipment.toLowerCase().includes(q)
        );
      })
    : [];

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
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-body-sm text-ink-muted">
              {isLoading ? 'Loading exercises' : `${exercises.length.toLocaleString()} exercises`}
            </p>
            <h1 className="mt-1 font-display text-display text-ink">Library</h1>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openCreateModal()}
            className="mt-2"
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            New
          </Button>
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

        {/* Filter chips: "All", "My exercises", and muscle groups */}
        <div
          role="group"
          aria-label="Filter exercises"
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <FilterChip
            selected={!activeMuscle && !isMyExercisesFilter}
            onClick={clearMuscleFilter}
          >
            All
          </FilterChip>
          <FilterChip
            selected={isMyExercisesFilter}
            onClick={selectMyExercises}
          >
            My exercises {customExercises.length > 0 && `(${customExercises.length})`}
          </FilterChip>
          {chipTerms.map((term) => (
            <FilterChip
              key={term}
              selected={!isMyExercisesFilter && term.toLowerCase() === activeMuscle.toLowerCase()}
              onClick={() => selectMuscle(term)}
            >
              {term}
            </FilterChip>
          ))}
        </div>

        {/* Content Section: My Exercises Tab */}
        {isMyExercisesFilter ? (
          isLoadingCustom ? (
            <div aria-busy="true" className="mt-4 overflow-hidden rounded-[20px] bg-surface-subtle">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={i > 0 ? 'border-t border-hairline' : undefined}>
                  <ExerciseRowSkeleton />
                </div>
              ))}
            </div>
          ) : filteredCustomExercises.length === 0 ? (
            <div className="mt-10 rounded-[20px] bg-surface-subtle px-5 py-8 text-center">
              <p className="text-body font-semibold text-ink">
                {searchTerm ? 'No custom exercises match' : 'No custom exercises yet'}
              </p>
              <p className="mt-1 text-body-sm text-ink-muted">
                {searchTerm
                  ? 'Try a different search or create a new custom exercise.'
                  : 'Add your own exercises with custom photos, GIFs, or videos.'}
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-4"
                onClick={() => openCreateModal(searchTerm)}
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Create custom exercise
              </Button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-2 px-1 text-body-sm text-ink-muted" aria-live="polite">
                {filteredCustomExercises.length}{' '}
                {filteredCustomExercises.length === 1 ? 'custom exercise' : 'custom exercises'}
              </p>

              <div className="space-y-4">
                {filteredCustomExercises.map((custom) => {
                  const mediaUrl = custom.videoLinks?.[0];
                  return (
                    <div
                      key={custom.id}
                      className="overflow-hidden rounded-2xl bg-surface-subtle p-4 transition-colors hover:bg-surface-raised/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <ExerciseHueDot muscleGroup={custom.muscleGroup} />
                            <h3 className="truncate text-body font-semibold text-ink">
                              {custom.name}
                            </h3>
                            <CustomExerciseBadge size="sm" className="shrink-0" />
                          </div>
                          <p className="mt-0.5 text-body-sm text-ink-muted">
                            {custom.muscleGroup} · {custom.equipment} · {custom.difficulty}
                          </p>
                          {custom.notes && (
                            <p className="mt-1 text-caption text-ink-subtle line-clamp-2">
                              {custom.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(custom)}
                          className="shrink-0"
                        >
                          <Edit3 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                      </div>

                      {/* Attached media display */}
                      {mediaUrl && (
                        <div className="mt-3 max-w-sm overflow-hidden rounded-xl">
                          <LibraryMediaClip url={mediaUrl} alt={custom.name} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : isLoading ? (
          <div aria-busy="true" className="mt-4 overflow-hidden rounded-[20px] bg-surface-subtle">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={i > 0 ? 'border-t border-hairline' : undefined}>
                <ExerciseRowSkeleton />
              </div>
            ))}
          </div>
        ) : filteredExercises.length === 0 ? (
          /* Empty Search Results: offer to create custom exercise prefilled with searchTerm */
          <div className="mt-10 rounded-[20px] bg-surface-subtle px-5 py-8 text-center">
            <p className="text-body font-semibold text-ink">No exercises match</p>
            <p className="mt-1 text-body-sm text-ink-muted">
              {searchTerm
                ? `Couldn't find anything matching "${searchTerm}".`
                : 'Try a shorter search or another muscle.'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {searchTerm && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openCreateModal(searchTerm)}
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Create custom exercise
                </Button>
              )}
              {(searchTerm || activeMuscle) && (
                <Button variant="secondary" size="md" onClick={clearMuscleFilter}>
                  Show all exercises
                </Button>
              )}
            </div>
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
                          <span className="truncate text-body font-semibold text-ink">
                            {exercise.name}
                          </span>
                          {isCustomExercise(exercise.id) && (
                            <CustomExerciseBadge size="sm" className="shrink-0" />
                          )}
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
          <SheetContent className="mx-auto max-w-2xl overflow-y-auto">
            {selectedExercise && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="break-words text-title font-display">
                        {selectedExercise.name}
                      </SheetTitle>
                      <SheetDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ExerciseHueDot muscleGroup={selectedExercise.muscleGroup} />
                        <span>{selectedExercise.muscleGroup}</span>
                      </SheetDescription>
                    </div>
                    {isCustomExercise(selectedExercise.id) && (
                      <div className="flex items-center gap-2">
                        <CustomExerciseBadge size="md" className="shrink-0" />
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label="Edit exercise"
                          onClick={() => {
                            const c = getCustomExerciseData(selectedExercise.id);
                            if (c) {
                              dispatch(setSelectedExercise(null));
                              openEditModal(c);
                            }
                          }}
                        >
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          aria-label="Delete exercise"
                          onClick={() => void handleDeleteCustomExercise(selectedExercise.id)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                        </IconButton>
                      </div>
                    )}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface-raised px-4 py-3">
                    <dt className="text-body-sm text-ink-muted">Equipment</dt>
                    <dd className="mt-0.5 text-body font-semibold text-ink">
                      {selectedExercise.equipment || 'None'}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-surface-raised px-4 py-3">
                    <dt className="text-body-sm text-ink-muted">Difficulty</dt>
                    <dd className="mt-0.5 text-body font-semibold text-ink">
                      {selectedExercise.difficulty}
                    </dd>
                  </div>
                </dl>

                {/* Media display using LibraryMediaClip */}
                {selectedExercise.videoLinks && selectedExercise.videoLinks.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedExercise.videoLinks.slice(0, 2).map((url, idx) => (
                      <LibraryMediaClip
                        key={idx}
                        url={url}
                        alt={`${selectedExercise.name} demo ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}

                {selectedExercise.instructions && selectedExercise.instructions.length > 0 && (
                  <section aria-labelledby="exercise-instructions-heading">
                    <h3
                      id="exercise-instructions-heading"
                      className="mb-3 text-body font-semibold text-ink"
                    >
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

        {/* Custom exercise create / edit sheet */}
        <CustomExerciseSheet
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          exercise={editingCustomExercise}
          prefillName={prefillExerciseName}
        />
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
