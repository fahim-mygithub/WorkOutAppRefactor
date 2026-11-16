import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import plannedWorkoutsReducer, { planAdded, planMoved } from '../store/slices/plannedWorkoutsSlice';
import workoutReducer, { completeSet } from '../store/slices/workoutSlice';
import userReducer from '../store/slices/userSlice';
import trackedLiftsReducer from '../store/slices/trackedLiftsSlice';
import exerciseReducer, { setExercises } from '../store/slices/exerciseSlice';
import customExerciseReducer from '../store/slices/customExerciseSlice';
import exerciseHistoryReducer from '../store/slices/exerciseHistorySlice';
import scheduleReducer from '../store/slices/scheduleSlice';
import aiReducer from '../store/slices/aiSlice';
import BuildWizardPage from './BuildWizardPage';
import BuildPage from './BuildPage';
import { PlannedWorkoutsSection } from '../components/plan/PlannedWorkoutsSection';
import { TodayWorkout } from '../components/home/TodayWorkout';
import { WorkoutDayModal } from '../components/home/WorkoutDayModal';
import { WorkoutListView } from '../components/workout/list/WorkoutListView';
import { ExercisePlayCard } from '../components/workout/player/ExercisePlayCard';
import { ExerciseHistoryDetailModal } from '../components/profile/ExerciseHistoryDetailModal';
import { CompletedWorkoutCard } from '../components/profile/CompletedWorkoutCard';
import { WorkoutStorageService } from '../services/workoutStorageService';
import { ExerciseHistoryService } from '../services/exerciseHistoryService';
import { planToolCall } from '../ai/applyTool';
import { addDaysKey, dateKeyToDate, toDateKey } from '../lib/dateKey';
import type { Exercise, WorkoutExercise } from '../types/exercise';
import type { WorkoutCalendarDay } from '../utils/statsCalculator';

const catalog: Exercise[] = [
  {
    id: 'ex-bench',
    name: 'Barbell Bench Press',
    muscleGroup: 'Chest',
    muscleGroups: ['Chest', 'Triceps'],
    equipment: 'Barbell',
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: ['bench', 'press'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'ex-curl',
    name: 'Dumbbell Curl',
    muscleGroup: 'Biceps',
    muscleGroups: ['Biceps'],
    equipment: 'Dumbbells',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: ['curl'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'ex-tricep',
    name: 'Tricep Rope Pushdown',
    muscleGroup: 'Triceps',
    muscleGroups: ['Triceps'],
    equipment: 'Cables',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: null,
    grips: null,
    mechanic: null,
    searchKeywords: ['tricep', 'pushdown'],
    createdAt: '',
    updatedAt: '',
  },
];

vi.mock('../hooks/useExercises', () => ({
  useExercises: () => ({ exercises: catalog, isLoading: false, error: null }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-test', email: 'test@example.com' } }),
}));

vi.mock('../services/workoutStorageService', () => ({
  WorkoutStorageService: {
    saveWorkout: vi.fn().mockResolvedValue('tpl-mock'),
    getUserWorkouts: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/exerciseHistoryService', () => ({
  ExerciseHistoryService: {
    getWorkoutHistory: vi.fn().mockResolvedValue([]),
    getExerciseHistory: vi.fn().mockResolvedValue([]),
    getExerciseHistoryByWorkoutId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/sharedWorkoutService', () => ({}));
vi.mock('../components/ShareWorkoutModal', () => ({ ShareWorkoutModal: () => null }));
vi.mock('../components/SharedWorkoutLoader', () => ({ SharedWorkoutLoader: () => null }));

function makeWorkoutExercise(
  id: string,
  ex: Exercise,
  opts: Partial<WorkoutExercise> = {},
): WorkoutExercise {
  return {
    id,
    exercise: ex,
    sets: opts.sets ?? [
      { id: `${id}-s1`, reps: 6, weight: 185, unit: 'lbs', completed: false },
      { id: `${id}-s2`, reps: 6, weight: 185, unit: 'lbs', completed: false },
    ],
    restTime: opts.restTime ?? 120,
    ...opts,
  };
}

function makeStore() {
  const store = configureStore({
    reducer: {
      plannedWorkouts: plannedWorkoutsReducer,
      workout: workoutReducer,
      user: userReducer,
      trackedLifts: trackedLiftsReducer,
      exercise: exerciseReducer,
      customExercise: customExerciseReducer,
      exerciseHistory: exerciseHistoryReducer,
      schedule: scheduleReducer,
      ai: aiReducer,
    },
    middleware: (g) => g({ serializableCheck: false, immutableCheck: false }),
  });
  store.dispatch(setExercises(catalog));
  return store;
}

function PathDisplay() {
  const loc = useLocation();
  return <div data-testid="current-path">{loc.pathname}</div>;
}

function renderPlanApp(store: ReturnType<typeof makeStore>, initialPath = '/') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PathDisplay />
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <TodayWorkout workoutHistory={[]} isLoading={false} />
                <PlannedWorkoutsSection />
              </div>
            }
          />
          <Route path="/build" element={<BuildWizardPage />} />
          <Route path="/build/custom" element={<BuildPage />} />
          <Route path="/workout" element={<div data-testid="workout-screen">Workout running</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const quiet: { mockRestore: () => void }[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  quiet.push(
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
  );
});
afterEach(() => {
  quiet.splice(0).forEach((s) => s.mockRestore());
});

describe('Plan edit in Builder and per-exercise Volume/Strength emphasis', () => {
  it('opens Builder via Edit button on PlannedWorkoutsSection, shows banner + snapshot, and Save plan updates in place without duplicating or creating a template', async () => {
    const saveTemplateSpy = vi.spyOn(WorkoutStorageService, 'saveWorkout').mockResolvedValue('tpl-1');
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());
    const tomorrow = addDaysKey(today, 1);

    store.dispatch(
      planAdded({
        id: 'plan-upper',
        dateKey: tomorrow,
        name: 'Upper Power',
        exercises: [
          makeWorkoutExercise('we-1', catalog[0], {
            emphasis: 'strength',
            notes: 'Pause 1s on chest',
          }),
        ],
      }),
    );

    renderPlanApp(store, '/');

    // Explicit Edit button navigates through /build into the Builder with the plan loaded
    await u.click(screen.getByRole('button', { name: /edit upper power/i }));

    const banner = await screen.findByTestId('editing-plan-banner');
    expect(banner).toHaveTextContent(/Editing plan:\s*Upper Power\s*·/);

    // AI Build snapshot reports editing the plan + exercise emphasis
    await waitFor(() => {
      const snap = store.getState().ai.screen;
      expect(snap?.tab).toBe('build');
      expect(snap?.summary).toMatch(/Editing plan "Upper Power"/);
      const data = snap?.data as {
        editingPlan?: { planId: string; dateKey: string };
        exercises: Array<{ name: string; emphasis?: string }>;
      };
      expect(data.editingPlan).toEqual({ planId: 'plan-upper', dateKey: tomorrow });
      expect(data.exercises[0]).toMatchObject({ name: 'Barbell Bench Press', emphasis: 'strength' });
    });

    // Rename workout in Builder and flip Barbell Bench Press to Volume on Visual tab
    const nameInput = screen.getByLabelText(/workout name/i);
    await u.clear(nameInput);
    await u.type(nameInput, 'Upper Hypertrophy');

    const benchGroup = screen.getByRole('group', { name: 'Barbell Bench Press emphasis' });
    await u.click(within(benchGroup).getByRole('button', { name: 'Volume' }));

    // Primary action is Save plan; secondary Save as new workout and Cancel are also shown
    expect(screen.getByRole('button', { name: /save as new workout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /^save plan$/i }));

    // Returned to Today
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/'));

    // Same plan id and dateKey updated in place; no duplicate plan, no saved template
    const plans = store.getState().plannedWorkouts.plans;
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('plan-upper');
    expect(plans[0].dateKey).toBe(tomorrow);
    expect(plans[0].name).toBe('Upper Hypertrophy');
    expect(plans[0].exercises[0].emphasis).toBe('volume');
    expect(plans[0].exercises[0].notes).toBe('Pause 1s on chest');
    expect(saveTemplateSpy).not.toHaveBeenCalled();
  });

  it('Cancel discards Builder changes and leaves the plan untouched; Save as new workout saves a template without duplicating the plan', async () => {
    const saveTemplateSpy = vi.spyOn(WorkoutStorageService, 'saveWorkout').mockResolvedValue('tpl-99');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-today-1',
        dateKey: today,
        name: 'Morning Bench',
        exercises: [makeWorkoutExercise('we-1', catalog[0], { emphasis: 'strength' })],
      }),
    );

    renderPlanApp(store, '/');

    // Open Builder via Today hero card tap
    await u.click(screen.getByTestId('today-plan-card'));
    await screen.findByTestId('editing-plan-banner');

    // Save as new workout creates a template while leaving the planned workout intact
    await u.click(screen.getByRole('button', { name: /save as new workout/i }));
    await waitFor(() => expect(saveTemplateSpy).toHaveBeenCalledTimes(1));
    expect(store.getState().plannedWorkouts.plans).toHaveLength(1);

    // Mutate name in Builder, then click Cancel -> plan keeps original name "Morning Bench"
    const nameInput = screen.getByLabelText(/workout name/i);
    await u.clear(nameInput);
    await u.type(nameInput, 'Discarded Name');
    await u.click(screen.getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/'));
    const [plan] = store.getState().plannedWorkouts.plans;
    expect(plan.id).toBe('plan-today-1');
    expect(plan.name).toBe('Morning Bench');
    expect(plan.exercises[0].emphasis).toBe('strength');
  });

  it('preserves superset pairing and independent partner emphasis across Visual edits, Text re-parse, AI setBuildEmphasis, and Save plan', async () => {
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-arms',
        dateKey: today,
        name: 'Arm Superset Plan',
        exercises: [
          makeWorkoutExercise('we-curl', catalog[1], {
            isSuperset: true,
            supersetId: 'ss-arms',
            supersetIndex: 0,
            supersetExerciseIds: ['we-curl', 'we-tri'],
            emphasis: 'volume',
            notes: 'Superset (1/2) · Squeeze at top',
          }),
          makeWorkoutExercise('we-tri', catalog[2], {
            isSuperset: true,
            supersetId: 'ss-arms',
            supersetIndex: 1,
            emphasis: 'strength',
            notes: 'Superset (2/2)',
          }),
        ],
      }),
    );

    renderPlanApp(store, '/');

    // Open from Today hero explicit Edit button
    const hero = screen.getByRole('region', { name: 'Today' });
    await u.click(within(hero).getByRole('button', { name: /edit arm superset plan/i }));

    await screen.findByTestId('editing-plan-banner');

    // Both partners show as paired in Superset 1 with independent emphasis states
    const curlGroup = screen.getByRole('group', { name: 'Dumbbell Curl emphasis' });
    const triGroup = screen.getByRole('group', { name: 'Tricep Rope Pushdown emphasis' });
    expect(within(curlGroup).getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(triGroup).getByRole('button', { name: 'Strength' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/Superset 1/)).toHaveLength(2);

    // Switch to Text tab and re-parse -> superset pairing and flags MUST survive re-parse!
    await u.click(screen.getByRole('tab', { name: /text/i }));
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('[volume]');
    expect(textarea.value).toContain(' ss ');
    expect(textarea.value).toContain('[strength]');

    await u.click(screen.getByRole('button', { name: /parse/i }));

    await waitFor(() => expect(screen.getAllByText(/Superset 1/)).toHaveLength(2));

    // Assistant flips Tricep Rope Pushdown to volume via setBuildEmphasis -> pairing still survives!
    const aiPlan = planToolCall(
      { id: 'ai-emp-1', name: 'setBuildEmphasis', input: { exerciseName: 'Tricep Rope Pushdown', emphasis: 'volume' } },
      {
        activeWorkout: null,
        trackedLifts: [],
        library: catalog,
        units: 'lbs',
        buildDraft: store.getState().ai.buildDraft,
      },
    );
    expect(aiPlan.kind).toBe('auto');
    if (aiPlan.kind === 'auto') {
      act(() => aiPlan.apply.forEach((a) => store.dispatch(a)));
    }

    // Flip Tricep Rope Pushdown back to Strength on Visual tab to keep mixed flags
    await waitFor(() => {
      const g = screen.getByRole('group', { name: 'Tricep Rope Pushdown emphasis' });
      expect(within(g).getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'true');
    });
    await u.click(
      within(screen.getByRole('group', { name: 'Tricep Rope Pushdown emphasis' })).getByRole('button', {
        name: 'Strength',
      }),
    );

    // Save plan -> superset pairing and mixed partner flags persist in store
    await u.click(screen.getByRole('button', { name: /^save plan$/i }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/'));

    const savedPlan = store.getState().plannedWorkouts.plans[0];
    expect(savedPlan.id).toBe('plan-arms');
    expect(savedPlan.exercises).toHaveLength(2);
    expect(savedPlan.exercises[0].isSuperset).toBe(true);
    expect(savedPlan.exercises[1].isSuperset).toBe(true);
    expect(savedPlan.exercises[0].supersetId).toBeTruthy();
    expect(savedPlan.exercises[0].supersetId).toBe(savedPlan.exercises[1].supersetId);
    expect(savedPlan.exercises[0].emphasis).toBe('volume');
    expect(savedPlan.exercises[1].emphasis).toBe('strength');
  });

  it('asks before replacing an unsaved Builder draft when tapping Edit on a planned workout', async () => {
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-1',
        dateKey: today,
        name: 'Evening Pull',
        exercises: [makeWorkoutExercise('we-curl', catalog[1], { emphasis: 'volume' })],
      }),
    );

    const buildView = renderPlanApp(store, '/build/custom');

    // Type an unsaved draft on Build
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '3x10 Barbell Bench Press @155lbs' } });
    await waitFor(() => expect(store.getState().ai.buildHasDraft).toBe(true));

    // Unmount Build and mount Today with the same store (simulating bottom-nav switch to Today)
    buildView.unmount();
    renderPlanApp(store, '/');

    const hero = screen.getByRole('region', { name: 'Today' });
    await u.click(within(hero).getByRole('button', { name: /edit evening pull/i }));

    // Warning dialog asks before replacing the unsaved draft
    expect(await screen.findByText('This replaces what is on the Build screen now.')).toBeInTheDocument();

    // Cancel leaves draft intact
    await u.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByText('This replaces what is on the Build screen now.')).not.toBeInTheDocument(),
    );
    expect(store.getState().ai.buildHasDraft).toBe(true);

    // Tapping Edit again and confirming replaces draft and opens Builder with Evening Pull
    await waitFor(() => expect(within(hero).getByRole('button', { name: /edit evening pull/i })).toBeInTheDocument());
    await u.click(within(hero).getByRole('button', { name: /edit evening pull/i }));
    await u.click(await screen.findByRole('button', { name: /replace draft/i }));

    await waitFor(() =>
      expect(screen.getByTestId('editing-plan-banner')).toHaveTextContent(/Editing plan:\s*Evening Pull/),
    );
  });

  it('supports editing a planned workout from WorkoutDayModal (week-day modal)', async () => {
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());
    const targetKey = addDaysKey(today, 2);
    const targetDate = dateKeyToDate(targetKey);

    store.dispatch(
      planAdded({
        id: 'plan-modal',
        dateKey: targetKey,
        name: 'Modal Leg Plan',
        exercises: [makeWorkoutExercise('we-1', catalog[0], { emphasis: 'strength' })],
      }),
    );

    const day: WorkoutCalendarDay = {
      date: targetDate,
      workouts: [],
      isToday: false,
      isCurrentMonth: true,
      isPast: false,
      dayNumber: targetDate.getDate(),
    };

    const onClose = vi.fn();
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<WorkoutDayModal day={day} isOpen={true} onClose={onClose} />} />
            <Route path="/build" element={<BuildWizardPage />} />
            <Route path="/build/custom" element={<BuildPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    expect(await screen.findByText('Modal Leg Plan')).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /edit modal leg plan/i }));
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByTestId('editing-plan-banner')).toHaveTextContent(/Editing plan:\s*Modal Leg Plan/);
  });

  it('carries emphasis end-to-end through Save plan -> Move -> Start (WorkoutListView & ExercisePlayCard) -> Finish (ExerciseHistory & history detail)', async () => {
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());
    const tomorrow = addDaysKey(today, 1);

    store.dispatch(
      planAdded({
        id: 'plan-e2e',
        dateKey: today,
        name: 'Full Upper',
        exercises: [
          makeWorkoutExercise('we-bench', catalog[0]),
          makeWorkoutExercise('we-curl', catalog[1]),
        ],
      }),
    );

    const app = renderPlanApp(store, '/');

    // 1. Edit in Builder: mark Barbell Bench Press -> Strength, Dumbbell Curl -> Volume, then Save plan
    const plannedSection = screen.getByTestId('planned-workouts-section');
    await u.click(within(plannedSection).getByRole('button', { name: /edit full upper/i }));
    await screen.findByTestId('editing-plan-banner');

    await u.click(
      within(screen.getByRole('group', { name: 'Barbell Bench Press emphasis' })).getByRole('button', {
        name: 'Strength',
      }),
    );
    await u.click(
      within(screen.getByRole('group', { name: 'Dumbbell Curl emphasis' })).getByRole('button', {
        name: 'Volume',
      }),
    );
    await u.click(screen.getByRole('button', { name: /^save plan$/i }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/'));

    // Plan card shows Strength and Volume chips
    expect(within(screen.getByTestId('planned-workouts-section')).getByText('Strength')).toBeInTheDocument();
    expect(within(screen.getByTestId('planned-workouts-section')).getByText('Volume')).toBeInTheDocument();

    // 2. Move preserves emphasis
    act(() => {
      store.dispatch(planMoved({ id: 'plan-e2e', dateKey: tomorrow }));
      store.dispatch(planMoved({ id: 'plan-e2e', dateKey: today }));
    });
    expect(store.getState().plannedWorkouts.plans[0].exercises.map((e) => e.emphasis)).toEqual([
      'strength',
      'volume',
    ]);

    // 3. Start workout preserves emphasis and shows chips in WorkoutListView & ExercisePlayCard
    const startBtns = within(screen.getByTestId('planned-workouts-section')).getAllByRole('button', {
      name: /^start$/i,
    });
    await u.click(startBtns[0]);

    const active = store.getState().workout.activeWorkout!;
    expect(active.exercises.map((e) => e.emphasis)).toEqual(['strength', 'volume']);
    app.unmount();

    const listView = render(
      <WorkoutListView workout={active} onCompleteSet={vi.fn()} onUncompleteSet={vi.fn()} />,
    );
    expect(listView.getByText('Strength')).toBeInTheDocument();
    expect(listView.getByText('Volume')).toBeInTheDocument();
    listView.unmount();

    const playCard = render(
      <ExercisePlayCard
        exercise={active.exercises[0]}
        currentSetIndex={0}
        currentSet={active.exercises[0].sets[0]}
        supersetPartners={[]}
        previousPerformance={null}
        onEditSets={vi.fn()}
        onCompleteSet={vi.fn()}
        onUncompleteSet={vi.fn()}
        onJumpToSet={vi.fn()}
      />,
    );
    expect(playCard.getByText('Strength')).toBeInTheDocument();
    playCard.unmount();

    // 4. Complete sets and verify ExerciseHistoryDetailModal + CompletedWorkoutCard render emphasis chips
    store.dispatch(completeSet({ exerciseIndex: 0, setIndex: 0, setData: { reps: 6, weight: 185 } }));
    store.dispatch(completeSet({ exerciseIndex: 1, setIndex: 0, setData: { reps: 10, weight: 35 } }));

    const now = new Date();
    const historyEntry = {
      id: 'eh-bench-1',
      userId: 'u-test',
      exerciseId: 'ex-bench',
      exerciseName: 'Barbell Bench Press',
      muscleGroups: ['Chest', 'Triceps'],
      equipment: 'Barbell',
      configuration: 'Standard',
      emphasis: active.exercises[0].emphasis,
      workoutId: 'wh-1',
      workoutName: 'Full Upper',
      workoutDate: now,
      sets: [{ setNumber: 1, targetReps: 6, actualReps: 6, weight: 185, unit: 'lbs' as const, completed: true }],
      totalVolume: 1110,
      personalRecords: { maxWeight: false, maxReps: false, maxVolume: false },
      createdAt: now,
      updatedAt: now,
    };
    vi.spyOn(ExerciseHistoryService, 'getExerciseHistory').mockResolvedValue([historyEntry]);

    const detailModal = render(
      <ExerciseHistoryDetailModal
        isOpen={true}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
        userId="u-test"
        exerciseGroup={{
          exerciseId: 'ex-bench',
          exerciseName: 'Barbell Bench Press',
          configuration: 'Standard',
          key: 'Barbell Bench Press|Standard',
          entries: [historyEntry],
          lastPerformed: now.toISOString(),
          timesPerformed: 1,
          maxWeight: 185,
          totalVolume: 1110,
          avgVolume: 1110,
          hasPersonalRecords: false,
        }}
        exercises={catalog}
      />,
    );
    expect(await detailModal.findByText('Strength')).toBeInTheDocument();
    detailModal.unmount();

    const summaryCard = render(
      <Provider store={store}>
        <MemoryRouter>
          <ul>
            <CompletedWorkoutCard
              userId="u-test"
              workout={{
                id: 'wh-1',
                userId: 'u-test',
                name: 'Full Upper',
                startTime: now,
                endTime: now,
                duration: 45,
                totalExercises: 2,
                totalSets: 2,
                totalReps: 16,
                totalVolume: 1460,
                exercisesSummary: [
                  {
                    exerciseId: 'ex-bench',
                    exerciseName: 'Barbell Bench Press',
                    sets: 1,
                    reps: 6,
                    volume: 1110,
                    emphasis: 'strength',
                  },
                  {
                    exerciseId: 'ex-curl',
                    exerciseName: 'Dumbbell Curl',
                    sets: 1,
                    reps: 10,
                    volume: 350,
                    emphasis: 'volume',
                  },
                ],
              }}
            />
          </ul>
        </MemoryRouter>
      </Provider>,
    );
    await u.click(summaryCard.getByRole('button', { name: /full upper/i }));
    await waitFor(() => {
      const chips = screen.getAllByTestId('emphasis-chip').map((el) => el.textContent);
      expect(chips).toEqual(['Strength', 'Volume']);
    });
  });

  it('preserves tracked metadata, notes, restTime, and superset pairing when appending [strength] in Text tab and switching back to Visual without clicking Parse', async () => {
    const u = userEvent.setup();
    const store = makeStore();
    const today = toDateKey(new Date());

    store.dispatch(
      planAdded({
        id: 'plan-text-sync',
        dateKey: today,
        name: 'Text Sync Plan',
        exercises: [
          makeWorkoutExercise('we-bench', catalog[0], {
            tracked: { liftId: 'lift-bench', goal: 'volume' },
            emphasis: 'volume',
            notes: 'Pause 1s',
            restTime: 180,
          }),
          makeWorkoutExercise('we-curl', catalog[1], {
            isSuperset: true,
            supersetId: 'ss-1',
            supersetIndex: 0,
            supersetExerciseIds: ['we-curl', 'we-tri'],
            emphasis: 'volume',
          }),
          makeWorkoutExercise('we-tri', catalog[2], {
            isSuperset: true,
            supersetId: 'ss-1',
            supersetIndex: 1,
          }),
        ],
      }),
    );

    renderPlanApp(store, '/');

    const hero = screen.getByRole('region', { name: 'Today' });
    await u.click(within(hero).getByRole('button', { name: /edit text sync plan/i }));
    await screen.findByTestId('editing-plan-banner');

    // Switch to Text tab and edit text (>10 chars delta by replacing [volume] and appending [strength] on Tricep Rope Pushdown)
    await u.click(screen.getByRole('tab', { name: /text/i }));
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const nextText = textarea.value
      .replace('Barbell Bench Press @185lbs [volume]', 'Barbell Bench Press @185lbs [strength]')
      .replace('Tricep Rope Pushdown @185lbs', 'Tricep Rope Pushdown @185lbs [strength]');
    fireEvent.change(textarea, { target: { value: nextText } });

    // Switch directly to Visual tab without clicking Parse -> Visual reflects new tags & keeps superset
    await u.click(screen.getByRole('tab', { name: /visual/i }));

    const benchGroup = screen.getByRole('group', { name: 'Barbell Bench Press emphasis' });
    const triGroup = screen.getByRole('group', { name: 'Tricep Rope Pushdown emphasis' });
    expect(within(benchGroup).getByRole('button', { name: 'Strength' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(triGroup).getByRole('button', { name: 'Strength' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/Superset 1/)).toHaveLength(2);

    await u.click(screen.getByRole('button', { name: /^save plan$/i }));
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/'));

    const saved = store.getState().plannedWorkouts.plans[0];
    expect(saved.id).toBe('plan-text-sync');
    expect(saved.exercises[0].emphasis).toBe('strength');
    expect(saved.exercises[0].tracked).toEqual({ liftId: 'lift-bench', goal: 'strength' });
    expect(saved.exercises[0].notes).toBe('Pause 1s');
    expect(saved.exercises[0].restTime).toBe(180);
    expect(saved.exercises[1].isSuperset).toBe(true);
    expect(saved.exercises[2].isSuperset).toBe(true);
    expect(saved.exercises[1].supersetId).toBe(saved.exercises[2].supersetId);
    expect(saved.exercises[1].emphasis).toBe('volume');
    expect(saved.exercises[2].emphasis).toBe('strength');
  });
});
