import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Dumbbell, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { aiDisabled } from '../../store/slices/aiSlice';
import { saveCustomExercise } from '../../store/slices/customExerciseSlice';
import { AiBackendError, findExerciseOnline, type FindExerciseResult } from '../../ai/aiClient';
import { customToExercise, useExerciseLibrary } from '../workout/useExerciseLibrary';
import type { Exercise } from '../../types/exercise';

/**
 * In-flight lookups by term. A lookup can take up to a minute and costs a
 * model call, so a quick remount (React StrictMode's double effect, or Cancel
 * then looking the same term up again) joins the running request instead of
 * starting another. Dropped once it settles, so a retry asks again.
 */
const inflight = new Map<string, Promise<FindExerciseResult>>();

/** Test hook: forget in-flight lookups. */
export function resetLookupCache(): void {
  inflight.clear();
}

function lookup(term: string): Promise<FindExerciseResult> {
  const key = term.toLowerCase();
  let p = inflight.get(key);
  if (!p) {
    p = findExerciseOnline(term);
    inflight.set(key, p);
    const drop = () => {
      if (inflight.get(key) === p) inflight.delete(key);
    };
    p.then(drop, drop);
  }
  return p;
}

function errorLine(code: string): string {
  if (code === 'limit') return 'AI limit reached for today.';
  if (code === 'signed-out') return 'Sign in to use AI.';
  if (code === 'offline') return "You're offline — try again when you're back.";
  return "Couldn't look that up — try again later.";
}

const isGif = (url: string): boolean => {
  try {
    return /\.gif$/i.test(new URL(url).pathname);
  } catch {
    return /\.gif(\?|#|$)/i.test(url);
  }
};

/** One demo clip over a glyph placeholder; fades in once decoded, so a slow
 *  or broken clip reads as the placeholder rather than a black box. */
function DemoMedia({ url }: { url: string }) {
  const reduced = useReducedMotion() ?? false;
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const fade = cn(
    'relative h-full w-full object-contain transition-opacity duration-smooth',
    loaded ? 'opacity-100' : 'opacity-0',
  );
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-surface-raised">
      <div className="absolute inset-0 flex items-center justify-center">
        <Dumbbell className="h-8 w-8 text-ink-subtle" aria-hidden="true" />
      </div>
      {!errored &&
        (isGif(url) ? (
          <img
            src={url}
            alt=""
            className={fade}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        ) : (
          <video
            src={url}
            className={fade}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            preload="auto"
            disablePictureInPicture
            onLoadedData={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        ))}
    </div>
  );
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; line: string }
  | { kind: 'result'; result: FindExerciseResult };

interface ExerciseLookupCardProps {
  /** What the user typed; saved as the custom exercise's `originalName`. */
  term: string;
  /** Called with the picked library exercise or the newly saved one. */
  onAdd: (exercise: Exercise) => void;
  onClose: () => void;
}

/**
 * Looks up an exercise missing from the library (the Worker's findExercise
 * action) and previews it: an alias points back to the library entry; a new
 * one shows its verified demo, muscles and steps, and Apply saves it as a
 * custom exercise. Nothing is saved without Apply.
 */
export function ExerciseLookupCard({ term, onAdd, onClose }: ExerciseLookupCardProps) {
  const dispatch = useAppDispatch();
  const library = useExerciseLibrary();
  const userId = useAppSelector((s) => s.user?.profile?.uid);
  const urlId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [asNew, setAsNew] = useState(false);
  const [clip, setClip] = useState(0);
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A reply that lands after unmount (sheet closed) must not touch anything.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setPhase({ kind: 'loading' });
    setAsNew(false);
    setClip(0);
    lookup(term).then(
      (result) => {
        if (current && alive.current) setPhase({ kind: 'result', result });
      },
      (e: unknown) => {
        if (!current || !alive.current) return;
        const code = e instanceof AiBackendError ? e.code : 'failed';
        if (code === 'not-allowed' || code === 'limit' || code === 'unconfigured') {
          dispatch(aiDisabled(code));
        }
        setPhase({ kind: 'error', line: errorLine(code) });
      },
    );
    return () => {
      current = false;
    };
  }, [term, dispatch]);

  if (phase.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-ink-muted motion-reduce:animate-none" aria-hidden="true" />
        <p className="text-body font-semibold text-ink">Looking it up…</p>
        <p className="text-body-sm text-ink-muted">This can take up to a minute.</p>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3 py-2">
        <p role="alert" className="text-body-sm text-ink-muted">
          {phase.line}
        </p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const { result } = phase;
  const findInLibrary = (name?: string) =>
    name ? library.find((e) => e.name.toLowerCase() === name.trim().toLowerCase()) : undefined;
  const libraryMatch = findInLibrary(result.aliasOf) ?? findInLibrary(result.name);

  const add = (exercise: Exercise) => {
    onAdd(exercise);
    onClose();
  };

  if (libraryMatch && !asNew) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink">
          This is <strong className="font-semibold">{libraryMatch.name}</strong> in the library.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => add(libraryMatch)}>
            Use it
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAsNew(true)}>
            Save as new anyway
          </Button>
        </div>
      </div>
    );
  }

  const media = result.media;
  const chosen = media.length > 0 ? media[clip % media.length] : customUrl.trim();

  const apply = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await dispatch(
        saveCustomExercise({
          userId,
          exerciseData: {
            originalName: term,
            name: result.name,
            muscleGroup: result.muscleGroups.join(', '),
            equipment: result.equipment,
            difficulty: result.difficulty,
            instructions: result.instructions,
            videoLinks: chosen ? [chosen] : [],
          },
        }),
      ).unwrap();
      if (!alive.current) return;
      add(customToExercise(saved));
    } catch {
      if (alive.current) setSaveError("Couldn't save — try again.");
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-title text-ink">{result.name}</h3>
        <p className="text-body-sm text-ink-muted">
          {[result.muscleGroups.join(', '), result.equipment, result.difficulty].join(' · ')}
        </p>
      </div>

      {media.length > 0 ? (
        <div className="flex flex-col gap-2">
          <DemoMedia key={chosen} url={chosen} />
          {media.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setClip((c) => (c + 1) % media.length)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try another clip
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-body-sm text-ink-muted">No working demo found</p>
          <Label htmlFor={urlId} className="text-ink-muted">
            Demo URL (optional)
          </Label>
          <Input
            id={urlId}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
        </div>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-body-sm text-ink">
        {result.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void apply()} disabled={!userId || saving}>
            {saving ? 'Saving…' : 'Apply'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Reject
          </Button>
        </div>
        {!userId && <p className="text-caption text-ink-muted">Sign in to save</p>}
        {saveError && (
          <p role="alert" className="text-caption text-ink-muted">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
}
