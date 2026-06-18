/**
 * build-wizard-showcase.tsx — DEV-ONLY harness for the reworked build flow.
 *
 * Renders the three NEW build-wizard screens (Screen 1 chooser, muscle
 * multi-select, recommended workout) inside phone-sized frames, side-by-side in
 * LIGHT and DARK, each fully interactive against a small mock exercise catalog.
 * The point is to verify the no-scroll WizardShell framing and the muscle branch
 * without standing up Redux/Auth — so the presentational components are driven
 * directly here (the live page wires the same components to useExercises + store).
 *
 * Served at /build-wizard-showcase.html in `vite dev`. Not in the app build.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import '../App.css';
import '../styles/animations.css';
import '../styles/board.css';
import { BoardFilters } from '../components/BoardFilters';
import { LayoutTemplate, PersonStanding, PencilRuler } from 'lucide-react';
import type { Exercise } from '../types/exercise';
import { WizardShell } from '../components/build/WizardShell';
import { ChoiceCard } from '../components/build/ChoiceCard';
import { BodyMusclePicker } from '../components/build/BodyMusclePicker';
import { RecommendedWorkout, type ReviewRow } from '../components/build/RecommendedWorkout';
import { recommendOne, randomForMuscle } from '../lib/recommendExercises';
import { Button } from '../components/ui/button';

// --- mock catalog ----------------------------------------------------------
let mockSeq = 0;
function mk(name: string, term: string, equipment: string, mechanic: 'Compound' | 'Isolation'): Exercise {
  mockSeq += 1;
  return {
    id: `mock-${mockSeq}`,
    name,
    muscleGroup: `${equipment}, ${term}`,
    muscleGroups: [term],
    equipment,
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: null,
    grips: null,
    mechanic,
    searchKeywords: [name.toLowerCase()],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const MOCK: Exercise[] = [
  mk('Barbell Bench Press', 'Chest', 'Barbell', 'Compound'),
  mk('Incline Dumbbell Press', 'Chest', 'Dumbbells', 'Compound'),
  mk('Cable Fly', 'Chest', 'Cables', 'Isolation'),
  mk('Overhead Press', 'Shoulders', 'Barbell', 'Compound'),
  mk('Lateral Raise', 'Shoulders', 'Dumbbells', 'Isolation'),
  mk('Face Pull', 'Shoulders', 'Cables', 'Isolation'),
  mk('Close-Grip Bench', 'Triceps', 'Barbell', 'Compound'),
  mk('Tricep Pushdown', 'Triceps', 'Cables', 'Isolation'),
  mk('Barbell Curl', 'Biceps', 'Barbell', 'Isolation'),
  mk('Hammer Curl', 'Biceps', 'Dumbbells', 'Isolation'),
  mk('Back Squat', 'Quads', 'Barbell', 'Compound'),
  mk('Leg Press', 'Quads', 'Machine', 'Compound'),
  mk('Romanian Deadlift', 'Hamstrings', 'Barbell', 'Compound'),
];

let rowSeq = 0;
const newRowId = () => `row-${rowSeq++}`;

const PhoneFrame: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="mb-2 font-marker text-body-sm text-ink-muted">{label}</p>
    <div className="h-[700px] w-[360px] overflow-hidden rounded-[1.75rem] border-2 border-ink/20 shadow-e2">
      {children}
    </div>
  </div>
);

// --- interactive screen wrappers -------------------------------------------

const ChooserScreen: React.FC = () => (
  <WizardShell title="Build a workout" subtitle="How do you want to start?">
    <div className="choice-list flex flex-col gap-4 pt-7">
      <ChoiceCard className="choice-card-in" icon={LayoutTemplate} title="Use a Template" description="Push/Pull/Legs, Upper/Lower, Full-Body…" onClick={() => {}} />
      <ChoiceCard className="choice-card-in" icon={PersonStanding} title="By Muscle Group" description="Pick muscles on the body map, get exercises" onClick={() => {}} />
      <ChoiceCard className="choice-card-in" icon={PencilRuler} title="Custom Build" description="Free-form text & visual editor" onClick={() => {}} />
    </div>
  </WizardShell>
);

const SelectScreen: React.FC = () => {
  const [selected, setSelected] = React.useState<string[]>(['Chest', 'Shoulders']);
  const toggle = (t: string) =>
    setSelected((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  return (
    <WizardShell
      title="Pick muscles"
      subtitle="Tap each muscle you want to train"
      onBack={() => {}}
      step={1}
      totalSteps={2}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={selected.length === 0}>
          {selected.length === 0 ? 'Select at least one muscle' : `Next · ${selected.length} selected`}
        </Button>
      }
    >
      <BodyMusclePicker selected={selected} onToggle={toggle} />
    </WizardShell>
  );
};

const ReviewScreen: React.FC = () => {
  const [name, setName] = React.useState('Chest & Shoulders');
  const initial = ['Chest', 'Shoulders', 'Triceps'];
  const [rows, setRows] = React.useState<ReviewRow[]>(() => {
    const used = new Set<string>();
    const out: ReviewRow[] = [];
    for (const term of initial) {
      const ex = recommendOne(MOCK, term, used);
      if (ex) {
        used.add(ex.id);
        out.push({ rowId: newRowId(), term, exercise: ex });
      }
    }
    return out;
  });

  const randomize = (rowId: string) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const ex = randomForMuscle(MOCK, r.term, new Set(prev.map((x) => x.exercise.id)), r.exercise.id);
        return ex ? { ...r, exercise: ex } : r;
      }),
    );
  const replace = (rowId: string, exercise: Exercise) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, exercise } : r)));
  const remove = (rowId: string) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  const addForTerm = (term: string) => {
    const used = new Set(rows.map((r) => r.exercise.id));
    const ex = recommendOne(MOCK, term, used);
    if (ex) setRows((prev) => [...prev, { rowId: newRowId(), term, exercise: ex }]);
  };

  return (
    <WizardShell
      title="Your workout"
      onBack={() => {}}
      step={2}
      totalSteps={2}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled={rows.length === 0}>
          Start Workout
        </Button>
      }
    >
      <RecommendedWorkout
        name={name}
        onNameChange={setName}
        rows={rows}
        exercises={MOCK}
        onRandomize={randomize}
        onReplace={replace}
        onRemove={remove}
        onAddForTerm={addForTerm}
      />
    </WizardShell>
  );
};

const Column: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => (
  <div className={theme}>
    <div className="min-h-screen bg-surface p-4 text-ink">
      <p className="mb-4 font-marker text-caption uppercase tracking-widest text-ink-subtle">
        {theme === 'light' ? 'Whiteboard — light' : 'Chalkboard — dark'}
      </p>
      <div className="flex flex-wrap gap-6">
        <PhoneFrame label="Screen 1 — choose">
          <ChooserScreen />
        </PhoneFrame>
        <PhoneFrame label="By muscle — select">
          <SelectScreen />
        </PhoneFrame>
        <PhoneFrame label="By muscle — review">
          <ReviewScreen />
        </PhoneFrame>
      </div>
    </div>
  </div>
);

const ShowcaseApp: React.FC = () => (
  <MemoryRouter>
    <BoardFilters />
    <div className="grid grid-cols-1 2xl:grid-cols-2">
      <Column theme="light" />
      <Column theme="dark" />
    </div>
  </MemoryRouter>
);

const el = document.getElementById('wizard-root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ShowcaseApp />
    </React.StrictMode>,
  );
}
