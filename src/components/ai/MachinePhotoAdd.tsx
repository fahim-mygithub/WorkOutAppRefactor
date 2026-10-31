// MachinePhotoAdd: Build's "Add from a photo". The lifter photographs a gym
// machine; the Worker's readMachine action reads it into an exercise draft,
// shown in an editable card. Nothing is saved until Add: then a name the
// library already has is used as is, anything else is saved as a custom
// exercise, and the exercise goes onto the board with the draft's sets.
// After Add, offer "Save this photo to the exercise" to upload and attach it.
//
// Hidden entirely when AI can't be used (no Worker URL, offline, signed out,
// or the Worker said not-allowed / limit / unconfigured).
import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { aiDisabled } from '../../store/slices/aiSlice';
import { saveCustomExercise, updateCustomExercise } from '../../store/slices/customExerciseSlice';
import {
  AiBackendError,
  isBackendAvailable,
  isSignedIn,
  readMachinePhoto,
  type ReadMachineResult,
} from '../../ai/aiClient';
import { compressImage, ImageTooLargeError } from '../../ai/image';
import { uploadMedia, type MediaUploadResult } from '../../ai/mediaUpload';
import type { AiImage } from '../../ai/types';
import { customToExercise, useExerciseLibrary } from '../workout/useExerciseLibrary';
import type { Exercise } from '../../types/exercise';

export interface MachineDefaults {
  sets: number;
  reps: number;
}

interface Draft {
  name: string;
  muscles: string;
  equipment: string;
  cues: string;
  sets: string;
  reps: string;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; photo?: AiImage }
  | { kind: 'error'; line: string }
  | { kind: 'draft'; photo: AiImage }
  | {
      kind: 'photoOffer';
      photo: AiImage;
      rawFile?: File;
      customId?: string;
      exerciseName: string;
      muscles?: string;
      equipment?: string;
      cues?: string;
    };

function errorLine(err: unknown): string {
  if (err instanceof ImageTooLargeError) return 'That photo is too large — try another.';
  const code = err instanceof AiBackendError ? err.code : 'failed';
  if (code === 'limit') return 'AI limit reached for today.';
  if (code === 'signed-out') return 'Sign in to use AI.';
  if (code === 'offline') return "You're offline — try again when you're back.";
  return "Couldn't read that photo — try another.";
}

const toDraft = (r: ReadMachineResult): Draft => ({
  name: r.name,
  muscles: r.muscleGroups.join(', '),
  equipment: r.equipment,
  cues: r.setupCues.join('\n'),
  sets: String(r.defaultSets.sets),
  reps: String(r.defaultSets.reps),
});

const splitList = (v: string, sep: RegExp): string[] =>
  v
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

/** A whole number in [min, max], else null. */
function whole(v: string, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function aiImageToBlob(image: AiImage): Blob {
  const binaryString = atob(image.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: image.mediaType });
}

export interface MachinePhotoAddProps {
  /** The picked or newly saved exercise, with the sets to start it at. */
  onAdd: (exercise: Exercise, defaults: MachineDefaults) => void;
  /** Shrinks a picked photo for the Worker. Defaults to `compressImage`. */
  prepareImage?: (file: File) => Promise<AiImage>;
  /** Uploads a media file. Defaults to `uploadMedia`. */
  uploadFile?: (file: File | Blob) => Promise<MediaUploadResult>;
  className?: string;
}

export function MachinePhotoAdd({
  onAdd,
  prepareImage = compressImage,
  uploadFile = uploadMedia,
  className,
}: MachinePhotoAddProps) {
  const dispatch = useAppDispatch();
  const library = useExerciseLibrary();
  const userId = useAppSelector((s) => s.user?.profile?.uid);
  const aiOff = useAppSelector((s) => Boolean(s.ai?.disabledReason));
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoSaveSuccess, setPhotoSaveSuccess] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Each photo gets a number; a reply for an older (or cancelled) one is dropped.
  const request = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  if (aiOff || !isBackendAvailable() || !isSignedIn()) return null;

  const close = () => {
    request.current += 1;
    setPhase({ kind: 'idle' });
    setDraft(null);
    setProblem(null);
    setSaving(false);
    setSavingPhoto(false);
    setPhotoSaveSuccess(false);
    setRawFile(null);
  };

  const read = async (file: File) => {
    const mine = ++request.current;
    const current = () => alive.current && request.current === mine;
    setPhase({ kind: 'reading' });
    setRawFile(file);
    setDraft(null);
    setProblem(null);
    setPhotoSaveSuccess(false);
    try {
      const photo = await prepareImage(file);
      if (!current()) return;
      setPhase({ kind: 'reading', photo });
      const result = await readMachinePhoto(photo);
      if (!current()) return;
      setDraft(toDraft(result));
      setPhase({ kind: 'draft', photo });
    } catch (err) {
      if (!current()) return;
      const code = err instanceof AiBackendError ? err.code : null;
      if (code === 'not-allowed' || code === 'limit' || code === 'unconfigured') dispatch(aiDisabled(code));
      setPhase({ kind: 'error', line: errorLine(err) });
    }
  };

  const add = async () => {
    if (!draft || saving) return;
    const name = draft.name.trim();
    const sets = whole(draft.sets, 1, 10);
    const reps = whole(draft.reps, 1, 50);
    if (!name) return setProblem('Give it a name.');
    if (sets === null || reps === null) return setProblem('Sets 1–10, reps 1–50.');
    const defaults = { sets, reps };
    const known = library.find((e) => e.name.trim().toLowerCase() === name.toLowerCase());

    if (known) {
      onAdd(known, defaults);
      if (phase.kind === 'draft') {
        setPhase({
          kind: 'photoOffer',
          photo: phase.photo,
          rawFile: rawFile ?? undefined,
          exerciseName: known.name,
          muscles: known.muscleGroup,
          equipment: known.equipment,
          cues: known.instructions?.join('\n') || '',
        });
      } else {
        close();
      }
      return;
    }

    if (!userId) return setProblem('Sign in to save.');
    setSaving(true);
    setProblem(null);
    try {
      const muscles = splitList(draft.muscles, /,/);
      const saved = await dispatch(
        saveCustomExercise({
          userId,
          exerciseData: {
            originalName: name,
            name,
            muscleGroup: muscles.join(', ') || 'Unknown',
            equipment: draft.equipment.trim() || 'Machine',
            difficulty: 'Intermediate',
            instructions: splitList(draft.cues, /\n/),
            notes: `Default: ${sets}×${reps}`,
          },
        }),
      ).unwrap();
      if (!alive.current) return;
      onAdd(customToExercise(saved), defaults);
      if (phase.kind === 'draft') {
        setPhase({
          kind: 'photoOffer',
          photo: phase.photo,
          rawFile: rawFile ?? undefined,
          customId: saved.id,
          exerciseName: saved.name,
          muscles: saved.muscleGroup,
          equipment: saved.equipment,
          cues: saved.instructions?.join('\n') || '',
        });
      } else {
        close();
      }
    } catch {
      if (alive.current) {
        setProblem("Couldn't save — try again.");
        setSaving(false);
      }
    }
  };

  const savePhotoToExercise = async () => {
    if (phase.kind !== 'photoOffer' || savingPhoto) return;
    setSavingPhoto(true);
    setProblem(null);
    try {
      const blob = rawFile ?? aiImageToBlob(phase.photo);
      const uploaded = await uploadFile(blob);
      if (!alive.current) return;

      if (phase.customId && userId) {
        await dispatch(
          updateCustomExercise({
            userId,
            exerciseId: phase.customId,
            updates: { videoLinks: [uploaded.url] },
          }),
        ).unwrap();
      } else if (userId) {
        await dispatch(
          saveCustomExercise({
            userId,
            exerciseData: {
              originalName: phase.exerciseName,
              name: phase.exerciseName,
              muscleGroup: phase.muscles || 'Unknown',
              equipment: phase.equipment || 'Machine',
              difficulty: 'Intermediate',
              instructions: splitList(phase.cues || '', /\n/),
              videoLinks: [uploaded.url],
            },
          }),
        ).unwrap();
      }
      setPhotoSaveSuccess(true);
    } catch {
      if (alive.current) {
        setProblem("Couldn't save photo — try again.");
      }
    } finally {
      if (alive.current) {
        setSavingPhoto(false);
      }
    }
  };

  const field = (key: keyof Draft) => ({
    id: `${id}-${key}`,
    value: draft?.[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => (d ? { ...d, [key]: e.target.value } : d)),
  });

  const photo =
    phase.kind === 'draft' || phase.kind === 'reading' || phase.kind === 'photoOffer'
      ? phase.photo
      : undefined;

  return (
    <div className={className}>
      {/* capture="environment" opens the rear camera on phones (including the
          iOS home-screen app); desktops get a file picker. */}
      <input
        ref={inputRef}
        data-testid="machine-photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void read(file);
        }}
      />
      <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
        <Camera className="h-4 w-4" aria-hidden="true" />
        Add from a photo
      </Button>

      <Sheet open={phase.kind !== 'idle'} onOpenChange={(open) => !open && close()}>
        <SheetContent>
          <SheetTitle className="text-title">
            {phase.kind === 'photoOffer' ? 'Photo added' : 'Add from a photo'}
          </SheetTitle>
          <SheetDescription>
            {phase.kind === 'photoOffer'
              ? 'Save this photo to the exercise in your library.'
              : 'AI reads the machine. Check it, then Add — nothing is saved before.'}
          </SheetDescription>

          <div className="mt-4 flex flex-col gap-4">
            {photo ? (
              <img
                src={`data:${photo.mediaType};base64,${photo.data}`}
                alt="Your photo"
                className="max-h-40 w-full rounded-2xl bg-surface-raised object-contain"
              />
            ) : null}

            {phase.kind === 'reading' ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
                <Loader2 className="h-6 w-6 animate-spin text-ink-muted motion-reduce:animate-none" aria-hidden="true" />
                <p className="text-body font-semibold text-ink">Reading the machine…</p>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
              </div>
            ) : null}

            {phase.kind === 'error' ? (
              <div className="flex flex-col gap-3">
                <p role="alert" className="text-body-sm text-ink-muted">
                  {phase.line}
                </p>
                <Button type="button" variant="secondary" onClick={close}>
                  Close
                </Button>
              </div>
            ) : null}

            {phase.kind === 'draft' && draft ? (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void add();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-name`} className="text-ink-muted">
                    Name
                  </Label>
                  <Input type="text" autoComplete="off" {...field('name')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-muscles`} className="text-ink-muted">
                    Muscles
                  </Label>
                  <Input type="text" autoComplete="off" placeholder="Hamstrings, Glutes" {...field('muscles')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-equipment`} className="text-ink-muted">
                    Equipment
                  </Label>
                  <Input type="text" autoComplete="off" {...field('equipment')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-cues`} className="text-ink-muted">
                    Setup cues
                  </Label>
                  <Textarea rows={3} className="resize-none" {...field('cues')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-sets`} className="text-ink-muted">
                      Sets
                    </Label>
                    <Input type="number" inputMode="numeric" min={1} max={10} className="font-tabular" {...field('sets')} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-reps`} className="text-ink-muted">
                      Reps
                    </Label>
                    <Input type="number" inputMode="numeric" min={1} max={50} className="font-tabular" {...field('reps')} />
                  </div>
                </div>
                {problem ? (
                  <p role="alert" className="text-caption text-danger">
                    {problem}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Adding…' : 'Add'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {phase.kind === 'photoOffer' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-body font-semibold text-ink">Exercise added to workout</p>
                  <p className="text-body-sm text-ink-muted">
                    Save this photo to {phase.exerciseName} in your exercise library?
                  </p>
                </div>
                {photoSaveSuccess ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-surface-raised px-4 py-3 text-body-sm text-ink">
                    <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                    Photo saved to exercise
                  </div>
                ) : null}
                {problem ? (
                  <p role="alert" className="text-caption text-danger">
                    {problem}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {!photoSaveSuccess && (
                    <Button
                      type="button"
                      disabled={savingPhoto}
                      onClick={() => void savePhotoToExercise()}
                    >
                      {savingPhoto ? 'Saving photo…' : 'Save this photo to the exercise'}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={close}>
                    {photoSaveSuccess ? 'Done' : 'Not now'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
MachinePhotoAdd.displayName = 'MachinePhotoAdd';
