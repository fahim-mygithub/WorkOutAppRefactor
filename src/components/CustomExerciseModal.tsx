import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { CustomExercise, SaveCustomExerciseData } from '../services/customExerciseService';
import { ExerciseDifficulty } from '../types/exercise';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { cn } from '../lib/utils';

interface CustomExerciseModalProps {
  isOpen: boolean;
  exercise?: CustomExercise | null;
  onClose: () => void;
  onSave: (exerciseData: SaveCustomExerciseData) => void;
}

type SaveDifficulty = SaveCustomExerciseData['difficulty'];

/** Form state: like the save payload, but the step list is always present. */
type CustomExerciseForm = Omit<SaveCustomExerciseData, 'instructions'> & {
  instructions: string[];
};

const muscleGroups = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Core', 'Calves', 'Forearms', 'Full Body'
];

const equipmentOptions = [
  'Bodyweight', 'Dumbbells', 'Barbell', 'Kettlebell',
  'Cable', 'Machine', 'Resistance Band', 'Medicine Ball',
  'Pull-up Bar', 'Bench', 'None'
];

const difficultyLevels: SaveDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

// Catalog difficulties are five-level; custom exercises save one of three.
const toSaveDifficulty = (difficulty: ExerciseDifficulty): SaveDifficulty => {
  if (difficulty === 'Novice') return 'Beginner';
  if (difficulty === 'Expert') return 'Advanced';
  return difficulty;
};

const emptyForm = (): CustomExerciseForm => ({
  originalName: '',
  name: '',
  muscleGroup: 'Chest',
  equipment: 'Dumbbells',
  difficulty: 'Intermediate',
  instructions: [''],
  notes: ''
});

/**
 * Create / edit a custom exercise (Tempo sheet). The essentials (name, muscle,
 * equipment, difficulty, steps) are up front; video links and notes sit behind
 * "More details". One amber "Save exercise" at the bottom.
 */
export const CustomExerciseModal: React.FC<CustomExerciseModalProps> = ({
  isOpen,
  exercise,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<CustomExerciseForm>(emptyForm);

  const [videoUrls, setVideoUrls] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (exercise) {
      setFormData({
        originalName: exercise.originalName,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        difficulty: toSaveDifficulty(exercise.difficulty),
        instructions: exercise.instructions?.length ? exercise.instructions : [''],
        notes: exercise.notes || ''
      });
      setVideoUrls(exercise.videoLinks || ['']);
      // Open the extra fields when there is something in them to edit.
      setShowMore(Boolean(exercise.notes || exercise.videoLinks?.some(Boolean)));
    } else {
      setFormData(emptyForm());
      setVideoUrls(['']);
      setShowMore(false);
    }
    setErrors({});
  }, [exercise, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Give the exercise a name.';
    }

    if (!formData.muscleGroup) {
      newErrors.muscleGroup = 'Pick the main muscle it works.';
    }

    if (!formData.equipment) {
      newErrors.equipment = 'Pick the equipment it uses.';
    }

    const validUrls = videoUrls.filter(url => url.trim());
    for (const url of validUrls) {
      try {
        new URL(url);
      } catch {
        newErrors.videoUrls = 'Video links need to be full web addresses, starting with https://';
        setShowMore(true);
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const saveData: SaveCustomExerciseData = {
      ...formData,
      originalName: formData.originalName || formData.name,
      instructions: formData.instructions.filter(inst => inst.trim()),
      videoLinks: videoUrls.filter(url => url.trim())
    };

    try {
      await onSave(saveData);
      onClose();
    } catch (error) {
      console.error('Error saving exercise:', error);
      setErrors({ general: "Couldn't save the exercise. Check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...formData.instructions];
    newInstructions[index] = value;
    setFormData({ ...formData, instructions: newInstructions });
  };

  const addInstruction = () => {
    setFormData({
      ...formData,
      instructions: [...formData.instructions, '']
    });
  };

  const removeInstruction = (index: number) => {
    const newInstructions = formData.instructions.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      instructions: newInstructions.length > 0 ? newInstructions : ['']
    });
  };

  const handleVideoUrlChange = (index: number, value: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  };

  const addVideoUrl = () => {
    setVideoUrls([...videoUrls, '']);
  };

  const removeVideoUrl = (index: number) => {
    const newUrls = videoUrls.filter((_, i) => i !== index);
    setVideoUrls(newUrls.length > 0 ? newUrls : ['']);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose();
    }
  };

  const chipClass = (selected: boolean) =>
    cn(
      'min-h-touch-min rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      selected ? 'bg-accent-2 text-accent-2-fg' : 'bg-surface-raised text-ink-muted hover:text-ink',
    );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="mx-auto max-w-2xl">
        <form onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-title">
                {exercise ? 'Edit exercise' : 'New exercise'}
              </SheetTitle>
              <SheetDescription>
                {exercise
                  ? 'Changes apply wherever you use this exercise.'
                  : "Add a move that isn't in the library."}
              </SheetDescription>
            </div>
            <IconButton
              variant="ghost"
              aria-label="Close"
              onClick={() => handleOpenChange(false)}
            >
              <X size={20} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="mt-6 space-y-6">
            {errors.general && (
              <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-body-sm text-danger">
                {errors.general}
              </p>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="custom-exercise-name" className="text-ink-muted" required>
                Name
              </Label>
              <Input
                id="custom-exercise-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'custom-exercise-name-error' : undefined}
                placeholder="Dumbbell chest fly"
              />
              {errors.name && (
                <p id="custom-exercise-name-error" className="text-body-sm text-danger">{errors.name}</p>
              )}
            </div>

            {/* Muscle group */}
            <fieldset className="space-y-2">
              <legend className="mb-2 text-body-sm font-medium text-ink-muted">
                Main muscle<span aria-hidden="true" className="text-danger"> *</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {muscleGroups.map(group => (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={formData.muscleGroup === group}
                    onClick={() => setFormData({ ...formData, muscleGroup: group })}
                    className={chipClass(formData.muscleGroup === group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
              {errors.muscleGroup && (
                <p className="text-body-sm text-danger">{errors.muscleGroup}</p>
              )}
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Equipment */}
              <div className="space-y-2">
                <Label htmlFor="custom-equipment" className="text-ink-muted" required>
                  Equipment
                </Label>
                <Select
                  value={formData.equipment}
                  onValueChange={(value) => setFormData({ ...formData, equipment: value })}
                >
                  <SelectTrigger id="custom-equipment">
                    <SelectValue placeholder="Pick equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentOptions.map(equip => (
                      <SelectItem key={equip} value={equip}>{equip}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.equipment && (
                  <p className="text-body-sm text-danger">{errors.equipment}</p>
                )}
              </div>

              {/* Difficulty: three-way segmented control */}
              <fieldset>
                <legend className="mb-2 text-body-sm font-medium text-ink-muted">Difficulty</legend>
                <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-raised p-1">
                  {difficultyLevels.map(level => {
                    const selected = formData.difficulty === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setFormData({ ...formData, difficulty: level })}
                        className={cn(
                          'min-h-9 rounded-full px-2 text-body-sm font-semibold transition-colors duration-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          selected ? 'bg-surface-subtle text-ink' : 'text-ink-muted hover:text-ink',
                        )}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* Steps */}
            <section aria-labelledby="custom-steps-heading" className="space-y-3">
              <h3 id="custom-steps-heading" className="text-body-sm font-medium text-ink-muted">
                How to do it
              </h3>

              {formData.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-3 w-5 shrink-0 text-right font-num font-tabular font-bold text-ink"
                  >
                    {index + 1}
                  </span>
                  <Textarea
                    value={instruction}
                    onChange={(e) => handleInstructionChange(index, e.target.value)}
                    rows={2}
                    className="min-h-0 flex-1 resize-none"
                    aria-label={`Step ${index + 1}`}
                    placeholder={index === 0 ? 'Lie back on a flat bench' : 'Next step'}
                  />
                  {formData.instructions.length > 1 && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      aria-label={`Remove step ${index + 1}`}
                      onClick={() => removeInstruction(index)}
                    >
                      <X size={18} aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
              ))}

              <Button type="button" variant="ghost" size="sm" onClick={addInstruction}>
                <Plus size={16} aria-hidden="true" />
                Add step
              </Button>
            </section>

            {/* More details: video links + notes, one tap away */}
            <div>
              <button
                type="button"
                aria-expanded={showMore}
                aria-controls="custom-exercise-more"
                onClick={() => setShowMore(v => !v)}
                className="flex min-h-touch-min w-full items-center justify-between rounded-2xl bg-surface-raised/50 px-4 text-left text-body-sm font-semibold text-ink transition-colors duration-snap hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                More details
                <span className="flex items-center gap-2 font-normal text-ink-muted">
                  Video links, notes
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={cn('transition-transform duration-snap', showMore && 'rotate-180')}
                  />
                </span>
              </button>

              {showMore && (
                <div id="custom-exercise-more" className="mt-4 space-y-6">
                  <div className="space-y-3">
                    <p className="text-body-sm font-medium text-ink-muted">Video links</p>
                    {videoUrls.map((url, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="url"
                          inputMode="url"
                          value={url}
                          onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                          aria-label={`Video link ${index + 1}`}
                          aria-invalid={errors.videoUrls ? true : undefined}
                          placeholder="https://example.com/video.mp4"
                          className="flex-1"
                        />
                        {videoUrls.length > 1 && (
                          <IconButton
                            type="button"
                            variant="ghost"
                            aria-label={`Remove video link ${index + 1}`}
                            onClick={() => removeVideoUrl(index)}
                          >
                            <X size={18} aria-hidden="true" />
                          </IconButton>
                        )}
                      </div>
                    ))}

                    {errors.videoUrls && (
                      <p className="text-body-sm text-danger">{errors.videoUrls}</p>
                    )}

                    <Button type="button" variant="ghost" size="sm" onClick={addVideoUrl}>
                      <Plus size={16} aria-hidden="true" />
                      Add video link
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-notes" className="text-ink-muted">Notes</Label>
                    <Textarea
                      id="custom-notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="resize-none"
                      placeholder="Cues, setup, anything you want to remember"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-2">
            <Button type="submit" size="xl" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : exercise ? 'Save changes' : 'Save exercise'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
