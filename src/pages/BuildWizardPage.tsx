import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, PersonStanding, PencilRuler } from 'lucide-react';
import { useAppDispatch } from '../store/hooks';
import { useExercises } from '../hooks/useExercises';
import { startWorkout } from '../store/slices/workoutSlice';
import {
  recommendOne,
  randomForMuscle,
  toWorkoutExercise,
} from '../lib/recommendExercises';
import { ALL_MUSCLE_TERMS } from '../lib/muscleTerms';
import { sanitizeWorkoutExercisesForRedux } from '../utils/workoutConversion';
import type { Exercise } from '../types/exercise';
import { WizardShell } from '../components/build/WizardShell';
import { ChoiceCard } from '../components/build/ChoiceCard';
import { BodyMusclePicker } from '../components/build/BodyMusclePicker';
import { RecommendedWorkout, type ReviewRow } from '../components/build/RecommendedWorkout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { usePlannedSchedule } from '../hooks/usePlannedSchedule';
import { MUSCLE_GROUP_META } from '../components/home/muscleGroup';
import type { OneRmKey } from '../lib/charlie/definition';
import type { OneRepMax, PullupSeed } from '../types/schedule';

type Screen =
  | 'chooser'
  | 'muscle-select'
  | 'muscle-review'
  | 'template'
  | 'template-detail'
  | 'template-1rm';

let rowSeq = 0;
const newRowId = () => `row-${Date.now().toString(36)}-${rowSeq++}`;

type CharlieFieldKey = OneRmKey | 'pullup-heavy' | 'bodyweight';
interface CharlieLiftField {
  key: CharlieFieldKey;
  label: string;
  group: 'Push' | 'Pull' | 'Legs';
  hint?: string;
  required?: boolean;
}
const LIFT_FIELDS: CharlieLiftField[] = [
  { key: 'bb-bench', label: 'Barbell Bench Press', group: 'Push', required: true },
  { key: 'db-bench', label: 'Dumbbell Bench Press', group: 'Push', hint: 'per dumbbell', required: true },
  { key: 'seal-row', label: 'Seal Row', group: 'Pull', required: true },
  { key: 'pullup-heavy', label: 'Weighted Pull-up — added load', group: 'Pull', hint: '~5 reps (e.g. 35)', required: true },
  { key: 'bodyweight', label: 'Bodyweight', group: 'Pull', hint: 'scales the pull-up' },
  { key: 'back-squat', label: 'Back Squat', group: 'Legs', required: true },
  { key: 'front-squat', label: 'Front Squat', group: 'Legs', hint: 'blank → 0.82× back squat' },
  { key: 'deadlift', label: 'Deadlift', group: 'Legs', required: true },
];

/** "Chest Day" / "Chest & Shoulders" / "Chest, Shoulders & Triceps". */
function defaultWorkoutName(terms: string[]): string {
  if (terms.length === 0) return 'My Workout';
  if (terms.length === 1) return `${terms[0]} Day`;
  if (terms.length === 2) return `${terms[0]} & ${terms[1]}`;
  return `${terms.slice(0, -1).join(', ')} & ${terms[terms.length - 1]}`;
}

/**
 * BuildWizardPage — the new /build entry. A local state-machine wizard (matching
 * this codebase's pattern) that funnels into one of three branches:
 *   • Template  → preset split (placeholder for now)
 *   • By muscle → multi-select body map → recommended workout (this build)
 *   • Custom    → the existing BuildPage at /build/custom
 *
 * Every screen renders inside WizardShell, which guarantees the no-scroll frame.
 * The muscle branch's transient draft (selected muscles, recommended rows, name)
 * lives here in component state so no URL plumbing is needed; only Custom is a
 * route hop, because it's a wholly separate existing page.
 */
export default function BuildWizardPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { exercises, isLoading } = useExercises();

  const [screen, setScreen] = useState<Screen>('chooser');
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [name, setName] = useState('');
  const [maxes, setMaxes] = useState<Record<string, string>>({});

  const { activateCharlieSplit, autofillMonth } = usePlannedSchedule();

  const exercisesReady = exercises.length > 0;

  // -- Charlie Split setup ----------------------------------------------------

  const liftValue = (k: string): number => {
    const n = parseFloat(maxes[k]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const canAutofillCharlie = LIFT_FIELDS.filter((f) => f.required).every((f) => liftValue(f.key) > 0);

  const handleActivateCharlie = () => {
    const now = new Date().toISOString();
    const oneRepMax: Partial<Record<OneRmKey, OneRepMax>> = {};
    const setRm = (key: OneRmKey, value: number) => {
      if (value > 0) {
        oneRepMax[key] = { key, value, unit: 'lbs', source: 'entered', enteredAt: now, updatedAt: now };
      }
    };
    setRm('bb-bench', liftValue('bb-bench'));
    setRm('db-bench', liftValue('db-bench'));
    setRm('seal-row', liftValue('seal-row'));
    setRm('back-squat', liftValue('back-squat'));
    setRm('deadlift', liftValue('deadlift'));
    const frontSquat = liftValue('front-squat') || Math.round((liftValue('back-squat') * 0.82) / 2.5) * 2.5;
    setRm('front-squat', frontSquat);
    const pullup: PullupSeed = {
      heavyAddedLoad: liftValue('pullup-heavy') || 35,
      volumeAddedLoad: 0,
      bodyweight: liftValue('bodyweight') || 0,
      updatedAt: now,
    };
    activateCharlieSplit({ oneRepMax, pullup });
    autofillMonth(new Date());
    navigate('/');
  };

  // -- muscle selection -------------------------------------------------------

  const toggleTerm = (term: string) => {
    setSelectedTerms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term],
    );
  };

  /**
   * Reconcile the draft rows with the current muscle selection: keep existing
   * rows for muscles still selected, drop rows for deselected muscles, and add a
   * default recommendation for newly selected muscles (avoiding duplicate
   * exercises across the workout). Order follows selection order.
   */
  const goToReview = () => {
    // Order muscles by the canonical head-to-toe order so a deselect/re-select
    // round-trip can't reshuffle the review groups (selection order is not stable).
    const ordered = [...selectedTerms].sort(
      (a, b) => ALL_MUSCLE_TERMS.indexOf(a) - ALL_MUSCLE_TERMS.indexOf(b),
    );
    const usedIds = new Set<string>();
    const next: ReviewRow[] = [];
    for (const term of ordered) {
      const kept = rows.filter((r) => r.term === term);
      if (kept.length > 0) {
        kept.forEach((r) => usedIds.add(r.exercise.id));
        next.push(...kept);
        continue;
      }
      const ex = recommendOne(exercises, term, usedIds);
      if (ex) {
        usedIds.add(ex.id);
        next.push({ rowId: newRowId(), term, exercise: ex });
      }
    }
    setRows(next);
    if (!name.trim()) setName(defaultWorkoutName(ordered));
    setScreen('muscle-review');
  };

  // -- review row actions -----------------------------------------------------

  const usedExerciseIds = (exceptRowId?: string) =>
    new Set(rows.filter((r) => r.rowId !== exceptRowId).map((r) => r.exercise.id));

  const handleRandomize = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const exclude = new Set(prev.map((x) => x.exercise.id)); // avoid all current, incl. self
        const next = randomForMuscle(exercises, r.term, exclude, r.exercise.id);
        return next ? { ...r, exercise: next } : r;
      }),
    );
  };

  const handleReplace = (rowId: string, exercise: Exercise) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, exercise } : r)));
  };

  const handleRemove = (rowId: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.rowId === rowId);
      const next = prev.filter((r) => r.rowId !== rowId);
      // If that was the last exercise for its muscle, deselect the muscle too so
      // the selection and the draft stay in lockstep.
      if (target && !next.some((r) => r.term === target.term)) {
        setSelectedTerms((terms) => terms.filter((t) => t !== target.term));
      }
      return next;
    });
  };

  const handleAddForTerm = (term: string) => {
    const ex = recommendOne(exercises, term, usedExerciseIds());
    if (ex) setRows((prev) => [...prev, { rowId: newRowId(), term, exercise: ex }]);
  };

  // -- launch -----------------------------------------------------------------

  const handleStart = () => {
    if (rows.length === 0) return;
    // Route through the same sanitizer every other launch site uses, so the
    // payload is guaranteed plain/serializable and sets get weight/unit defaults.
    const exercises = sanitizeWorkoutExercisesForRedux(
      rows.map((r) => toWorkoutExercise(r.exercise)),
    );
    dispatch(
      startWorkout({
        name: name.trim() || defaultWorkoutName(selectedTerms),
        exercises,
      }),
    );
    navigate('/workout');
  };

  // -- render -----------------------------------------------------------------

  if (screen === 'chooser') {
    return (
      <WizardShell title="Build a workout" subtitle="How do you want to start?">
        {/* Top-anchored in the upper portion of the screen (not stretched to
            fill): natural-height options with generous spacing, staggered in. */}
        <div className="choice-list flex flex-col gap-4 pt-7">
          <ChoiceCard
            className="choice-card-in"
            icon={LayoutTemplate}
            title="Use a Template"
            description="Push/Pull/Legs, Upper/Lower, Full-Body…"
            onClick={() => setScreen('template')}
          />
          <ChoiceCard
            className="choice-card-in"
            icon={PersonStanding}
            title="By Muscle Group"
            description="Pick muscles on the body map, get exercises"
            onClick={() => setScreen('muscle-select')}
          />
          <ChoiceCard
            className="choice-card-in"
            icon={PencilRuler}
            title="Custom Build"
            description="Free-form text & visual editor"
            onClick={() => navigate('/build/custom')}
          />
        </div>
      </WizardShell>
    );
  }

  if (screen === 'template') {
    return (
      <WizardShell title="Templates" subtitle="Programmed splits" onBack={() => setScreen('chooser')}>
        <div className="flex flex-col gap-4 pt-4">
          <ChoiceCard
            icon={LayoutTemplate}
            title="Charlie Split"
            description="Push / Pull / Legs · auto-fills your month"
            onClick={() => setScreen('template-detail')}
          />
          <p className="px-1 text-caption text-ink-subtle">More splits coming soon.</p>
        </div>
      </WizardShell>
    );
  }

  if (screen === 'template-detail') {
    return (
      <WizardShell
        title="Charlie Split"
        subtitle="Push / Pull / Legs, every day"
        onBack={() => setScreen('template')}
        footer={
          <Button variant="primary" size="lg" className="w-full" onClick={() => setScreen('template-1rm')}>
            Set up my lifts
          </Button>
        }
      >
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex gap-3">
            {(['push', 'pull', 'legs'] as const).map((g) => {
              const m = MUSCLE_GROUP_META[g];
              const Icon = m.icon;
              return (
                <div
                  key={g}
                  className="flex flex-1 flex-col items-center gap-1 rounded-md border border-ink/8 bg-surface-raised p-3"
                >
                  <Icon className={m.textClass} size={22} aria-hidden="true" />
                  <span className="text-caption text-ink-muted">{m.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-body-sm text-ink-muted">
            A continuous Push/Pull/Legs rotation that fills your calendar and carries into next month
            from wherever you left off.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-body-sm text-ink-muted">
            <li>Push — alternating volume/heavy bench (DB ↔ BB) + 3 rotating supersets</li>
            <li>Pull — weighted pull-ups &amp; seal rows, back + arms</li>
            <li>Legs — squat / front-squat / deadlift cycle + core &amp; stability</li>
          </ul>
        </div>
      </WizardShell>
    );
  }

  if (screen === 'template-1rm') {
    return (
      <WizardShell
        title="Your starting maxes"
        subtitle="We scale every working set from these. Editable anytime."
        onBack={() => setScreen('template-detail')}
        footer={
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!canAutofillCharlie}
            onClick={handleActivateCharlie}
          >
            {canAutofillCharlie ? 'Autofill this month' : 'Enter your main lifts'}
          </Button>
        }
      >
        <div className="flex h-full flex-col gap-5 overflow-y-auto pt-2 pb-2">
          {(['Push', 'Pull', 'Legs'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <h4 className="font-marker text-body text-ink">{group}</h4>
              {LIFT_FIELDS.filter((f) => f.group === group).map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3">
                  <span className="flex-1 text-body-sm text-ink-muted">
                    {f.label}
                    {f.required && <span className="text-danger"> *</span>}
                    {f.hint && <span className="block text-caption text-ink-subtle">{f.hint}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      size="sm"
                      className={cn('w-24 text-right')}
                      placeholder="0"
                      value={maxes[f.key] ?? ''}
                      onChange={(e) => setMaxes((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                    <span className="text-caption text-ink-subtle">lbs</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </WizardShell>
    );
  }

  if (screen === 'muscle-select') {
    return (
      <WizardShell
        title="Pick muscles"
        subtitle="Tap each muscle you want to train"
        onBack={() => setScreen('chooser')}
        step={1}
        totalSteps={2}
        footer={
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={selectedTerms.length === 0 || (!exercisesReady && !isLoading)}
            onClick={goToReview}
          >
            {selectedTerms.length === 0
              ? 'Select at least one muscle'
              : !exercisesReady
                ? 'Loading exercises…'
                : `Next · ${selectedTerms.length} selected`}
          </Button>
        }
      >
        <BodyMusclePicker selected={selectedTerms} onToggle={toggleTerm} />
      </WizardShell>
    );
  }

  // muscle-review
  return (
    <WizardShell
      title="Your workout"
      onBack={() => setScreen('muscle-select')}
      step={2}
      totalSteps={2}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={rows.length === 0}
          onClick={handleStart}
        >
          Start Workout
        </Button>
      }
    >
      <RecommendedWorkout
        name={name}
        onNameChange={setName}
        rows={rows}
        exercises={exercises}
        onRandomize={handleRandomize}
        onReplace={handleReplace}
        onRemove={handleRemove}
        onAddForTerm={handleAddForTerm}
      />
    </WizardShell>
  );
}
