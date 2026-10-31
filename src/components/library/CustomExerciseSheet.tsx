import { useState, useEffect, useRef, useId } from 'react';
import { Camera, Film, Loader2, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  saveCustomExercise,
  updateCustomExercise,
} from '../../store/slices/customExerciseSlice';
import type {
  CustomExercise,
  SaveCustomExerciseData,
} from '../../services/customExerciseService';
import { uploadMedia, type MediaUploadResult } from '../../ai/mediaUpload';
import { isBackendAvailable, isSignedIn } from '../../ai/aiClient';
import { LibraryMediaClip } from './LibraryMediaClip';

export interface CustomExerciseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing custom exercise to edit; undefined to create new. */
  exercise?: CustomExercise | null;
  /** Prefilled name (e.g. from empty search query). */
  prefillName?: string;
  onSaved?: (saved: CustomExercise) => void;
  /** Test override for media upload. */
  uploadFile?: (file: File | Blob) => Promise<MediaUploadResult>;
}

export function CustomExerciseSheet({
  open,
  onOpenChange,
  exercise,
  prefillName = '',
  onSaved,
  uploadFile = uploadMedia,
}: CustomExerciseSheetProps) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.user?.profile?.uid);
  const aiOff = useAppSelector((s) => Boolean(s.ai?.disabledReason));
  const aiUsable = !aiOff && isBackendAvailable() && isSignedIn();

  const id = useId();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [cues, setCues] = useState('');
  const [notes, setNotes] = useState('');
  const [videoLinks, setVideoLinks] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exercise) {
      setName(exercise.name || '');
      setMuscleGroup(exercise.muscleGroup || '');
      setEquipment(exercise.equipment || '');
      setCues(exercise.instructions?.join('\n') || '');
      setNotes(exercise.notes || '');
      setVideoLinks(exercise.videoLinks || []);
    } else {
      setName(prefillName || '');
      setMuscleGroup('');
      setEquipment('');
      setCues('');
      setNotes('');
      setVideoLinks([]);
    }
    setError(null);
  }, [exercise, prefillName, open]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const res = await uploadFile(file);
      setVideoLinks([res.url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Media upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please provide an exercise name.');
      return;
    }
    if (!userId) {
      setError('Sign in to save custom exercises.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const instructions = cues
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const exerciseData: SaveCustomExerciseData = {
      originalName: cleanName,
      name: cleanName,
      muscleGroup: muscleGroup.trim() || 'General',
      equipment: equipment.trim() || 'None',
      difficulty: exercise?.difficulty && exercise.difficulty !== 'Novice' && exercise.difficulty !== 'Expert'
        ? exercise.difficulty
        : 'Intermediate',
      instructions,
      notes: notes.trim(),
      videoLinks,
    };

    try {
      if (exercise?.id) {
        // Dispatch to update Redux store and Firestore via thunk
        await dispatch(
          updateCustomExercise({
            userId,
            exerciseId: exercise.id,
            updates: exerciseData,
          }),
        ).unwrap();

        onSaved?.({
          ...exercise,
          ...exerciseData,
          updatedAt: new Date(),
        });
      } else {
        // Dispatch to save in Firestore and Redux store via thunk
        const saved = await dispatch(
          saveCustomExercise({
            userId,
            exerciseData,
          }),
        ).unwrap();

        onSaved?.(saved);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise.');
    } finally {
      setIsSaving(false);
    }
  };

  const isEdit = Boolean(exercise?.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-lg overflow-y-auto">
        <SheetTitle className="text-title font-display">
          {isEdit ? 'Edit custom exercise' : 'Create custom exercise'}
        </SheetTitle>
        <SheetDescription>
          {isEdit
            ? 'Update cues, equipment, and your demo media.'
            : 'Add an exercise with cues, muscles, and your own GIF, video, or photo.'}
        </SheetDescription>

        <form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`} className="text-ink-muted">
              Exercise name *
            </Label>
            <Input
              id={`${id}-name`}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Belt Squat"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-muscles`} className="text-ink-muted">
              Muscles targeted
            </Label>
            <Input
              id={`${id}-muscles`}
              type="text"
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              placeholder="e.g. Quads, Glutes"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-equipment`} className="text-ink-muted">
              Equipment
            </Label>
            <Input
              id={`${id}-equipment`}
              type="text"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="e.g. Machine, Cable, Dumbbells"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-cues`} className="text-ink-muted">
              Setup cues
            </Label>
            <Textarea
              id={`${id}-cues`}
              rows={3}
              value={cues}
              onChange={(e) => setCues(e.target.value)}
              placeholder="One cue per line"
              className="resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-notes`} className="text-ink-muted">
              Personal notes
            </Label>
            <Input
              id={`${id}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Seat setting 4, pin 8"
              autoComplete="off"
            />
          </div>

          {/* Media attachment section */}
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-subtle p-4">
            <span className="text-body-sm font-semibold text-ink">Demo media</span>

            {videoLinks.length > 0 && videoLinks[0] ? (
              <div className="flex flex-col gap-2">
                <LibraryMediaClip url={videoLinks[0]} alt={name || 'Exercise demo'} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-danger hover:text-danger"
                  onClick={() => setVideoLinks([])}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Remove media
                </Button>
              </div>
            ) : isUploading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-body-sm text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin text-ink" aria-hidden="true" />
                <span>Uploading media…</span>
              </div>
            ) : aiUsable ? (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Upload photo"
                  data-testid="custom-exercise-photo-input"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleFileUpload(file);
                  }}
                />
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/gif,video/mp4,video/webm,video/quicktime,video/*"
                  aria-label="Upload GIF or video"
                  data-testid="custom-exercise-media-input"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleFileUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Take photo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <Film className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Add GIF or video
                </Button>
              </div>
            ) : (
              <p className="text-caption text-ink-subtle">
                AI media upload is currently disabled or offline.
              </p>
            )}
          </div>

          {error ? (
            <p role="alert" className="text-caption text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={isSaving || isUploading}>
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create exercise'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
