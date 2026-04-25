import { useState, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { searchExercises, filterByMuscleGroup, setSelectedExercise } from '../store/slices/exerciseSlice';
import { ExerciseVideo } from '../components/ExerciseVideo';
import { CustomExerciseBadge } from '../components/workout/CustomExerciseBadge';
import { Exercise } from '../types/exercise';
import { selectCustomExercises } from '../store/slices/customExerciseSlice';

export default function ExercisesPage() {
  const dispatch = useAppDispatch();
  const { filteredExercises, exercises, selectedExercise, isLoading, error } = useAppSelector((state) => state.exercise);
  const customExercises = useAppSelector(selectCustomExercises);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  // Helper to check if an exercise is custom
  const isCustomExercise = (exerciseId: string) => {
    return customExercises.some(custom => custom.id === exerciseId || exerciseId.startsWith('custom-'));
  };

  const muscleGroups = useMemo(() => {
    const groups = Array.from(new Set(exercises.map(e => e.muscleGroup)));
    return ['all', ...groups.sort()];
  }, [exercises]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page on search
    dispatch(searchExercises(term));
  };

  const handleMuscleGroupFilter = (group: string) => {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExerciseClick = (exercise: Exercise) => {
    dispatch(setSelectedExercise(exercise));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 flex items-center justify-center">
        <div className="text-white text-lg">Loading exercises...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Exercise Database</h1>
          <p className="text-gray-400">Browse {exercises.length} exercises with video demonstrations</p>
        </div>

        <div className="mb-6 space-y-4 md:space-y-0 md:flex md:gap-4">
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <select
            value={selectedMuscleGroup}
            onChange={(e) => handleMuscleGroupFilter(e.target.value)}
            className="w-full md:w-48 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {muscleGroups.map(group => (
              <option key={group} value={group}>
                {group === 'all' ? 'All Muscle Groups' : group}
              </option>
            ))}
          </select>
        </div>

        {filteredExercises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No exercises found matching your criteria</p>
          </div>
        ) : (
          <>
            {/* Results info */}
            <div className="flex justify-between items-center mb-4 text-gray-400 text-sm">
              <p>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredExercises.length)} of {filteredExercises.length} exercises
              </p>
              <p>Page {currentPage} of {totalPages}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentExercises.map(exercise => (
              <div 
                key={exercise.id} 
                className="bg-gray-800 rounded-lg p-6 cursor-pointer transition-colors hover:bg-gray-750 border border-gray-700"
                onClick={() => handleExerciseClick(exercise)}
              >
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
                
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-semibold text-white">{exercise.name}</h3>
                  {isCustomExercise(exercise.id) && (
                    <CustomExerciseBadge size="sm" />
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Muscle Group:</span>
                    <span className="text-blue-400 font-medium">{exercise.muscleGroup}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Equipment:</span>
                    <span className="text-white">{exercise.equipment}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-400">Difficulty:</span>
                    <span className={`font-medium ${
                      exercise.difficulty === 'Beginner' ? 'text-green-400' :
                      exercise.difficulty === 'Intermediate' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {exercise.difficulty}
                    </span>
                  </div>
                </div>

                {exercise.instructions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-300 text-sm line-clamp-2">
                      {exercise.instructions[0]}
                    </p>
                  </div>
                )}
              </div>
            ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  ← Previous
                </button>
                
                {/* Page numbers */}
                <div className="flex space-x-1">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => handlePageChange(1)}
                        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        1
                      </button>
                      {currentPage > 4 && <span className="px-2 py-2 text-gray-400">...</span>}
                    </>
                  )}
                  
                  {/* Current page and surrounding */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (page <= totalPages) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`w-10 h-10 rounded-lg transition-colors ${
                            page === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="px-2 py-2 text-gray-400">...</span>}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* Exercise Detail Modal */}
        {selectedExercise && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">{selectedExercise.name}</h2>
                      {isCustomExercise(selectedExercise.id) && (
                        <CustomExerciseBadge size="md" />
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-blue-400">{selectedExercise.muscleGroup}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-white">{selectedExercise.equipment}</span>
                      <span className="text-gray-400">•</span>
                      <span className={
                        selectedExercise.difficulty === 'Beginner' ? 'text-green-400' :
                        selectedExercise.difficulty === 'Intermediate' ? 'text-yellow-400' :
                        'text-red-400'
                      }>
                        {selectedExercise.difficulty}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => dispatch(setSelectedExercise(null))}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </div>

                {selectedExercise.videoLinks.length > 0 && (
                  <div className="mb-6">
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
                  </div>
                )}

                {selectedExercise.instructions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Instructions</h3>
                    <ol className="list-decimal list-inside space-y-2">
                      {selectedExercise.instructions.map((instruction, index) => (
                        <li key={index} className="text-gray-300">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}