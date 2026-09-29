import { useEffect, useId, useState, type ReactNode } from 'react';
import type {
  TrackedLift,
  TrackedLoad,
  TrackedTarget,
  WeightUnit,
} from '../../types/trackedLifts';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { ExerciseQuickAdd } from '../workout/ExerciseQuickAdd';
import type { ReadLiftResult } from '../../ai/aiClient';
import { LiftDescribeField } from './LiftDescribeField';

/**
 * TrackedLiftEditor — the bottom sheet for adding or editing one tracked lift.
 *
 * Load and target are picked by KIND first (segmented control), then only that
 * kind's fields show — so a medicine-ball ladder or a time-under-tension hold is
 * as first-class as a barbell weight. Form state is kept as strings and parsed
 * on save; Save stays disabled until the entry is valid.
 */

type LoadKind = TrackedLoad['kind'];
type TargetKind = TrackedTarget['kind'];

interface FormState {
  name: string;
  category: string;
  newCategory: string;
  loadKind: LoadKind;
  weight: string;
  unit: WeightUnit;
  level: string;
  targetKind: TargetKind;
  repsMin: string;
  repsMax: string;
  repMax: string;
  seconds: string;
  tempo: string;
  sets: string;
  /** Weight step (smallest load change); blank = the default. */
  step: string;
  /** Not a visible field: carried from the lift or a description, saved as-is. */
  equipment: TrackedLift['equipment'];
}

/** Largest weight step the form accepts. */
const MAX_STEP = 50;

const NEW_CATEGORY = '__new__';

function toForm(lift: TrackedLift | null, fallbackCategory: string, unit: WeightUnit): FormState {
  const f: FormState = {
    name: lift?.name ?? '',
    category: lift?.category ?? fallbackCategory,
    newCategory: '',
    loadKind: lift?.load.kind ?? 'weight',
    weight: '',
    unit,
    level: '',
    targetKind: lift?.target.kind ?? 'reps',
    repsMin: '',
    repsMax: '',
    repMax: '1',
    seconds: '',
    tempo: '',
    sets: lift?.sets !== undefined ? String(lift.sets) : '',
    step: lift?.step !== undefined ? String(lift.step) : '',
    equipment: lift?.equipment,
  };
  if (lift) {
    const { load, target } = lift;
    if (load.kind === 'weight') {
      f.weight = String(load.value);
      f.unit = load.unit;
    } else if (load.kind === 'bodyweight' && load.plus) {
      f.weight = String(load.plus.value);
      f.unit = load.plus.unit;
    } else if (load.kind === 'level') {
      f.level = load.label;
    }
    if (target.kind === 'reps') {
      f.repsMin = String(target.min);
      f.repsMax = target.max !== undefined ? String(target.max) : '';
    } else if (target.kind === 'repMax') {
      f.repMax = String(target.reps);
    } else if (target.kind === 'time') {
      f.seconds = String(target.seconds);
      f.tempo = target.tempo ?? '';
    }
  }
  return f;
}

const positive = (s: string): number | null => {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const positiveInt = (s: string): number | null => {
  const n = positive(s);
  return n !== null && Number.isInteger(n) ? n : null;
};

/** Parse the form into a lift (minus id), or null when something is invalid. */
export type EditableLift = Pick<TrackedLift, 'name' | 'category' | 'load' | 'target' | 'sets' | 'step' | 'equipment'>;

function fromForm(f: FormState): EditableLift | null {
  const name = f.name.trim();
  const category = (f.category === NEW_CATEGORY ? f.newCategory : f.category).trim();
  if (!name || !category) return null;

  let load: TrackedLoad;
  if (f.loadKind === 'weight') {
    const value = positive(f.weight);
    if (value === null) return null;
    load = { kind: 'weight', value, unit: f.unit };
  } else if (f.loadKind === 'bodyweight') {
    if (f.weight.trim() === '') load = { kind: 'bodyweight' };
    else {
      const value = positive(f.weight);
      if (value === null) return null;
      load = { kind: 'bodyweight', plus: { value, unit: f.unit } };
    }
  } else {
    if (!f.level.trim()) return null;
    load = { kind: 'level', label: f.level.trim() };
  }

  let target: TrackedTarget;
  if (f.targetKind === 'reps') {
    const min = positiveInt(f.repsMin);
    if (min === null) return null;
    if (f.repsMax.trim() === '') target = { kind: 'reps', min };
    else {
      const max = positiveInt(f.repsMax);
      if (max === null || max < min) return null;
      target = max === min ? { kind: 'reps', min } : { kind: 'reps', min, max };
    }
  } else if (f.targetKind === 'repMax') {
    const reps = positiveInt(f.repMax);
    if (reps === null) return null;
    target = { kind: 'repMax', reps };
  } else if (f.targetKind === 'time') {
    const seconds = positive(f.seconds);
    if (seconds === null) return null;
    const tempo = f.tempo.trim();
    target = tempo ? { kind: 'time', seconds, tempo } : { kind: 'time', seconds };
  } else {
    target = { kind: 'none' };
  }

  // Blank = the default (3); kept as an explicit key so clearing it saves.
  let sets: number | undefined;
  if (f.sets.trim() !== '') {
    const n = positiveInt(f.sets);
    if (n === null || n > 20) return null;
    sets = n;
  }

  // Only a weight load has a step field; blank = the default (5 lb / 2.5 kg).
  let step: number | undefined;
  if (f.loadKind === 'weight' && f.step.trim() !== '') {
    const n = positive(f.step);
    if (n === null || n > MAX_STEP) return null;
    step = n;
  }

  return { name, category, load, target, sets, step, equipment: f.equipment };
}

const LOAD_KINDS: readonly LoadKind[] = ['weight', 'bodyweight', 'level'];
const TARGET_KINDS: readonly TargetKind[] = ['reps', 'repMax', 'time', 'none'];
/** A positive finite number as a form string, else null (model output may hold nulls). */
const num = (v: number | null | undefined): string | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? String(v) : null;
const text = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Merge a "Describe it" result into the form: what it read wins, the rest is kept. */
function applyReadLift(f: FormState, r: ReadLiftResult): FormState {
  const targetKind = TARGET_KINDS.includes(r.targetKind) ? r.targetKind : f.targetKind;
  const reps = num(r.reps);
  return {
    ...f,
    name: text(r.name) ?? f.name,
    loadKind: LOAD_KINDS.includes(r.loadKind) ? r.loadKind : f.loadKind,
    weight: num(r.weight) ?? f.weight,
    unit: r.unit === 'lb' || r.unit === 'kg' ? r.unit : f.unit,
    level: text(r.level) ?? f.level,
    targetKind,
    repsMin: targetKind === 'reps' && reps ? reps : f.repsMin,
    repsMax: num(r.repsMax) ?? f.repsMax,
    repMax: targetKind === 'repMax' && reps ? reps : f.repMax,
    seconds: num(r.seconds) ?? f.seconds,
    tempo: text(r.tempo) ?? f.tempo,
    sets: num(r.sets) ?? f.sets,
    step: num(r.step) ?? f.step,
    equipment: r.equipment ?? f.equipment,
  };
}

// --- small local controls ----------------------------------------------------

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

/** Single-choice pill group (radiogroup semantics). */
function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-touch-min rounded-full px-4 text-body-sm font-semibold transition-colors duration-snap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
              checked ? 'bg-ink text-ink-inverse' : 'bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-ink-muted">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-body-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

// --- the sheet ---------------------------------------------------------------

export interface TrackedLiftEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The lift being edited, or null to add a new one. */
  lift: TrackedLift | null;
  categories: string[];
  /** Category preselected when adding (e.g. the list the user tapped "Add" in). */
  defaultCategory?: string;
  defaultUnit: WeightUnit;
  onSave: (lift: EditableLift) => void;
  onDelete?: () => void;
}

export function TrackedLiftEditor({
  open,
  onOpenChange,
  lift,
  categories,
  defaultCategory,
  defaultUnit,
  onSave,
  onDelete,
}: TrackedLiftEditorProps) {
  const id = useId();
  const fallbackCategory = defaultCategory ?? categories[0] ?? NEW_CATEGORY;
  const [form, setForm] = useState<FormState>(() => toForm(lift, fallbackCategory, defaultUnit));

  // Reset the form each time the sheet opens for a (possibly different) lift.
  useEffect(() => {
    if (open) setForm(toForm(lift, fallbackCategory, defaultUnit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lift]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const parsed = fromForm(form);
  const isEdit = lift !== null;

  const categoryOptions = [
    ...categories.map((c) => ({ value: c, label: c })),
    { value: NEW_CATEGORY, label: 'New category' },
  ];

  const unitToggle = (
    <Segmented<WeightUnit>
      label="Unit"
      value={form.unit}
      onChange={(v) => set('unit', v)}
      options={[
        { value: 'lb', label: 'lb' },
        { value: 'kg', label: 'kg' },
      ]}
    />
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="mx-auto max-w-lg">
        <SheetTitle className="text-title">{isEdit ? 'Edit lift' : 'Add a lift'}</SheetTitle>
        <SheetDescription>Track it by weight, a progression step, reps or time.</SheetDescription>

        <form
          className="mt-5 flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed) onSave(parsed);
          }}
        >
          <LiftDescribeField onResult={(r) => setForm((f) => applyReadLift(f, r))} />

          {/* Searches the exercise library like the Build tab; any typed name still works. */}
          <ExerciseQuickAdd
            id={`${id}-name`}
            label="Lift"
            value={form.name}
            onValueChange={(v) => set('name', v)}
            onAdd={(exercise) => set('name', exercise.name)}
            placeholder="Search exercises, e.g. Bench Press"
          />

          <Group title="Category">
            <Segmented label="Category" value={form.category} onChange={(v) => set('category', v)} options={categoryOptions} />
            {form.category === NEW_CATEGORY && (
              <Field label="New category name" htmlFor={`${id}-newcat`}>
                <Input
                  id={`${id}-newcat`}
                  value={form.newCategory}
                  onChange={(e) => set('newCategory', e.target.value)}
                  placeholder="e.g. Core"
                  autoComplete="off"
                />
              </Field>
            )}
          </Group>

          <Group title="Load">
            <Segmented<LoadKind>
              label="Load type"
              value={form.loadKind}
              onChange={(v) => set('loadKind', v)}
              options={[
                { value: 'weight', label: 'Weight' },
                { value: 'bodyweight', label: 'Bodyweight' },
                { value: 'level', label: 'Level' },
              ]}
            />
            {form.loadKind === 'weight' && (
              <div className="flex items-end gap-3">
                <Field label="Weight" htmlFor={`${id}-weight`}>
                  <Input id={`${id}-weight`} inputMode="decimal" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0" />
                </Field>
                {unitToggle}
              </div>
            )}
            {form.loadKind === 'weight' && (
              <Field label="Weight step" htmlFor={`${id}-step`}>
                <Input
                  id={`${id}-step`}
                  inputMode="decimal"
                  value={form.step}
                  onChange={(e) => set('step', e.target.value)}
                  placeholder={form.unit === 'kg' ? '2.5' : '5'}
                />
              </Field>
            )}
            {form.loadKind === 'bodyweight' && (
              <div className="flex items-end gap-3">
                <Field label="Added weight (optional)" htmlFor={`${id}-plus`}>
                  <Input id={`${id}-plus`} inputMode="decimal" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="None" />
                </Field>
                {unitToggle}
              </div>
            )}
            {form.loadKind === 'level' && (
              <Field label="Progression step" htmlFor={`${id}-level`}>
                <Input
                  id={`${id}-level`}
                  value={form.level}
                  onChange={(e) => set('level', e.target.value)}
                  placeholder="e.g. Med ball 6 kg, Band: red"
                  autoComplete="off"
                />
              </Field>
            )}
          </Group>

          <Group title="Target">
            <Segmented<TargetKind>
              label="Target type"
              value={form.targetKind}
              onChange={(v) => set('targetKind', v)}
              options={[
                { value: 'reps', label: 'Reps' },
                { value: 'repMax', label: 'Rep max' },
                { value: 'time', label: 'Time' },
                { value: 'none', label: 'None' },
              ]}
            />
            {form.targetKind === 'reps' && (
              <div className="flex gap-3">
                <Field label="Reps" htmlFor={`${id}-min`}>
                  <Input id={`${id}-min`} inputMode="numeric" value={form.repsMin} onChange={(e) => set('repsMin', e.target.value)} placeholder="8" />
                </Field>
                <Field label="Up to (optional)" htmlFor={`${id}-max`}>
                  <Input id={`${id}-max`} inputMode="numeric" value={form.repsMax} onChange={(e) => set('repsMax', e.target.value)} placeholder="12" />
                </Field>
              </div>
            )}
            {form.targetKind === 'repMax' && (
              <Field label="Rep max (1 = one-rep max)" htmlFor={`${id}-rm`}>
                <Input id={`${id}-rm`} inputMode="numeric" value={form.repMax} onChange={(e) => set('repMax', e.target.value)} placeholder="1" />
              </Field>
            )}
            {form.targetKind === 'time' && (
              <div className="flex gap-3">
                <Field label="Seconds under tension" htmlFor={`${id}-sec`}>
                  <Input id={`${id}-sec`} inputMode="numeric" value={form.seconds} onChange={(e) => set('seconds', e.target.value)} placeholder="40" />
                </Field>
                <Field label="Tempo (optional)" htmlFor={`${id}-tempo`}>
                  <Input id={`${id}-tempo`} value={form.tempo} onChange={(e) => set('tempo', e.target.value)} placeholder="3-1-3" autoComplete="off" />
                </Field>
              </div>
            )}
          </Group>

          <Field label="Sets (accessories repeat this; default 3)" htmlFor={`${id}-sets`}>
            <Input
              id={`${id}-sets`}
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => set('sets', e.target.value)}
              placeholder="3"
            />
          </Field>

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="xl" disabled={!parsed}>
              {isEdit ? 'Save lift' : 'Add lift'}
            </Button>
            {isEdit && onDelete && (
              <Button type="button" variant="ghost" className="text-danger hover:text-danger" onClick={onDelete}>
                Delete lift
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
