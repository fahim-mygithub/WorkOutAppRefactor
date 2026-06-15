import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Video, Dumbbell, Calendar, Activity } from 'lucide-react';
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
import { Card, CardBody } from '../ui/card';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';

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
  const [selectedVideoExercise, setSelectedVideoExercise] = useState<CustomExercise | null>(null);
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
  };

  const filteredExercises = customExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.equipment.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-muted">Please log in to manage custom exercises</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-title font-bold text-ink">My Custom Exercises</h2>
          <p className="text-ink-muted mt-1">
            Create and manage your personalized exercise library
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-5 h-5" />
          Create Exercise
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle w-5 h-5 z-10" />
        <Input
          type="text"
          placeholder="Search custom exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      ) : filteredExercises.length === 0 ? (
        <Card elevation={1}>
          <CardBody className="text-center py-12">
            <Dumbbell className="w-16 h-16 text-ink-subtle mx-auto mb-4" />
            <h3 className="text-body font-medium text-ink mb-2">
              {searchTerm ? 'No exercises found' : 'No custom exercises yet'}
            </h3>
            <p className="text-ink-muted mb-4">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Create your first custom exercise to get started'}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreateNew}>
                Create Your First Exercise
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        /* Exercise Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((exercise) => (
            <Card
              key={exercise.id}
              elevation={1}
              className="p-4 hover:bg-surface-subtle transition-colors duration-snap"
            >
              {/* Exercise Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-body font-semibold text-ink truncate">
                    {exercise.name}
                  </h3>
                  <div className="flex items-center space-x-2 text-body-sm text-ink-muted mt-1">
                    <span className="bg-surface-subtle px-2 py-1 rounded">
                      {exercise.muscleGroup}
                    </span>
                    <span className="bg-surface-subtle px-2 py-1 rounded">
                      {exercise.equipment}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  {exercise.videoLinks && exercise.videoLinks.length > 0 && (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label="View video"
                      onClick={() => setSelectedVideoExercise(exercise)}
                      className="text-accent"
                    >
                      <Video className="w-4 h-4" />
                    </IconButton>
                  )}
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label="Edit exercise"
                    onClick={() => handleEdit(exercise)}
                    className="text-ink-muted"
                  >
                    <Edit2 className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label="Delete exercise"
                    onClick={() => setShowDeleteConfirm(exercise.id || null)}
                    className="text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>

              {/* Exercise Details */}
              <div className="space-y-2">
                <div className="flex items-center text-body-sm text-ink-muted">
                  <Activity className="w-4 h-4 mr-2" />
                  <span>Difficulty: {exercise.difficulty}</span>
                </div>
                <div className="flex items-center text-body-sm text-ink-muted">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Used {exercise.usageCount} times</span>
                </div>
                {exercise.updatedAt && (
                  <div className="text-caption text-ink-subtle">
                    Updated {formatDistanceToNowHelper(exercise.updatedAt)}
                  </div>
                )}
              </div>

              {/* Instructions Preview */}
              {exercise.instructions && exercise.instructions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-body-sm text-ink-muted line-clamp-2">
                    {exercise.instructions[0]}
                  </p>
                </div>
              )}

              {/* Delete Confirmation */}
              {showDeleteConfirm === exercise.id && (
                <div className="mt-3 p-3 bg-danger/10 border border-danger rounded-md">
                  <p className="text-body-sm text-danger mb-2">
                    Delete this exercise permanently?
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(exercise.id!)}
                      className="flex-1"
                    >
                      Delete
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(null)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

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

      {/* Video Modal */}
      <Sheet
        open={!!(selectedVideoExercise && selectedVideoExercise.videoLinks && selectedVideoExercise.videoLinks.length > 0)}
        onOpenChange={(open) => {
          if (!open) setSelectedVideoExercise(null);
        }}
      >
        <SheetContent className="max-w-4xl mx-auto">
          {selectedVideoExercise && (
            <>
              <SheetTitle className="text-title mb-4">
                {selectedVideoExercise.name}
              </SheetTitle>
              <ExerciseVideo
                exercise={{
                  ...selectedVideoExercise,
                  id: selectedVideoExercise.id || '',
                  muscleGroups: [selectedVideoExercise.muscleGroup],
                  searchKeywords: [],
                  createdAt: selectedVideoExercise.createdAt.toISOString(),
                  updatedAt: selectedVideoExercise.updatedAt.toISOString()
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
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