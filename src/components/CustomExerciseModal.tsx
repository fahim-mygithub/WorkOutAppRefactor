import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Video, Info } from 'lucide-react';
import { CustomExercise, SaveCustomExerciseData } from '../services/customExerciseService';
import { ExerciseDifficulty } from '../types/exercise';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Stack } from './ui/stack';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface CustomExerciseModalProps {
  isOpen: boolean;
  exercise?: CustomExercise | null;
  onClose: () => void;
  onSave: (exerciseData: SaveCustomExerciseData) => void;
}

const muscleGroups = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Core', 'Calves', 'Forearms', 'Full Body'
];

const equipmentOptions = [
  'Bodyweight', 'Dumbbells', 'Barbell', 'Kettlebell',
  'Cable', 'Machine', 'Resistance Band', 'Medicine Ball',
  'Pull-up Bar', 'Bench', 'None'
];

const difficultyLevels: ExerciseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

export const CustomExerciseModal: React.FC<CustomExerciseModalProps> = ({
  isOpen,
  exercise,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<SaveCustomExerciseData>({
    originalName: '',
    name: '',
    muscleGroup: 'Chest',
    equipment: 'Dumbbells',
    difficulty: 'Intermediate',
    instructions: [''],
    notes: ''
  });

  const [videoUrls, setVideoUrls] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (exercise) {
      setFormData({
        originalName: exercise.originalName,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        difficulty: exercise.difficulty,
        instructions: exercise.instructions || [''],
        notes: exercise.notes || ''
      });
      setVideoUrls(exercise.videoLinks || ['']);
    } else {
      setFormData({
        originalName: '',
        name: '',
        muscleGroup: 'Chest',
        equipment: 'Dumbbells',
        difficulty: 'Intermediate',
        instructions: [''],
        notes: ''
      });
      setVideoUrls(['']);
    }
    setErrors({});
  }, [exercise, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Exercise name is required';
    }

    if (!formData.muscleGroup) {
      newErrors.muscleGroup = 'Muscle group is required';
    }

    if (!formData.equipment) {
      newErrors.equipment = 'Equipment is required';
    }

    const validUrls = videoUrls.filter(url => url.trim());
    for (const url of validUrls) {
      try {
        new URL(url);
      } catch {
        newErrors.videoUrls = 'Please enter valid URLs';
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
      setErrors({ general: 'Failed to save exercise. Please try again.' });
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

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <SheetTitle className="text-title mb-4">
            {exercise ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
          </SheetTitle>

          {/* Content */}
          <div className="space-y-6">
            {errors.general && (
              <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-md">
                {errors.general}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-body font-medium text-ink flex items-center">
                <Info className="w-5 h-5 mr-2" />
                Basic Information
              </h4>

              <Stack gap={2}>
                <Label htmlFor="custom-exercise-name" required>
                  Exercise Name
                </Label>
                <Input
                  id="custom-exercise-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  aria-invalid={errors.name ? true : undefined}
                  placeholder="e.g., Dumbbell Chest Fly"
                />
                {errors.name && (
                  <p className="text-body-sm text-danger">{errors.name}</p>
                )}
              </Stack>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Stack gap={2}>
                  <Label htmlFor="custom-muscle-group" required>
                    Muscle Group
                  </Label>
                  <Select
                    value={formData.muscleGroup}
                    onValueChange={(value) => setFormData({ ...formData, muscleGroup: value })}
                  >
                    <SelectTrigger id="custom-muscle-group">
                      <SelectValue placeholder="Select muscle group" />
                    </SelectTrigger>
                    <SelectContent>
                      {muscleGroups.map(group => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Stack>

                <Stack gap={2}>
                  <Label htmlFor="custom-equipment" required>
                    Equipment
                  </Label>
                  <Select
                    value={formData.equipment}
                    onValueChange={(value) => setFormData({ ...formData, equipment: value })}
                  >
                    <SelectTrigger id="custom-equipment">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentOptions.map(equip => (
                        <SelectItem key={equip} value={equip}>{equip}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Stack>

                <Stack gap={2}>
                  <Label htmlFor="custom-difficulty">Difficulty</Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      difficulty: value as ExerciseDifficulty
                    })}
                  >
                    <SelectTrigger id="custom-difficulty">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficultyLevels.map(level => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Stack>
              </div>
            </div>

            {/* Video Links */}
            <div className="space-y-4">
              <h4 className="text-body font-medium text-ink flex items-center">
                <Video className="w-5 h-5 mr-2" />
                Video Links
              </h4>

              {videoUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={url}
                      onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                      placeholder="https://example.com/video.mp4"
                    />
                  </div>
                  {videoUrls.length > 1 && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      aria-label={`Remove video link ${index + 1}`}
                      onClick={() => removeVideoUrl(index)}
                      className="text-danger"
                    >
                      <Trash2 className="w-5 h-5" />
                    </IconButton>
                  )}
                </div>
              ))}

              {errors.videoUrls && (
                <p className="text-body-sm text-danger">{errors.videoUrls}</p>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addVideoUrl}
                className="text-accent"
              >
                <Plus className="w-4 h-4" />
                Add Video Link
              </Button>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <h4 className="text-body font-medium text-ink">Instructions</h4>

              {formData.instructions.map((instruction, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Textarea
                      value={instruction}
                      onChange={(e) => handleInstructionChange(index, e.target.value)}
                      rows={2}
                      className="resize-none"
                      placeholder={`Step ${index + 1}...`}
                    />
                  </div>
                  {formData.instructions.length > 1 && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      aria-label={`Remove instruction step ${index + 1}`}
                      onClick={() => removeInstruction(index)}
                      className="text-danger"
                    >
                      <Trash2 className="w-5 h-5" />
                    </IconButton>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addInstruction}
                className="text-accent"
              >
                <Plus className="w-4 h-4" />
                Add Instruction Step
              </Button>
            </div>

            {/* Notes */}
            <Stack gap={2}>
              <Label htmlFor="custom-notes">Additional Notes</Label>
              <Textarea
                id="custom-notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="resize-none"
                placeholder="Any additional tips or notes..."
              />
            </Stack>
          </div>

          {/* Footer */}
          <Stack direction="row" justify="end" gap={3} className="border-t border-border mt-6 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : (exercise ? 'Update' : 'Create')}
            </Button>
          </Stack>
        </form>
      </SheetContent>
    </Sheet>
  );
};
