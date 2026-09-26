import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Exercise } from '../../types/exercise';
import { ExercisePreviewModal } from './ExercisePreviewModal';
import { ExerciseSearchModal } from './ExerciseSearchModal';
import { useAppSelector } from '../../store/hooks';
import { ChevronDown, GripVertical, Link2, Plus, Replace, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
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
const SUPERSET_COLORS: Record<string, { bar: string; text: string }> = {
  push: { bar: 'bg-muscle-push', text: 'text-muscle-push' },
  pull: { bar: 'bg-muscle-pull', text: 'text-muscle-pull' },
  legs: { bar: 'bg-muscle-legs', text: 'text-muscle-legs' },
  core: { bar: 'bg-muscle-core', text: 'text-muscle-core' },
  cardio: { bar: 'bg-muscle-cardio', text: 'text-muscle-cardio' },
  'full-body': { bar: 'bg-muscle-full-body', text: 'text-muscle-full-body' },
  mobility: { bar: 'bg-muscle-mobility', text: 'text-muscle-mobility' },
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
      return "Tap another exercise to pair them as a superset";
    } else if (isInSuperset && supersetGroup) {
      return `In superset ${supersetGroup}. Tap to remove`;
    } else {
      return "Start a superset";
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
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative list-none py-3 pl-4 pr-2 transition-colors duration-snap',
        isDragging && 'z-50 rounded-2xl bg-surface-raised',
      )}
    >
      {/* Superset membership: a muscle-hue bar on the row's leading edge
          (amber-free: amber is the page's one action). */}
      {(isInSuperset || isInSupersetMode) && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-3 left-0 top-3 w-1 rounded-full',
            isInSuperset ? ssColor.bar : 'bg-ink-muted animate-pulse',
          )}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${exercise.name}`}
          className="-ml-2 flex h-touch-min w-8 shrink-0 cursor-grab items-center justify-center rounded-full text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="block max-w-full truncate text-left text-body font-semibold text-ink transition-colors duration-snap hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="Preview exercise details"
          >
            {exercise.name}
          </button>
          <p className="text-body-sm text-ink-muted">
            <span className="font-tabular">{exercise.sets.length}</span> set{exercise.sets.length !== 1 ? 's' : ''}
            {' · '}
            <span className="font-tabular">{getRestTimeInMinutes()}</span> min rest
            {isInSuperset && supersetGroup ? (
              <span className={ssColor.text}>{` · Superset ${supersetGroup}`}</span>
            ) : isInSupersetMode ? (
              <span className="text-ink">{' · Pick a partner'}</span>
            ) : null}
          </p>
        </div>

        <IconButton
          variant="ghost"
          onClick={handleSupersetClick}
          aria-label="Toggle superset"
          aria-pressed={isInSuperset || isInSupersetMode}
          title={getSupersetTooltip()}
          className={
            isInSuperset
              ? cn(ssColor.text, 'bg-surface-raised')
              : isInSupersetMode
                ? 'bg-surface-raised text-ink'
                : undefined
          }
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-snap', isExpanded && 'rotate-180')}
            aria-hidden="true"
          />
        </IconButton>
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

      {/* Expanded content: detail lives one tap away */}
      {isExpanded && (
        <div className="mt-3 space-y-4 pr-2">
          {/* Rest Time Control */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm text-ink-muted">Rest between sets</span>
            <Select
              value={String(exercise.sets[0]?.rest || 120)}
              onValueChange={(value) => handleRestTimeChange(value)}
            >
              <SelectTrigger className="w-32" aria-label="Rest between sets">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 s</SelectItem>
                <SelectItem value="60">1 min</SelectItem>
                <SelectItem value="90">1.5 min</SelectItem>
                <SelectItem value="120">2 min</SelectItem>
                <SelectItem value="180">3 min</SelectItem>
                <SelectItem value="240">4 min</SelectItem>
                <SelectItem value="300">5 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sets: a compact grid, labels once above the columns */}
          <div>
            <div
              aria-hidden="true"
              className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] gap-2 pb-1 text-caption text-ink-subtle"
            >
              <span>Set</span>
              <span>Reps</span>
              <span>Weight</span>
              <span className="col-span-2" />
            </div>
            <ul className="space-y-2">
              {exercise.sets.map((set: any, setIndex: number) => (
                <li
                  key={setIndex}
                  className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2"
                >
                  <span className="font-display font-tabular text-body text-ink-muted">
                    {setIndex + 1}
                  </span>

                  <Input
                    type="text"
                    placeholder="Reps"
                    aria-label={`Set ${setIndex + 1} reps`}
                    value={formatReps(set.reps)}
                    onChange={(e) => handleRepsChange(setIndex, e.target.value)}
                  />

                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Set ${setIndex + 1} weight`}
                    value={set.weight || ''}
                    onChange={(e) => handleWeightChange(setIndex, e.target.value)}
                  />

                  <button
                    type="button"
                    onClick={() => handleUnitToggle(setIndex)}
                    className="h-touch-min rounded-full bg-surface-raised text-body-sm font-semibold text-ink-muted transition-colors duration-snap hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    title="Switch between lbs and kg"
                    aria-label={`Set ${setIndex + 1} unit: ${set.unit || weightUnit}. Switch unit`}
                  >
                    {set.unit || weightUnit}
                  </button>

                  {exercise.sets.length > 1 ? (
                    <IconButton
                      variant="ghost"
                      onClick={() => removeSet(setIndex)}
                      aria-label={`Remove set ${setIndex + 1}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Row-level actions, quiet */}
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" onClick={addSet}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add set
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSearchModal(true)}
              aria-label="Change exercise"
            >
              <Replace className="h-4 w-4" aria-hidden="true" />
              Change
            </Button>
            <Button
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete exercise"
              className="ml-auto text-danger hover:text-danger"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </li>
  );
};
