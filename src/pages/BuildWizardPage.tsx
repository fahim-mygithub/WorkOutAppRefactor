import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, PersonStanding, PencilRuler, Dumbbell } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
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
import { TrackedLifts } from '../components/build/TrackedLifts';
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
  { key: 'bb-bench', label: 'Barbell bench press', group: 'Push', required: true },
  { key: 'db-bench', label: 'Dumbbell bench press', group: 'Push', hint: 'Per dumbbell', required: true },
  { key: 'seal-row', label: 'Seal row', group: 'Pull', required: true },
  { key: 'pullup-heavy', label: 'Weighted pull-up, added load', group: 'Pull', hint: 'For about 5 reps, e.g. 35', required: true },
  { key: 'bodyweight', label: 'Bodyweight', group: 'Pull', hint: 'Optional, scales the pull-up' },
  { key: 'back-squat', label: 'Back squat', group: 'Legs', required: true },
  { key: 'front-squat', label: 'Front squat', group: 'Legs', hint: 'Optional, defaults to 82% of back squat' },
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
  // Tracked lifts checked on the chooser; "Build workout" hands them to the
  // custom builder's Visual tab (BuildPage reads `location.state.trackedLifts`).
  const trackedLifts = useAppSelector((s) => s.trackedLifts.lifts);
  const [selectedLiftIds, setSelectedLiftIds] = useState<string[]>([]);
  // Order follows the list, not click order; deleted lifts drop out.
  const selectedLifts = trackedLifts.filter((l) => selectedLiftIds.includes(l.id));
  const toggleLift = (id: string) =>
    setSelectedLiftIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
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
      <WizardShell
        title="Build a workout"
        subtitle="How do you want to start?"
        scrollableBody
        footer={
          selectedLifts.length > 0 ? (
            <Button
              variant="primary"
              size="xl"
              onClick={() => navigate('/build/custom', { state: { trackedLifts: selectedLifts } })}
            >
              <Dumbbell className="h-5 w-5" aria-hidden="true" />
              Build workout
              <span className="font-tabular opacity-70">({selectedLifts.length})</span>
            </Button>
          ) : undefined
        }
      >
        {/* Three ways to start, one row; the running list of tracked lifts sits
            underneath. The body scrolls because the list grows with the user. */}
        <div className="choice-list grid grid-cols-3 gap-2.5 pt-3">
          <ChoiceCard
            className="choice-card-in"
            layout="tile"
            icon={LayoutTemplate}
            title="Template"
            description="Push/Pull/Legs, Upper/Lower, Full-Body"
            onClick={() => setScreen('template')}
          />
          <ChoiceCard
            className="choice-card-in"
            layout="tile"
            icon={PersonStanding}
            title="By muscle"
            description="Pick muscles on the body map, get exercises"
            onClick={() => setScreen('muscle-select')}
          />
          <ChoiceCard
            className="choice-card-in"
            layout="tile"
            icon={PencilRuler}
            title="Custom"
            description="Free-form text and visual editor"
            onClick={() => navigate('/build/custom')}
          />
        </div>
        <TrackedLifts
          className="pb-6 pt-8"
          selectedIds={selectedLiftIds}
          onToggleSelect={toggleLift}
        />
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
            description="Push, pull, legs. Fills your month for you."
            onClick={() => setScreen('template-detail')}
          />
          <p className="px-1 text-body-sm text-ink-muted">More splits coming soon.</p>
        </div>
      </WizardShell>
    );
  }

  if (screen === 'template-detail') {
    return (
      <WizardShell
        title="Charlie Split"
        subtitle="Push, pull, legs, on rotation"
        onBack={() => setScreen('template')}
        footer={
          <Button variant="primary" size="xl" onClick={() => setScreen('template-1rm')}>
            Set up my lifts
          </Button>
        }
      >
        <div className="flex flex-col gap-5 pt-4">
          <p className="text-body text-ink-muted">
            A continuous rotation that fills your calendar and carries into next month from wherever
            you left off.
          </p>
          {/* The three days as rows on one subtle card — what each day trains. */}
          <ul className="divide-y divide-hairline rounded-[20px] bg-surface-subtle">
            {(
              [
                ['push', 'Bench press, alternating dumbbell and barbell, plus three rotating supersets'],
                ['pull', 'Weighted pull-ups and seal rows, back and arms'],
                ['legs', 'Squat, front squat and deadlift cycle, plus core and stability'],
              ] as const
            ).map(([g, detail]) => {
              const m = MUSCLE_GROUP_META[g];
              const Icon = m.icon;
              return (
                <li key={g} className="flex items-start gap-3 px-4 py-3.5">
                  <Icon className={cn('mt-0.5 shrink-0', m.textClass)} size={22} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">{m.label}</p>
                    <p className="mt-0.5 text-body-sm text-ink-muted">{detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </WizardShell>
    );
  }

  if (screen === 'template-1rm') {
    return (
      <WizardShell
        title="Your starting maxes"
        subtitle="Every working set scales from these. You can change them later."
        onBack={() => setScreen('template-detail')}
        footer={
          <Button
            variant="primary"
            size="xl"
            disabled={!canAutofillCharlie}
            onClick={handleActivateCharlie}
          >
            {canAutofillCharlie ? 'Autofill this month' : 'Enter your main lifts'}
          </Button>
        }
      >
        <div className="flex h-full flex-col gap-5 overflow-y-auto overscroll-contain pb-2 pt-2">
          {(['Push', 'Pull', 'Legs'] as const).map((group) => (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="px-1 text-body-sm font-semibold text-ink-muted">{group}</h2>
              <div className="divide-y divide-hairline rounded-[20px] bg-surface-subtle">
                {LIFT_FIELDS.filter((f) => f.group === group).map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-3 py-2.5 pl-4 pr-3">
                    <span className="min-w-0 flex-1 text-body-sm text-ink">
                      {f.label}
                      {f.required && <span className="sr-only"> (required)</span>}
                      {f.hint && <span className="block text-caption text-ink-muted">{f.hint}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="w-24 text-right font-semibold"
                        placeholder="0"
                        value={maxes[f.key] ?? ''}
                        onChange={(e) => setMaxes((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                      <span className="w-6 text-caption text-ink-muted">lbs</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
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
            size="xl"
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
          size="xl"
          disabled={rows.length === 0}
          onClick={handleStart}
        >
          Start workout
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
