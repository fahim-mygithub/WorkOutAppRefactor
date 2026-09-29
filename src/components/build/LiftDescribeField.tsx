import { useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { AiBackendError, isBackendAvailable, readLiftEntry, type ReadLiftResult } from '../../ai/aiClient';

/** "Describe it": free text → the lift form, via the readLift action. Never saves. */
export function LiftDescribeField({ onResult }: { onResult: (r: ReadLiftResult) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Hidden for the rest of the session once the backend says this user can't use it.
  const [hidden, setHidden] = useState(false);
  if (hidden || !isBackendAvailable()) return null;

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await readLiftEntry(text.trim());
      onResult(result);
      setNote(result.question || 'Filled from your description — check and Save.');
    } catch (e) {
      const code = e instanceof AiBackendError ? e.code : 'failed';
      if (code === 'not-allowed' || code === 'unconfigured' || code === 'signed-out') setHidden(true);
      else setNote(code === 'limit' ? 'AI limit reached for today.' : "Couldn't read that — fill the form below.");
    } finally {
      setBusy(false);
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="e.g. front squat 250 for 3x5, barely"
          autoComplete="off"
          className="flex-1"
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
