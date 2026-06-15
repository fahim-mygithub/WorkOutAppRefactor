import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Exercise } from '../../types/exercise';
import { ExercisePreviewModal } from './ExercisePreviewModal';
import { ExerciseSearchModal } from './ExerciseSearchModal';
import { useAppSelector } from '../../store/hooks';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

// Tailwind JIT can't resolve class names built from runtime strings, so the
// superset-group token keys (see ParsedWorkoutConfigurator.getSupersetColor)
// map to fully-spelled static class sets here.
const SUPERSET_COLORS: Record<
  string,
  { borderL: string; active: string }
> = {
  push: { borderL: 'border-l-muscle-push', active: 'text-muscle-push bg-muscle-push/15 border border-muscle-push/40' },
  pull: { borderL: 'border-l-muscle-pull', active: 'text-muscle-pull bg-muscle-pull/15 border border-muscle-pull/40' },
  legs: { borderL: 'border-l-muscle-legs', active: 'text-muscle-legs bg-muscle-legs/15 border border-muscle-legs/40' },
  core: { borderL: 'border-l-muscle-core', active: 'text-muscle-core bg-muscle-core/15 border border-muscle-core/40' },
  cardio: { borderL: 'border-l-muscle-cardio', active: 'text-muscle-cardio bg-muscle-cardio/15 border border-muscle-cardio/40' },
  'full-body': { borderL: 'border-l-muscle-full-body', active: 'text-muscle-full-body bg-muscle-full-body/15 border border-muscle-full-body/40' },
  mobility: { borderL: 'border-l-muscle-mobility', active: 'text-muscle-mobility bg-muscle-mobility/15 border border-muscle-mobility/40' },
};

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
  supersetColor = 'push',
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

  const ssColor = SUPERSET_COLORS[supersetColor] ?? SUPERSET_COLORS.push;

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
    <Card
      ref={setNodeRef}
      style={style}
      elevation={1}
      className={`bg-surface-raised p-4 transition-all duration-snap ${
        isDragging ? 'shadow-e3 rotate-1 z-50' : ''
      } ${
        isInSuperset
          ? `border-l-4 ${ssColor.borderL}`
          : isInSupersetMode
            ? 'border-l-4 border-l-warning animate-pulse'
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
            <svg className="w-4 h-4 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="font-semibold text-ink truncate hover:text-accent transition-colors duration-snap text-left"
              title="Click to preview exercise details"
            >
              {exercise.name}
            </button>
            <p className="text-body-sm text-ink-subtle">
              {exercise.sets.length} sets • Rest: {getRestTimeInMinutes()}min
            </p>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setShowSearchModal(true)}
            aria-label="Change Exercise"
            title="Change Exercise"
            className="text-ink-subtle hover:text-ink"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={handleSupersetClick}
            aria-label="Toggle superset"
            title={getSupersetTooltip()}
            className={
              isInSuperset
                ? ssColor.active
                : isInSupersetMode
                  ? 'text-warning bg-warning/15 border border-warning/40 animate-pulse'
                  : 'text-ink-subtle hover:text-ink'
            }
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            className="text-ink-subtle hover:text-ink"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label="Delete Exercise"
            title="Delete Exercise"
            className="text-danger hover:text-danger"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </IconButton>
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
        <div className="space-y-4 border-t border-border pt-4">
          {/* Rest Time Control */}
          <div className="flex items-center gap-2">
            <span className="text-ink-muted font-medium min-w-20 text-body-sm">
              Rest Time:
            </span>
            <Select
              value={String(exercise.sets[0]?.rest || 120)}
              onValueChange={(value) => handleRestTimeChange(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">1min</SelectItem>
                <SelectItem value="90">1.5min</SelectItem>
                <SelectItem value="120">2min</SelectItem>
                <SelectItem value="180">3min</SelectItem>
                <SelectItem value="240">4min</SelectItem>
                <SelectItem value="300">5min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sets Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted font-medium text-body-sm">
                Sets:
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={addSet}
                className="text-success"
              >
                + Add Set
              </Button>
            </div>

            {exercise.sets.map((set: any, setIndex: number) => (
              <div key={setIndex} className="flex items-center gap-2 p-2 bg-surface-subtle rounded">
                <span className="text-ink-muted font-medium min-w-12 text-body-sm">
                  Set {setIndex + 1}:
                </span>

                <Input
                  type="text"
                  placeholder="Reps"
                  value={formatReps(set.reps)}
                  onChange={(e) => handleRepsChange(setIndex, e.target.value)}
                  size="sm"
                  className="w-20"
                />

                <span className="text-ink-subtle text-body-sm">
                  reps @
                </span>

                <Input
                  type="number"
                  placeholder="Weight"
                  value={set.weight || ''}
                  onChange={(e) => handleWeightChange(setIndex, e.target.value)}
                  size="sm"
                  className="w-20"
                />

                <button
                  onClick={() => handleUnitToggle(setIndex)}
                  className="text-accent hover:text-accent/80 text-body-sm font-medium px-1 transition-colors duration-snap"
                  title="Click to toggle between lbs and kg"
                >
                  {set.unit || weightUnit}
                </button>

                {exercise.sets.length > 1 && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSet(setIndex)}
                    aria-label={`Remove set ${setIndex + 1}`}
                    className="text-danger hover:text-danger ml-auto"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
