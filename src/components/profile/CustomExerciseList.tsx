import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Video, Dumbbell, Calendar, Activity, X } from 'lucide-react';
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
        <p className="text-gray-400">Please log in to manage custom exercises</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">My Custom Exercises</h2>
          <p className="text-gray-400 mt-1">
            Create and manage your personalized exercise library
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Create Exercise</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search custom exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <Dumbbell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {searchTerm ? 'No exercises found' : 'No custom exercises yet'}
          </h3>
          <p className="text-gray-400 mb-4">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Create your first custom exercise to get started'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreateNew}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
            >
              Create Your First Exercise
            </button>
          )}
        </div>
      ) : (
        /* Exercise Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              {/* Exercise Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white truncate">
                    {exercise.name}
                  </h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      {exercise.muscleGroup}
                    </span>
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      {exercise.equipment}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  {exercise.videoLinks && exercise.videoLinks.length > 0 && (
                    <button
                      onClick={() => setSelectedVideoExercise(exercise)}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                      title="View video"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(exercise)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Edit exercise"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(exercise.id || null)}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    title="Delete exercise"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Exercise Details */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-400">
                  <Activity className="w-4 h-4 mr-2" />
                  <span>Difficulty: {exercise.difficulty}</span>
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Used {exercise.usageCount} times</span>
                </div>
                {exercise.updatedAt && (
                  <div className="text-xs text-gray-500">
                    Updated {formatDistanceToNowHelper(exercise.updatedAt)}
                  </div>
                )}
              </div>

              {/* Instructions Preview */}
              {exercise.instructions && exercise.instructions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-sm text-gray-300 line-clamp-2">
                    {exercise.instructions[0]}
                  </p>
                </div>
              )}

              {/* Delete Confirmation */}
              {showDeleteConfirm === exercise.id && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-500 rounded-lg">
                  <p className="text-sm text-red-400 mb-2">
                    Delete this exercise permanently?
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDelete(exercise.id!)}
                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
      {selectedVideoExercise && selectedVideoExercise.videoLinks && selectedVideoExercise.videoLinks.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-gray-900 bg-opacity-75"
            onClick={() => setSelectedVideoExercise(null)}
          />
          <div className="relative bg-gray-800 rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <button
              onClick={() => setSelectedVideoExercise(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-semibold text-white mb-4">
              {selectedVideoExercise.name}
            </h3>
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
          </div>
        </div>
      )}
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