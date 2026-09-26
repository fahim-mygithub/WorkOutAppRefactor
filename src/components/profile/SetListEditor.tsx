import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { Input } from '../ui/input';

export interface EditableSetRow {
  id: string;
  reps: number;
  weight: number;
  unit: 'lbs' | 'kg';
}

interface SetListEditorProps {
  sets: EditableSetRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: <K extends keyof EditableSetRow>(id: string, field: K, value: EditableSetRow[K]) => void;
}

/**
 * SetListEditor — the sets block shared by the manual logger and the history
 * entry editor (Tempo). One compact row per set: index, reps, weight, and a
 * unit pill that flips lbs/kg for that set. Column labels sit once above the
 * rows so each row stays narrow enough for a 390px sheet.
 */
export function SetListEditor({ sets, onAdd, onRemove, onUpdate }: SetListEditorProps) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between">
        <span id={headingId} className="text-body-sm font-semibold text-ink">
          Sets
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add set
        </Button>
      </div>

      <div className="flex items-center gap-2 px-1 text-caption text-ink-muted" aria-hidden="true">
        <span className="w-6">Set</span>
        <span className="flex-1">Reps</span>
        <span className="flex-1">Weight</span>
        <span className="w-14" />
        <span className="w-11" />
      </div>

      <ol className="flex flex-col gap-2">
        {sets.map((set, index) => {
          const n = index + 1;
          return (
            <li key={set.id} className="flex items-center gap-2">
              <span className="w-6 text-center font-num font-tabular text-body-sm font-semibold text-ink-muted">
                {n}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                aria-label={`Set ${n} reps`}
                placeholder="Reps"
                value={set.reps || ''}
                onChange={(e) => onUpdate(set.id, 'reps', parseInt(e.target.value) || 0)}
                min="1"
                max="999"
                className="min-w-0 flex-1"
                required
              />
              <Input
                type="number"
                inputMode="decimal"
                aria-label={`Set ${n} weight`}
                placeholder="0"
                value={set.weight || ''}
                onChange={(e) => onUpdate(set.id, 'weight', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.5"
                className="min-w-0 flex-1"
                required
              />
              <button
                type="button"
                onClick={() => onUpdate(set.id, 'unit', set.unit === 'lbs' ? 'kg' : 'lbs')}
                aria-label={`Set ${n} unit: ${set.unit}. Switch to ${set.unit === 'lbs' ? 'kg' : 'lbs'}`}
                className="min-h-touch-min w-14 shrink-0 rounded-full bg-surface-raised text-body-sm font-semibold text-ink transition-colors duration-snap hover:bg-surface-raised/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle"
              >
                {set.unit}
              </button>
              {sets.length > 1 ? (
                <IconButton
                  type="button"
                  variant="ghost"
                  aria-label={`Remove set ${n}`}
                  onClick={() => onRemove(set.id)}
                  className="shrink-0 hover:text-danger"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              ) : (
                <span className="w-11 shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
