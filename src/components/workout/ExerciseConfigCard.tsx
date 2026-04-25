import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Exercise } from '../../types/exercise';
import { ExercisePreviewModal } from './ExercisePreviewModal';
import { ExerciseSearchModal } from './ExerciseSearchModal';
import { useAppSelector } from '../../store/hooks';

interface ExerciseConfigCardProps {
  exercise: any;
  id: string;
  onUpdate: (updatedExercise: any) => void;
  onDelete: () => void;
  onReplaceExercise: (newExercise: Exercise) => void;
  onToggleSuperset: () => void;
  isInSuperset: boolean;
  supersetGroup?: number;
  supersetColor?: string;
  isInSupersetMode?: boolean;
  onRemoveFromSuperset?: () => void;
  isDragDisabled?: boolean;
  exerciseDatabase: Exercise[];
  dbExercise?: Exercise | null;
}

export const ExerciseConfigCard: React.FC<ExerciseConfigCardProps> = ({
  exercise,
  id,
  onUpdate,
  onDelete,
  onReplaceExercise,
  onToggleSuperset,
  isInSuperset,
  supersetGroup,
  supersetColor = 'blue',
  isInSupersetMode = false,
  onRemoveFromSuperset,
  isDragDisabled = false,
  exerciseDatabase,
  dbExercise = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  
  const { weightUnit } = useAppSelector((state) => state.user.preferences);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: isDragDisabled 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSetUpdate = (setIndex: number, field: string, value: any) => {
    const updatedSets = [...exercise.sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], [field]: value };
    
    onUpdate({
      ...exercise,
      sets: updatedSets,
    });
  };

  const handleRepsChange = (setIndex: number, repsValue: string) => {
    let reps: any;
    
    if (repsValue.toLowerCase() === 'amrap') {
      reps = 'AMRAP';
    } else if (repsValue.includes('-')) {
      const [min, max] = repsValue.split('-').map(v => parseInt(v.trim()));
      if (!isNaN(min) && !isNaN(max)) {
        reps = { min, max };
      } else {
        reps = parseInt(repsValue) || 10;
      }
    } else {
      reps = parseInt(repsValue) || 10;
    }
    
    handleSetUpdate(setIndex, 'reps', reps);
  };

  const handleWeightChange = (setIndex: number, weightValue: string) => {
    const numValue = parseFloat(weightValue);
    if (!isNaN(numValue) && numValue > 0) {
      handleSetUpdate(setIndex, 'weight', numValue);
      handleSetUpdate(setIndex, 'unit', exercise.sets[setIndex].unit || weightUnit);
    } else if (weightValue === '' || numValue === 0) {
      handleSetUpdate(setIndex, 'weight', undefined);
      handleSetUpdate(setIndex, 'unit', undefined);
    }
  };

  const handleUnitToggle = (setIndex: number) => {
    const currentSet = exercise.sets[setIndex];
    const currentUnit = currentSet.unit || 'lbs';
    const newUnit = currentUnit === 'lbs' ? 'kg' : 'lbs';
    
    // Convert weight if there's a value
    if (currentSet.weight) {
      const convertedWeight = currentUnit === 'lbs' 
        ? Math.round(currentSet.weight / 2.20462 * 10) / 10  // lbs to kg
        : Math.round(currentSet.weight * 2.20462 * 10) / 10; // kg to lbs
      
      handleSetUpdate(setIndex, 'weight', convertedWeight);
    }
    
    handleSetUpdate(setIndex, 'unit', newUnit);
  };

  const handleRestTimeChange = (restValue: string) => {
    const restSeconds = parseInt(restValue) || 120; // Default 2 minutes
    const updatedSets = exercise.sets.map((set: any) => ({ ...set, rest: restSeconds }));
    
    onUpdate({
      ...exercise,
      sets: updatedSets,
    });
  };

  const addSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet = {
      reps: lastSet?.reps || 10,
      weight: lastSet?.weight,
      rest: lastSet?.rest || 120,
    };
    
    onUpdate({
      ...exercise,
      sets: [...exercise.sets, newSet],
    });
  };

  const removeSet = (setIndex: number) => {
    if (exercise.sets.length > 1) {
      const updatedSets = exercise.sets.filter((_: any, i: number) => i !== setIndex);
      onUpdate({
        ...exercise,
        sets: updatedSets,
      });
    }
  };

  const formatReps = (reps: any): string => {
    if (reps === 'AMRAP') return 'AMRAP';
    if (typeof reps === 'object' && 'min' in reps) {
      return `${reps.min}-${reps.max}`;
    }
    return String(reps);
  };

  const getRestTimeInMinutes = (): number => {
    const restSeconds = exercise.sets[0]?.rest || 120;
    return Math.round(restSeconds / 60 * 10) / 10; // Round to 1 decimal
  };

  // Get superset tooltip text
  const getSupersetTooltip = (): string => {
    if (isInSupersetMode) {
      return "Click another exercise to create a superset";
    } else if (isInSuperset && supersetGroup) {
      return `In superset group ${supersetGroup} - Click to remove`;
    } else {
      return "Click to start creating a superset";
    }
  };

  // Handle superset button click
  const handleSupersetClick = () => {
    if (isInSuperset && onRemoveFromSuperset) {
      onRemoveFromSuperset();
    } else {
      onToggleSuperset();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-800 rounded-lg p-4 transition-all duration-200 ${
        isDragging ? 'shadow-lg rotate-1 z-50' : ''
      } ${
        isInSuperset 
          ? `border-l-4 border-l-${supersetColor}-500` 
          : isInSupersetMode 
            ? 'border-l-4 border-l-yellow-500 animate-pulse'
            : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div 
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div className="flex-1 min-w-0">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="font-semibold text-white truncate hover:text-blue-300 transition-colors text-left"
              title="Click to preview exercise details"
            >
              {exercise.name}
            </button>
            <p className="text-sm text-gray-400">
              {exercise.sets.length} sets • Rest: {getRestTimeInMinutes()}min
            </p>
          </div>
        </div>
        
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-2 text-gray-400 hover:text-white rounded"
            title="Change Exercise"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            onClick={handleSupersetClick}
            className={`p-2 rounded transition-all duration-200 ${
              isInSuperset 
                ? `text-${supersetColor}-400 bg-${supersetColor}-900 border border-${supersetColor}-700` 
                : isInSupersetMode 
                  ? 'text-yellow-400 bg-yellow-900 border border-yellow-700 animate-pulse'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={getSupersetTooltip()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-white rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:text-red-800 rounded"
            title="Delete Exercise"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ExercisePreviewModal
        exercise={dbExercise}
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
      />
      
      <ExerciseSearchModal
        exercises={exerciseDatabase}
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectExercise={onReplaceExercise}
        currentExerciseName={exercise.name}
      />

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 border-t border-gray-700 pt-4">
          {/* Rest Time Control */}
          <div className="flex items-center gap-2">
            <span className="text-gray-300 font-medium min-w-20 text-sm">
              Rest Time:
            </span>
            <select
              value={String(exercise.sets[0]?.rest || 120)}
              onChange={(e) => handleRestTimeChange(e.target.value)}
              className="w-32 px-3 py-1 border border-gray-600 rounded-md bg-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="30">30s</option>
              <option value="60">1min</option>
              <option value="90">1.5min</option>
              <option value="120">2min</option>
              <option value="180">3min</option>
              <option value="240">4min</option>
              <option value="300">5min</option>
            </select>
          </div>

          {/* Sets Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-medium text-sm">
                Sets:
              </span>
              <button
                onClick={addSet}
                className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
              >
                + Add Set
              </button>
            </div>
            
            {exercise.sets.map((set: any, setIndex: number) => (
              <div key={setIndex} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                <span className="text-gray-300 font-medium min-w-12 text-sm">
                  Set {setIndex + 1}:
                </span>
                
                <input
                  type="text"
                  placeholder="Reps"
                  value={formatReps(set.reps)}
                  onChange={(e) => handleRepsChange(setIndex, e.target.value)}
                  className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                <span className="text-gray-400 text-sm">
                  reps @
                </span>
                
                <input
                  type="number"
                  placeholder="Weight"
                  value={set.weight || ''}
                  onChange={(e) => handleWeightChange(setIndex, e.target.value)}
                  className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                <button
                  onClick={() => handleUnitToggle(setIndex)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium px-1 transition-colors"
                  title="Click to toggle between lbs and kg"
                >
                  {set.unit || weightUnit}
                </button>
                
                {exercise.sets.length > 1 && (
                  <button
                    onClick={() => removeSet(setIndex)}
                    className="p-1 text-red-600 hover:text-red-800 ml-auto"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};