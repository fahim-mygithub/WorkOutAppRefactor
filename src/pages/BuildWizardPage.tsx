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

type Screen = 'chooser' | 'muscle-select' | 'muscle-review' | 'template';

let rowSeq = 0;
const newRowId = () => `row-${Date.now().toString(36)}-${rowSeq++}`;

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

  const exercisesReady = exercises.length > 0;

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
      <WizardShell
        title="Templates"
        subtitle="Common splits — coming next"
        onBack={() => setScreen('chooser')}
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <LayoutTemplate size={40} className="text-ink-subtle" aria-hidden="true" />
          <p className="font-marker text-body text-ink">Split templates are on the way</p>
          <p className="max-w-xs text-body-sm text-ink-muted">
            Push/Pull/Legs, Upper/Lower and more will land here. For now, try{' '}
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setScreen('muscle-select')}
            >
              building by muscle group
            </button>
            .
          </p>
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
