import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useAuth } from '../../contexts/AuthContext';
import {
  loadCustomExercises,
  saveCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  selectCustomExercises,
  selectIsLoadingCustomExercises,
  selectCustomExerciseError
} from '../../store/slices/customExerciseSlice';
import { CustomExerciseModal } from '../CustomExerciseModal';
import { CustomExercise, SaveCustomExerciseData } from '../../services/customExerciseService';
import { ExerciseVideo } from '../ExerciseVideo';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { cn } from '../../lib/utils';

/**
 * The user's own exercises (Tempo): a search pill over one subtle card of
 * hairline rows (name, muscle group and equipment muted, usage on the right).
 * Tapping a row opens a detail sheet with the full instructions, the video
 * when there is one, and Edit / Delete.
 */
export const CustomExerciseList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const customExercises = useAppSelector(selectCustomExercises);
  const isLoading = useAppSelector(selectIsLoadingCustomExercises);
  const error = useAppSelector(selectCustomExerciseError);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<CustomExercise | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  // The exercise shown in the detail sheet. Kept after closing so the sheet's
  // exit animation doesn't flash empty.
  const [detailExercise, setDetailExercise] = useState<CustomExercise | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      dispatch(loadCustomExercises(user.uid));
    }
  }, [user, dispatch]);

  const handleCreateNew = () => {
    setSelectedExercise(null);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (exercise: CustomExercise) => {
    // Close the detail sheet first so two dialogs never fight over focus.
    setIsDetailOpen(false);
    setSelectedExercise(exercise);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSave = async (exerciseData: SaveCustomExerciseData) => {
    if (!user) return;

    if (isEditMode && selectedExercise?.id) {
      await dispatch(updateCustomExercise({
        userId: user.uid,
        exerciseId: selectedExercise.id,
        updates: exerciseData
      }));
    } else {
      await dispatch(saveCustomExercise({
        userId: user.uid,
        exerciseData
      }));
    }
  };

  const handleDelete = async (exerciseId: string) => {
    if (!user || !exerciseId) return;

    await dispatch(deleteCustomExercise({
      userId: user.uid,
      exerciseId
    }));
    setShowDeleteConfirm(null);
    setIsDetailOpen(false);
  };

  const openDetail = (exercise: CustomExercise) => {
    setShowDeleteConfirm(null);
    setDetailExercise(exercise);
    setIsDetailOpen(true);
  };

  const filteredExercises = customExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.equipment.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <p className="py-12 text-center text-body-sm text-ink-muted">
        Sign in to manage your custom exercises.
      </p>
    );
  }

  const detail = detailExercise;
  const videoLinks = detail?.videoLinks ?? [];

  return (
    <section aria-labelledby="custom-exercises-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="custom-exercises-heading" className="font-wide text-title font-bold text-ink">
            Custom exercises
          </h2>
          <p className="text-body-sm text-ink-muted">Your own moves, alongside the library.</p>
        </div>
        {customExercises.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New
          </Button>
        )}
      </div>

      {customExercises.length > 0 && (
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search custom exercises"
            placeholder="Search custom exercises"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-full pl-11 font-sans"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="rounded-[20px] bg-surface-subtle px-5 py-6">
          <p className="text-body font-semibold text-ink">
            {searchTerm ? 'No matches' : 'No custom exercises yet'}
          </p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {searchTerm
              ? 'Try a different name, muscle group or piece of equipment.'
              : 'Add a move the library doesn’t have and use it in any workout.'}
          </p>
          {!searchTerm && (
            <Button className="mt-4" onClick={handleCreateNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create exercise
            </Button>
          )}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[20px] bg-surface-subtle">
          {filteredExercises.map((exercise, i) => (
            <li key={exercise.id} className={cn(i > 0 && 'border-t border-hairline')}>
              <button
                type="button"
                onClick={() => openDetail(exercise)}
                aria-haspopup="dialog"
                className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-snap hover:bg-surface-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">{exercise.name}</span>
                  <span className="mt-0.5 block truncate text-body-sm text-ink-muted">
                    {exercise.muscleGroup} · {exercise.equipment}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-num font-tabular font-wide text-title font-bold text-ink">
                    {exercise.usageCount}
                  </span>
                  <span className="block text-caption text-ink-muted">
                    {exercise.usageCount === 1 ? 'use' : 'uses'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="mx-auto max-w-lg">
          {detail && (
            <>
              <SheetTitle className="text-title">{detail.name}</SheetTitle>
              <SheetDescription>
                {detail.muscleGroup} · {detail.equipment} · {detail.difficulty}
              </SheetDescription>

              <p className="mt-2 text-caption text-ink-muted">
                Used {detail.usageCount} time{detail.usageCount === 1 ? '' : 's'}
                {detail.updatedAt && ` · updated ${formatDistanceToNowHelper(detail.updatedAt)}`}
              </p>

              {videoLinks.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-2xl">
                  <ExerciseVideo
                    videoUrl={videoLinks[0]}
                    fallbackVideoUrls={videoLinks.slice(1)}
                    exerciseName={detail.name}
                  />
                </div>
              )}

              {detail.instructions && detail.instructions.length > 0 && (
                <section aria-label="Instructions" className="mt-5">
                  <h3 className="mb-2 text-body-sm font-semibold text-ink">How to do it</h3>
                  <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-body-sm text-ink-muted marker:text-ink-subtle">
                    {detail.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </section>
              )}

              {showDeleteConfirm === detail.id ? (
                <div className="mt-6 rounded-2xl bg-danger/10 p-4">
                  <p className="text-body-sm font-semibold text-danger">Delete this exercise permanently?</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="danger" onClick={() => handleDelete(detail.id!)}>
                      Delete
                    </Button>
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => handleEdit(detail)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-danger hover:text-danger"
                    onClick={() => setShowDeleteConfirm(detail.id || null)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Custom Exercise Modal */}
      <CustomExerciseModal
        isOpen={isModalOpen}
        exercise={selectedExercise}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedExercise(null);
          setIsEditMode(false);
        }}
        onSave={handleSave}
      />
    </section>
  );
};

// Helper function - add this to utils/dateUtils.ts
function formatDistanceToNowHelper(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}
