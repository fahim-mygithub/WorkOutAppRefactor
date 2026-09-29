import { useEffect, useId, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  AiBackendError,
  isBackendAvailable,
  isSignedIn,
  readLiftEntry,
  type ReadLiftResult,
} from '../../ai/aiClient';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { aiDisabled } from '../../store/slices/aiSlice';

/**
 * "Describe it": free text → the lift form, via the readLift action. Never saves.
 * Shares the app-wide AI-off state (`state.ai.disabledReason`) with the other
 * entry points: hidden once it is set, and sets it on not-allowed / limit /
 * unconfigured. A limit hit here keeps the field up just long enough to say so.
 */
export function LiftDescribeField({ onResult }: { onResult: (r: ReadLiftResult) => void }) {
  const id = useId();
  const dispatch = useAppDispatch();
  const aiOff = useAppSelector((s) => Boolean(s.ai?.disabledReason));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Set when this field's own call hit the daily limit: show the note, then
  // hide on the next mount like every other entry point.
  const [limitHit, setLimitHit] = useState(false);
  // A reply that lands after unmount (sheet closed) must not touch anything.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  if (!isBackendAvailable() || !isSignedIn()) return null;
  if (limitHit) {
    return (
      <p role="status" className="text-caption text-ink-muted">
        AI limit reached for today.
      </p>
    );
  }
  if (aiOff) return null;

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await readLiftEntry(text.trim());
      if (!alive.current) return;
      onResult(result);
      setNote(result.question || 'Filled from your description — check and Save.');
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof AiBackendError ? e.code : 'failed';
      if (code === 'limit') setLimitHit(true);
      if (code === 'not-allowed' || code === 'limit' || code === 'unconfigured') dispatch(aiDisabled(code));
      else setNote(code === 'signed-out' ? 'Sign in to use AI.' : "Couldn't read that — fill the form below.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-ink-muted">
        Describe it
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="e.g. front squat 250 for 3x5, barely"
          autoComplete="off"
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="secondary" onClick={() => void submit()} disabled={busy || !text.trim()}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Fill
        </Button>
      </div>
      <p aria-live="polite" className="text-caption text-ink-muted empty:hidden">
        {note}
      </p>
    </div>
  );
}
