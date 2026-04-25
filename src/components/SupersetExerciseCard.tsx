import React from 'react';
import { WorkoutExercise } from '../types/exercise';
import { ExerciseHistory } from '../types/exerciseHistory';
import { DualViewVideo } from './DualViewVideo';
import { ExerciseVideo } from './ExerciseVideo';
import { SetInput } from './SetInput';
import { PreviousPerformance } from './workout/PreviousPerformance';
import { RestTimer } from './RestTimer';
import { ExerciseNotesEditor } from './workout/ExerciseNotesEditor';
import { useAppDispatch } from '../store/hooks';
import { updateExerciseNotesAndTitle } from '../store/slices/workoutSlice';
import { Link2, Plus } from 'lucide-react';

interface SupersetExerciseCardProps {
  exercises: WorkoutExercise[];
  currentSupersetIndex: number;
  currentSetIndex: number;
  onCompleteSet: (reps: number, weight: number) => void;
  onUncompleteSet: () => void;
  onJumpToSet: (setIndex: number) => void;
  onAddSet: () => void;
  previousPerformances: Record<string, ExerciseHistory | null>;
}

export const SupersetExerciseCard: React.FC<SupersetExerciseCardProps> = ({
  exercises,
  currentSupersetIndex,
  currentSetIndex,
  onCompleteSet,
  onUncompleteSet,
  onJumpToSet,
  onAddSet,
  previousPerformances
}) => {
  const dispatch = useAppDispatch();
  const currentExercise = exercises[currentSupersetIndex];
  const otherExercises = exercises.filter((_, index) => index !== currentSupersetIndex);

  return (
    <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-500/30">
      {/* Superset Header */}
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="flex items-center space-x-2 bg-blue-600 px-3 py-1 rounded-full">
            <Link2 className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">
              Superset ({currentSupersetIndex + 1}/{exercises.length})
            </span>
          </div>
        </div>
        <ExerciseNotesEditor
          exercise={currentExercise}
          onUpdateTitle={(title) => dispatch(updateExerciseNotesAndTitle({
            exerciseId: currentExercise.id,
            customTitle: title
          }))}
          onUpdateNotes={(notes) => dispatch(updateExerciseNotesAndTitle({
            exerciseId: currentExercise.id,
            notes: notes
          }))}
        />
      </div>

      {/* Current Exercise Video */}
      {currentExercise.exercise.videoLinks.length > 0 && (
        <div className="mb-6">
          {currentExercise.exercise.videoLinks.length >= 2 ? (
            <DualViewVideo
              key={`superset-dual-${currentExercise.exercise.id}-${currentSupersetIndex}`}
              videoUrls={currentExercise.exercise.videoLinks}
              exerciseName={currentExercise.customTitle || currentExercise.exercise.name}
              autoPlay={true}
              muted={true}
              compact={true}
              instructions={currentExercise.exercise.instructions}
            />
          ) : (
            <ExerciseVideo
              key={`superset-single-${currentExercise.exercise.id}-${currentSupersetIndex}`}
              videoUrl={currentExercise.exercise.videoLinks[0]}
              exerciseName={currentExercise.customTitle || currentExercise.exercise.name}
              autoPlay={true}
              muted={true}
              compact={true}
              fallbackVideoUrls={currentExercise.exercise.videoLinks.slice(1)}
              instructions={currentExercise.exercise.instructions}
            />
          )}
        </div>
      )}

      {/* Previous Performance Display */}
      <PreviousPerformance
        currentExercise={currentExercise}
        previousPerformance={previousPerformances[currentExercise.exercise.id]}
        isLoading={false}
      />

      {/* Rest Timer - Mobile only */}
      <div className="lg:hidden">
        <RestTimer />
      </div>

      {/* Current Set Information */}
      <div className="mb-6 bg-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Current Set: {currentSetIndex + 1} / {currentExercise.sets.length}
        </h3>
        <p className="text-gray-300 text-sm mb-3">
          Complete this set, then switch to the next exercise in the superset
        </p>

        {/* Current Set Details */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-600 rounded p-2">
            <p className="text-gray-300 text-xs">Target Reps</p>
            <p className="text-white font-bold text-lg">
              {currentExercise.sets[currentSetIndex]?.reps || 0}
            </p>
          </div>
          <div className="bg-gray-600 rounded p-2">
            <p className="text-gray-300 text-xs">Weight</p>
            <p className="text-white font-bold text-lg">
              {currentExercise.sets[currentSetIndex]?.weight || 0} lbs
            </p>
          </div>
          <div className="bg-gray-600 rounded p-2">
            <p className="text-gray-300 text-xs">Exercise</p>
            <p className="text-white font-bold text-sm">
              {currentSupersetIndex + 1}/{exercises.length}
            </p>
          </div>
        </div>
      </div>

      {/* Set Input */}
      <div className="mb-6">
        <SetInput
          set={currentExercise.sets[currentSetIndex]}
          onComplete={onCompleteSet}
          onUncomplete={onUncompleteSet}
          previousSet={currentSetIndex > 0 ? currentExercise.sets[currentSetIndex - 1] : null}
          allSets={currentExercise.sets}
        />
      </div>

      {/* All Sets Overview */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-white">All Sets</h4>
          <button
            onClick={onAddSet}
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Set</span>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 font-medium">
          <span>Set</span>
          <span>Previous</span>
          <span>Reps</span>
          <span>Weight</span>
        </div>
        {currentExercise.sets.map((set, index) => {
          // Get previous performance data for this exercise
          const previousPerformance = previousPerformances[currentExercise.exercise.id];
          const previousSet = previousPerformance?.sets?.[index];

          // Format previous set display
          const previousDisplay = previousSet
            ? `${previousSet.actualReps}×${previousSet.weight}`
            : '-';

          return (
            <div
              key={set.id}
              onClick={() => onJumpToSet(index)}
              className={`grid grid-cols-4 gap-2 p-2 rounded text-sm cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-blue-400 ${
                index === currentSetIndex
                  ? 'bg-blue-600 text-white shadow-lg'
                  : set.completed
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="font-medium">{index + 1}</span>
              <span className="text-xs">{previousDisplay}</span>
              <span>{set.reps || '-'}</span>
              <span>{set.weight ? `${set.weight} lbs` : '-'}</span>
              {index === currentSetIndex && (
                <div className="col-span-4 text-xs opacity-75 text-center mt-1">
                  Current Set
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Other Exercises in Superset Preview */}
      {otherExercises.length > 0 && (
        <div className="mb-4">
          <h4 className="text-md font-semibold text-white mb-3 flex items-center">
            <span className="mr-2">Next in Superset:</span>
            <div className="flex-1 h-px bg-gray-600"></div>
          </h4>
          <div className="space-y-2">
            {otherExercises.map((exercise, index) => {
              const actualIndex = exercises.findIndex(ex => ex.id === exercise.id);
              return (
                <div
                  key={exercise.id}
                  className="flex items-center justify-between bg-gray-700 rounded-lg p-3 opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{actualIndex + 1}</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{exercise.exercise.name}</p>
                      <p className="text-gray-400 text-sm">
                        {exercise.sets.length} sets
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    Waiting...
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Superset Progress */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300 text-sm">Superset Progress</span>
          <span className="text-blue-400 text-sm font-medium">
            Set {currentSetIndex + 1} of {currentExercise.sets.length}
          </span>
        </div>
        <div className="flex space-x-1">
          {exercises.map((exercise, index) => (
            <div
              key={exercise.id}
              className={`flex-1 h-2 rounded-full ${
                index === currentSupersetIndex
                  ? 'bg-blue-500'
                  : index < currentSupersetIndex
                  ? 'bg-green-500'
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Exercise Instructions */}
      {currentExercise.exercise.instructions.length > 0 && (
        <div className="mt-4 bg-gray-700 rounded-lg p-4">
          <h4 className="text-md font-semibold text-white mb-2">Instructions</h4>
          <ol className="space-y-1">
            {currentExercise.exercise.instructions.map((instruction, index) => (
              <li key={index} className="text-gray-300 text-sm">
                <span className="text-blue-400 font-medium">{index + 1}.</span> {instruction}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};