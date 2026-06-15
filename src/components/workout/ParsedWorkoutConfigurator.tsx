import React, { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
// import {
//   restrictToVerticalAxis,
//   restrictToWindowEdges,
// } from '@dnd-kit/modifiers';

import { useAppSelector } from '../../store/hooks';
import { ExerciseConfigCard } from './ExerciseConfigCard';
import { Exercise } from '../../types/exercise';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ParsedWorkoutConfiguratorProps {
  workout: any;
  onUpdate: (updatedWorkout: any) => void;
  onStartWorkout?: () => void;
  onClear?: () => void;
  showActionButtons?: boolean;
  compactMode?: boolean;
  className?: string;
}

export const ParsedWorkoutConfigurator: React.FC<ParsedWorkoutConfiguratorProps> = ({
  workout,
  onUpdate,
  onStartWorkout,
  onClear,
  showActionButtons = true,
  compactMode = false,
  className = '',
}) => {
  const { exercises } = useAppSelector((state) => state.exercise);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  // Superset state management
  const [supersetMode, setSupersetMode] = useState<number | null>(null);
  const [supersetGroups, setSupersetGroups] = useState<Map<number, number>>(new Map());
  const [nextSupersetGroup, setNextSupersetGroup] = useState(1);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter exercises based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredExercises([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = exercises
      .filter(exercise =>
        exercise.name.toLowerCase().includes(term) ||
        exercise.muscleGroup.toLowerCase().includes(term) ||
        exercise.equipment.toLowerCase().includes(term)
      )
      .slice(0, 5); // Show only top 5 results

    setFilteredExercises(filtered);
  }, [exercises, searchTerm]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = workout.exercises.findIndex((ex: any, idx: number) =>
        `exercise-${idx}` === active.id
      );
      const newIndex = workout.exercises.findIndex((ex: any, idx: number) =>
        `exercise-${idx}` === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        const newExercises = arrayMove(workout.exercises, oldIndex, newIndex);
        onUpdate({
          ...workout,
          exercises: newExercises,
        });
      }
    }
  }, [workout, onUpdate]);

  const handleUpdateExercise = useCallback((exerciseIndex: number, updatedExercise: any) => {
    if (!workout) return;

    const newExercises = [...workout.exercises];
    newExercises[exerciseIndex] = updatedExercise;

    onUpdate({
      ...workout,
      exercises: newExercises,
    });
  }, [workout, onUpdate]);

  const handleDeleteExercise = useCallback((exerciseIndex: number) => {
    if (!workout) return;

    const newExercises = workout.exercises.filter((_: any, idx: number) => idx !== exerciseIndex);

    onUpdate({
      ...workout,
      exercises: newExercises,
    });
  }, [workout, onUpdate]);

  const handleReplaceExercise = useCallback((exerciseIndex: number, newExercise: Exercise) => {
    if (!workout) return;

    const newExercises = [...workout.exercises];
    const currentExercise = newExercises[exerciseIndex];

    // Keep the current sets and rest time but replace the exercise name
    newExercises[exerciseIndex] = {
      ...currentExercise,
      name: newExercise.name,
    };

    onUpdate({
      ...workout,
      exercises: newExercises,
    });
  }, [workout, onUpdate]);

  // Helper function to find exercise in database
  const findExerciseInDatabase = useCallback((exerciseName: string): Exercise | null => {
    const name = exerciseName.toLowerCase();
    return exercises.find(ex =>
      ex.name.toLowerCase() === name ||
      ex.name.toLowerCase().includes(name) ||
      name.includes(ex.name.toLowerCase()) ||
      ex.searchKeywords.some(keyword => keyword.includes(name))
    ) || null;
  }, [exercises]);

  const handleQuickExerciseAdd = useCallback((exercise: Exercise) => {
    if (!workout) return;

    const newExercise = {
      name: exercise.name,
      sets: [{ reps: 10, rest: 120 }], // Default: 1 set of 10 reps with 2min rest
    };

    onUpdate({
      ...workout,
      exercises: [...workout.exercises, newExercise],
    });

    setSearchTerm('');
    setFilteredExercises([]);
  }, [workout, onUpdate]);

  // Handle superset toggling
  const handleToggleSuperset = useCallback((exerciseIndex: number) => {
    if (supersetMode === null) {
      // Start new superset group
      setSupersetMode(exerciseIndex);
    } else if (supersetMode === exerciseIndex) {
      // Cancel superset mode
      setSupersetMode(null);
    } else {
      // Create superset between two exercises
      const groupId = nextSupersetGroup;
      setSupersetGroups(prev => {
        const next = new Map(prev);
        next.set(supersetMode, groupId);
        next.set(exerciseIndex, groupId);
        return next;
      });
      setNextSupersetGroup(prev => prev + 1);
      setSupersetMode(null);
    }
  }, [supersetMode, nextSupersetGroup]);

  // Remove exercise from superset
  const handleRemoveFromSuperset = useCallback((exerciseIndex: number) => {
    setSupersetGroups(prev => {
      const next = new Map(prev);
      const groupId = next.get(exerciseIndex);
      if (groupId) {
        // Remove this exercise from the group
        next.delete(exerciseIndex);

        // Check if only one exercise remains in this group
        const remainingInGroup = Array.from(next.entries())
          .filter(([_, gId]) => gId === groupId);

        if (remainingInGroup.length === 1) {
          // Remove the last exercise from the group as well
          next.delete(remainingInGroup[0][0]);
        }
      }
      return next;
    });
  }, []);

  // Get superset color based on group ID. Returns a muscle-group token key
  // (resolved to static classes inside ExerciseConfigCard's SUPERSET_COLORS map,
  // since Tailwind JIT can't see dynamically-built class names).
  const getSupersetColor = useCallback((groupId: number) => {
    const colors = ['push', 'core', 'full-body', 'legs', 'cardio', 'mobility', 'pull'];
    return colors[(groupId - 1) % colors.length];
  }, []);

  if (!workout) return null;

  const getTotalStats = () => {
    let totalExercises = workout.exercises.length;
    let totalSets = 0;
    let estimatedTime = 0;

    workout.exercises.forEach((exercise: any) => {
      const setCount = exercise.sets.length;
      totalSets += setCount;

      // Estimate time: ~45s per set + rest time
      estimatedTime += setCount * 45;
      const restTime = exercise.sets[0]?.rest || 120;
      estimatedTime += setCount * restTime;
    });

    return {
      totalExercises,
      totalSets,
      estimatedTime: Math.round(estimatedTime / 60), // Convert to minutes
    };
  };

  const stats = getTotalStats();

  // Create sortable items with unique IDs
  const sortableItems = workout.exercises.map((_: any, index: number) => `exercise-${index}`);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Quick Add Exercise Search - Only show in non-compact mode */}
      {!compactMode && (
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
            <svg className="w-4 h-4 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Input
            type="text"
            placeholder="Add exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="sm"
            className="pl-10"
          />

          {/* Quick Add Results */}
          {filteredExercises.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-surface-raised border border-border rounded-md shadow-e3 z-50 mt-1">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => handleQuickExerciseAdd(exercise)}
                  className="w-full px-3 py-2 text-left hover:bg-surface-subtle flex items-center gap-2 transition-colors duration-snap text-ink text-body-sm"
                >
                  <svg className="w-3 h-3 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{exercise.name}</div>
                    <div className="text-caption text-ink-subtle truncate">
                      {exercise.muscleGroup}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compact Workout Stats */}
      <div className={`grid ${compactMode ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-4'}`}>
        <Card elevation={0} className="text-center bg-surface-subtle p-2">
          <div className={`font-bold text-accent ${compactMode ? 'text-title' : 'text-display-lg'}`}>
            {stats.totalExercises}
          </div>
          <p className="text-ink-subtle text-caption">Exercises</p>
        </Card>
        <Card elevation={0} className="text-center bg-surface-subtle p-2">
          <div className={`font-bold text-success ${compactMode ? 'text-title' : 'text-display-lg'}`}>
            {stats.totalSets}
          </div>
          <p className="text-ink-subtle text-caption">Total Sets</p>
        </Card>
        <Card elevation={0} className="text-center bg-surface-subtle p-2">
          <div className={`font-bold text-muscle-legs ${compactMode ? 'text-title' : 'text-display-lg'}`}>
            {stats.estimatedTime}min
          </div>
          <p className="text-ink-subtle text-caption">Est. Time</p>
        </Card>
      </div>

      {/* Workout Configuration - Scrollable */}
      <div className={`${compactMode ? 'max-h-96' : 'max-h-[600px]'} overflow-y-auto`}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableItems}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {workout.exercises.map((exercise: any, index: number) => (
                <ExerciseConfigCard
                  key={`exercise-${index}`}
                  id={`exercise-${index}`}
                  exercise={exercise}
                  onUpdate={(updatedExercise) => handleUpdateExercise(index, updatedExercise)}
                  onDelete={() => handleDeleteExercise(index)}
                  onReplaceExercise={(newExercise) => handleReplaceExercise(index, newExercise)}
                  onToggleSuperset={() => handleToggleSuperset(index)}
                  isInSuperset={supersetGroups.has(index)}
                  supersetGroup={supersetGroups.get(index)}
                  supersetColor={supersetGroups.has(index) ? getSupersetColor(supersetGroups.get(index)!) : undefined}
                  isInSupersetMode={supersetMode === index}
                  onRemoveFromSuperset={() => handleRemoveFromSuperset(index)}
                  exerciseDatabase={exercises}
                  dbExercise={findExerciseInDatabase(exercise.name)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Action Buttons */}
      {showActionButtons && (
        <div className="space-y-2 pt-4 border-t border-border">
          {onStartWorkout && (
            <Button
              variant="primary"
              size={compactMode ? 'md' : 'lg'}
              onClick={onStartWorkout}
              className="w-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
              Start Workout
            </Button>
          )}
          {onClear && (
            <Button
              variant="secondary"
              size={compactMode ? 'md' : 'lg'}
              onClick={onClear}
              className="w-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Clear & Start Over
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
