import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { searchExercises, filterByMuscleGroup, filterByMuscle, setSelectedExercise } from '../store/slices/exerciseSlice';
import { ExerciseVideo } from '../components/ExerciseVideo';
import { CustomExerciseBadge } from '../components/workout/CustomExerciseBadge';
import { Exercise } from '../types/exercise';
import { selectCustomExercises } from '../store/slices/customExerciseSlice';
import { scrollAppToTop } from '../lib/scroll';
import { useExercises } from '../hooks/useExercises';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Card, CardBody } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { IconButton } from '../components/ui/icon-button';
import { Button } from '../components/ui/button';
import { Stack } from '../components/ui/stack';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';

// Difficulty labels map onto semantic state tokens so the same hue language is
// reused everywhere (no raw red/yellow/green scales).
const difficultyToneClass = (difficulty: Exercise['difficulty']): string => {
  switch (difficulty) {
    case 'Beginner':
    case 'Novice':
      return 'text-success';
    case 'Intermediate':
      return 'text-warning';
    default:
      return 'text-danger';
  }
};

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
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [activeMuscle, setActiveMuscle] = useState(() => searchParams.get('muscle') ?? '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  // Deep-link support: the Home body map navigates here with ?muscle=<name>.
  // Apply the substring muscle filter once the exercise database has loaded
  // (and whenever the param changes). Other params/states are reset so the
  // muscle filter is the sole active criterion on arrival.
  useEffect(() => {
    const muscle = searchParams.get('muscle') ?? '';
    setActiveMuscle(muscle);
    // Re-apply whenever the exercise list changes (the database loads async, so
    // the first run usually sees an empty list — depending on `exercises` rather
    // than a one-shot flag ensures the filter lands once the data arrives).
    if (muscle && exercises.length > 0) {
      setSearchTerm('');
      setSelectedMuscleGroup('all');
      setCurrentPage(1);
      dispatch(filterByMuscle(muscle));
    }
  }, [searchParams, exercises, dispatch]);

  // Dropping the muscle deep-link when the user picks another filter keeps the
  // active-filter chip honest.
  const clearMuscleParam = () => {
    if (!activeMuscle) return;
    setActiveMuscle('');
    setSearchParams({}, { replace: true });
  };

  const clearMuscleFilter = () => {
    clearMuscleParam();
    setSelectedMuscleGroup('all');
    setCurrentPage(1);
    dispatch(filterByMuscleGroup('all'));
  };

  // Helper to check if an exercise is custom
  const isCustomExercise = (exerciseId: string) => {
    return customExercises.some(custom => custom.id === exerciseId || exerciseId.startsWith('custom-'));
  };

  const muscleGroups = useMemo(() => {
    const groups = Array.from(new Set(exercises.map(e => e.muscleGroup)));
    return ['all', ...groups.sort()];
  }, [exercises]);

  const handleSearch = (term: string) => {
    clearMuscleParam();
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page on search
    dispatch(searchExercises(term));
  };

  const handleMuscleGroupFilter = (group: string) => {
    clearMuscleParam();
    setSelectedMuscleGroup(group);
    setCurrentPage(1); // Reset to first page on filter
    dispatch(filterByMuscleGroup(group));
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredExercises.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentExercises = filteredExercises.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when page changes
    scrollAppToTop();
  };

  const handleExerciseClick = (exercise: Exercise) => {
    dispatch(setSelectedExercise(exercise));
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-surface p-4" aria-busy="true">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>

          <div className="mb-6 space-y-4 md:space-y-0 md:flex md:gap-4">
            <Skeleton className="h-touch-min flex-1" />
            <Skeleton className="h-touch-min w-full md:w-48" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} elevation={1}>
                <CardBody className="space-y-4">
                  <Skeleton className="aspect-video w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-surface p-4 flex items-center justify-center">
        <p className="text-danger text-body">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-display font-bold text-ink mb-2">Exercise Database</h1>
          <p className="text-ink-muted text-body">Browse {exercises.length} exercises with video demonstrations</p>
        </div>

        <div className="mb-6 space-y-4 md:space-y-0 md:flex md:gap-4">
          <Input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
            aria-label="Search exercises"
          />

          <div className="w-full md:w-48">
            <Select value={selectedMuscleGroup} onValueChange={handleMuscleGroupFilter}>
              <SelectTrigger aria-label="Filter by muscle group">
                <SelectValue placeholder="All Muscle Groups" />
              </SelectTrigger>
              <SelectContent>
                {muscleGroups.map(group => (
                  <SelectItem key={group} value={group}>
                    {group === 'all' ? 'All Muscle Groups' : group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeMuscle && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-body-sm text-ink-muted">Filtered by muscle:</span>
            <button
              type="button"
              onClick={clearMuscleFilter}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-body-sm font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label={`Clear ${activeMuscle} filter`}
            >
              <span className="capitalize">{activeMuscle}</span>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {filteredExercises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ink-muted text-body">No exercises found matching your criteria</p>
          </div>
        ) : (
          <>
            {/* Results info */}
            <div className="flex justify-between items-center mb-4 text-ink-subtle text-body-sm">
              <p>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredExercises.length)} of {filteredExercises.length} exercises
              </p>
              <p>Page {currentPage} of {totalPages}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentExercises.map(exercise => (
                <Card
                  key={exercise.id}
                  elevation={1}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleExerciseClick(exercise)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleExerciseClick(exercise);
                    }
                  }}
                  className="cursor-pointer transition-shadow duration-snap hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <CardBody className="pt-4">
                    {exercise.videoLinks.length > 0 && (
                      <div className="mb-4">
                        <ExerciseVideo
                          key={`${exercise.id}-${exercise.videoLinks[0]}`}
                          videoUrl={exercise.videoLinks[0]}
                          exerciseName={exercise.name}
                          autoPlay={false}
                          muted={true}
                          compact={true}
                          fallbackVideoUrls={exercise.videoLinks.slice(1)}
                          instructions={exercise.instructions}
                        />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-title font-semibold text-ink">{exercise.name}</h3>
                      {isCustomExercise(exercise.id) && (
                        <CustomExerciseBadge size="sm" />
                      )}
                    </div>

                    <div className="space-y-2 text-body-sm">
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Muscle Group:</span>
                        <span className="text-accent font-medium">{exercise.muscleGroup}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-ink-muted">Equipment:</span>
                        <span className="text-ink">{exercise.equipment}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-ink-muted">Difficulty:</span>
                        <span className={`font-medium ${difficultyToneClass(exercise.difficulty)}`}>
                          {exercise.difficulty}
                        </span>
                      </div>
                    </div>

                    {exercise.instructions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-ink-muted text-body-sm line-clamp-2">
                          {exercise.instructions[0]}
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Stack
                direction="row"
                align="center"
                justify="center"
                gap={2}
                className="mt-8"
              >
                <IconButton
                  variant="secondary"
                  aria-label="Previous page"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </IconButton>

                {/* Page numbers */}
                <div className="flex gap-1">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-10"
                        onClick={() => handlePageChange(1)}
                      >
                        1
                      </Button>
                      {currentPage > 4 && <span className="px-2 py-2 text-ink-subtle">...</span>}
                    </>
                  )}

                  {/* Current page and surrounding */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (page <= totalPages) {
                      return (
                        <Button
                          key={page}
                          variant={page === currentPage ? 'primary' : 'secondary'}
                          size="sm"
                          className="w-10"
                          onClick={() => handlePageChange(page)}
                          aria-current={page === currentPage ? 'page' : undefined}
                        >
                          {page}
                        </Button>
                      );
                    }
                    return null;
                  })}

                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="px-2 py-2 text-ink-subtle">...</span>}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-10"
                        onClick={() => handlePageChange(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>

                <IconButton
                  variant="secondary"
                  aria-label="Next page"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </IconButton>
              </Stack>
            )}
          </>
        )}

        {/* Exercise Detail Sheet */}
        <Sheet
          open={!!selectedExercise}
          onOpenChange={(open) => {
            if (!open) dispatch(setSelectedExercise(null));
          }}
        >
          <SheetContent className="max-w-4xl mx-auto">
            {selectedExercise && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <SheetTitle className="text-display">{selectedExercise.name}</SheetTitle>
                  {isCustomExercise(selectedExercise.id) && (
                    <CustomExerciseBadge size="md" />
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-body-sm">
                  <span className="text-accent">{selectedExercise.muscleGroup}</span>
                  <span className="text-ink-subtle">•</span>
                  <span className="text-ink">{selectedExercise.equipment}</span>
                  <span className="text-ink-subtle">•</span>
                  <span className={difficultyToneClass(selectedExercise.difficulty)}>
                    {selectedExercise.difficulty}
                  </span>
                </div>

                {selectedExercise.videoLinks.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <h3 className="text-title font-semibold text-ink mb-3">Instructions</h3>
                    <ol className="list-decimal list-inside space-y-2">
                      {selectedExercise.instructions.map((instruction, index) => (
                        <li key={index} className="text-ink-muted text-body">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
