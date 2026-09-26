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
import { Play, Plus, RotateCcw, Search } from 'lucide-react';

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
      {/* Summary: numbers are the interface, labels sit under them */}
      <dl className="grid grid-cols-3 gap-3 px-1">
        {[
          { value: stats.totalExercises, label: 'exercises' },
          { value: stats.totalSets, label: 'sets' },
          { value: stats.estimatedTime, label: 'min estimated' },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="sr-only">{stat.label}</dt>
            <dd
              className={`font-display font-tabular text-ink ${compactMode ? 'text-display' : 'text-display-lg'}`}
            >
              {stat.value}
            </dd>
            <dd aria-hidden="true" className="text-body-sm text-ink-muted">
              {stat.label}
            </dd>
          </div>
        ))}
      </dl>

      {/* Quick Add Exercise Search - Only show in non-compact mode */}
      {!compactMode && (
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          />
          <Input
            type="text"
            placeholder="Add exercises"
            aria-label="Add exercises"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-full pl-11"
          />

          {/* Quick Add Results */}
          {filteredExercises.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-2 divide-y divide-hairline overflow-hidden rounded-2xl bg-surface-raised">
              {filteredExercises.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => handleQuickExerciseAdd(exercise)}
                    className="flex min-h-touch-min w-full items-center gap-3 px-4 py-2 text-left text-body-sm text-ink transition-colors duration-snap hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{exercise.name}</span>
                      <span className="block truncate text-caption text-ink-muted">
                        {exercise.muscleGroup}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Exercises: rows on one subtle card, hairlines between */}
      <Card className={`${compactMode ? 'max-h-[28rem]' : 'max-h-[600px]'} overflow-y-auto`}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableItems}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y divide-hairline" aria-label="Exercises">
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
            </ul>
          </SortableContext>
        </DndContext>
      </Card>

      {/* Action Buttons */}
      {showActionButtons && (onStartWorkout || onClear) && (
        <div className="space-y-2 pt-2">
          {onStartWorkout && (
            <Button
              variant="primary"
              size={compactMode ? 'lg' : 'xl'}
              onClick={onStartWorkout}
              className="w-full"
            >
              <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" />
              Start workout
            </Button>
          )}
          {onClear && (
            <Button
              variant="ghost"
              onClick={onClear}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear and start over
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
