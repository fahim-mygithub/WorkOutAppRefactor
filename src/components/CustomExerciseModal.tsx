import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Video, Info, Link } from 'lucide-react';
import { CustomExercise, SaveCustomExerciseData } from '../services/customExerciseService';
import { ExerciseDifficulty } from '../types/exercise';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative transform overflow-hidden rounded-lg bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-white">
                  {exercise ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {errors.general && (
                  <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                    {errors.general}
                  </div>
                )}

                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white flex items-center">
                    <Info className="w-5 h-5 mr-2" />
                    Basic Information
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Exercise Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full p-3 bg-gray-700 border ${
                        errors.name ? 'border-red-500' : 'border-gray-600'
                      } rounded-lg text-white focus:ring-2 focus:ring-blue-500`}
                      placeholder="e.g., Dumbbell Chest Fly"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Muscle Group *
                      </label>
                      <select
                        value={formData.muscleGroup}
                        onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
                        className={`w-full p-3 bg-gray-700 border ${
                          errors.muscleGroup ? 'border-red-500' : 'border-gray-600'
                        } rounded-lg text-white focus:ring-2 focus:ring-blue-500`}
                      >
                        {muscleGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Equipment *
                      </label>
                      <select
                        value={formData.equipment}
                        onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                        className={`w-full p-3 bg-gray-700 border ${
                          errors.equipment ? 'border-red-500' : 'border-gray-600'
                        } rounded-lg text-white focus:ring-2 focus:ring-blue-500`}
                      >
                        {equipmentOptions.map(equip => (
                          <option key={equip} value={equip}>{equip}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Difficulty
                      </label>
                      <select
                        value={formData.difficulty}
                        onChange={(e) => setFormData({
                          ...formData,
                          difficulty: e.target.value as ExerciseDifficulty
                        })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      >
                        {difficultyLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Video Links */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white flex items-center">
                    <Video className="w-5 h-5 mr-2" />
                    Video Links
                  </h4>

                  {videoUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                          placeholder="https://example.com/video.mp4"
                        />
                      </div>
                      {videoUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVideoUrl(index)}
                          className="p-3 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {errors.videoUrls && (
                    <p className="text-sm text-red-400">{errors.videoUrls}</p>
                  )}

                  <button
                    type="button"
                    onClick={addVideoUrl}
                    className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Video Link</span>
                  </button>
                </div>

                {/* Instructions */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">
                    Instructions
                  </h4>

                  {formData.instructions.map((instruction, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <textarea
                          value={instruction}
                          onChange={(e) => handleInstructionChange(index, e.target.value)}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          placeholder={`Step ${index + 1}...`}
                        />
                      </div>
                      {formData.instructions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInstruction(index)}
                          className="p-3 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addInstruction}
                    className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Instruction Step</span>
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    placeholder="Any additional tips or notes..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-700 px-6 py-4">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition duration-200"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving...' : (exercise ? 'Update' : 'Create')}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};