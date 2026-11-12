// The Build screen as the assistant sees and edits it: it publishes its draft
// while open, applies the assistant's edit tools to its own state (so the
// parsed preview changes), takes them back on Undo, and clears on unmount.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import ai from '../store/slices/aiSlice';
import user from '../store/slices/userSlice';
import exercise from '../store/slices/exerciseSlice';
import customExercise from '../store/slices/customExerciseSlice';
import { planToolCall, type PlanContext } from './applyTool';
import type { AiToolCall } from './types';
import type { Exercise } from '../types/exercise';
import BuildPage from '../pages/BuildPage';

const library = [
  { id: 'x-bench', name: 'Barbell Bench Press', equipment: 'Barbell', muscleGroups: ['Chest'] },
  { id: 'x-row', name: 'Barbell Bent Over Row', equipment: 'Barbell', muscleGroups: ['Back'] },
  { id: 'x-pull', name: 'Pull Ups', equipment: 'Bodyweight', muscleGroups: ['Back'] },
] as Exercise[];

vi.mock('../hooks/useExercises', () => ({
  useExercises: () => ({ exercises: library, isLoading: false }),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.c' } }),
}));
vi.mock('../services/workoutStorageService', () => ({
  WorkoutStorageService: { saveWorkout: vi.fn(), getUserWorkouts: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../services/exerciseHistoryService', () => ({
  ExerciseHistoryService: { getWorkoutHistory: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../services/sharedWorkoutService', () => ({}));
vi.mock('../components/ShareWorkoutModal', () => ({ ShareWorkoutModal: () => null }));
vi.mock('../components/SharedWorkoutLoader', () => ({ SharedWorkoutLoader: () => null }));

const TEXT = '3x8 Barbell Bench Press @135lbs\n4x10 Pull Ups';

function setup() {
  const store = configureStore({
    reducer: { ai, user, exercise, customExercise },
    middleware: (g) => g({ serializableCheck: false, immutableCheck: false }),
  });
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/build/custom']}>
        <BuildPage />
      </MemoryRouter>
    </Provider>,
  );
  const ctx = (): PlanContext => ({
    activeWorkout: null, trackedLifts: [], library, units: 'lbs', buildDraft: store.getState().ai.buildDraft,
  });
  /** What the host does for an auto plan: plan against the latest state, dispatch. */
  const assistant = (name: AiToolCall['name'], input: Record<string, unknown>, id = 'c1') => {
    const plan = planToolCall({ id, name, input }, ctx());
    if (plan.kind !== 'auto') throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
    act(() => plan.apply.forEach((a) => store.dispatch(a)));
    return plan;
  };
  return { store, view, assistant };
}

const typeDraft = (text: string) =>
  fireEvent.change(document.querySelector('textarea') as HTMLTextAreaElement, { target: { value: text } });

/** The preview row of one exercise: its name and the sets line under it. */
const previewRow = async (name: string) => {
  const row = (await screen.findByText(name, { selector: 'span' }, { timeout: 4000 })).closest('li');
  if (!row) throw new Error(`no preview row for ${name}`);
  return row;
};

// The page and the parser log a lot. Restored one by one: restoreAllMocks would
// also wipe the mocked services above.
const quiet: { mockRestore: () => void }[] = [];
beforeEach(() => {
  quiet.push(vi.spyOn(console, 'log').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {}));
});
afterEach(() => quiet.splice(0).forEach((spy) => spy.mockRestore()));

describe('Build screen and the assistant', () => {
  it('publishes the draft while open and clears it on unmount', async () => {
    const { store, view } = setup();
    expect(store.getState().ai.screen).toMatchObject({ tab: 'build', title: 'Build workout', summary: 'Unnamed draft, empty, text tab' });
    typeDraft(TEXT);
    await waitFor(() => expect(store.getState().ai.screen?.summary).toBe('Unnamed draft, 2 exercises, text tab'));
    const data = store.getState().ai.screen?.data as { text: string; exercises: { name: string; sets: number }[] };
    expect(data.text).toBe(TEXT);
    expect(data.exercises.map((e) => [e.name, e.sets])).toEqual([['Barbell Bench Press', 3], ['Pull Ups', 4]]);
    expect(store.getState().ai.buildDraft).toEqual({ name: '', text: TEXT });
    view.unmount();
    expect(store.getState().ai.screen).toBeUndefined();
    expect(store.getState().ai.buildDraft).toBeUndefined();
  });

  it('publishes at most 2,000 characters of a long draft, within the whole-block cap', async () => {
    const { store } = setup();
    typeDraft(Array.from({ length: 150 }, (_, k) => `3x8 Barbell Bench Press @${100 + k}lbs`).join('\n'));
    await waitFor(() => expect(store.getState().ai.screen?.summary).toContain('150 exercises'));
    expect(JSON.stringify(store.getState().ai.screen).length).toBeLessThanOrEqual(3_000);
    expect(store.getState().ai.buildDraft?.text.length).toBeGreaterThan(2_000);
  });

  it("the assistant's editBuildExercise changes the parsed preview, and Undo puts it back", async () => {
    const { store, assistant } = setup();
    typeDraft(TEXT);
    const before = await previewRow('Barbell Bench Press');
    expect(within(before).getByText(/8 × 135lbs/)).toBeTruthy();
    expect(within(before).getByText('3', { selector: 'span' })).toBeTruthy();

    const plan = assistant('editBuildExercise', { exerciseName: 'Bench Press', sets: 5, weight: 145 });

    await waitFor(async () => {
      const row = await previewRow('Barbell Bench Press');
      expect(within(row).getByText('5', { selector: 'span' })).toBeTruthy();
      expect(within(row).getByText(/8 × 145lbs/)).toBeTruthy();
    }, { timeout: 4000 });
    // The other exercise is untouched, the page consumed the edit, and the snapshot follows.
    expect(within(await previewRow('Pull Ups')).getByText(/10 reps/)).toBeTruthy();
    expect(store.getState().ai.buildEdit).toBeUndefined();
    expect(store.getState().ai.buildDraft?.text).toBe('5x8 Barbell Bench Press @145lbs\n4x10 Pull Ups');
    await waitFor(() => {
      const data = store.getState().ai.screen?.data as { exercises: { name: string; sets: number; weight?: number }[] };
      expect(data.exercises[0]).toMatchObject({ name: 'Barbell Bench Press', sets: 5, weight: 145 });
    });

    act(() => plan.undo.forEach((a) => store.dispatch(a)));
    await waitFor(async () => {
      const row = await previewRow('Barbell Bench Press');
      expect(within(row).getByText(/8 × 135lbs/)).toBeTruthy();
    });
    expect(store.getState().ai.buildDraft?.text).toBe(TEXT);
  });

  it('addBuildExercise, removeBuildExercise and setBuildName change the page', async () => {
    const { store, assistant } = setup();
    typeDraft(TEXT);
    await previewRow('Pull Ups');

    assistant('addBuildExercise', { exerciseName: 'Bent Over Row', sets: 4, reps: 8 }, 'a');
    expect(await previewRow('Barbell Bent Over Row')).toBeTruthy();

    assistant('removeBuildExercise', { exerciseName: 'Pull Ups' }, 'b');
    await waitFor(() => expect(screen.queryByText('Pull Ups', { selector: 'span' })).toBeNull());

    assistant('setBuildName', { name: 'Back day' }, 'c');
    await waitFor(() => expect((screen.getByPlaceholderText('Push day, pull day, legs') as HTMLInputElement).value).toBe('Back day'));
    await waitFor(() => expect(store.getState().ai.screen?.summary).toContain('Draft "Back day"'));
    expect(store.getState().ai.buildDraft).toEqual({ name: 'Back day', text: '3x8 Barbell Bench Press @135lbs\n4x8 Barbell Bent Over Row' });
  });

  it('keeps Visual-tab superset pairings in the draft the assistant reads and edits', async () => {
    const { store, assistant } = setup();
    typeDraft(TEXT);
    await previewRow('Pull Ups');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /visual/i }));
    fireEvent.click(screen.getByRole('tab', { name: /visual/i }));
    const toggles = await screen.findAllByLabelText('Toggle superset', undefined, { timeout: 4000 });
    fireEvent.click(toggles[0]);
    fireEvent.click((await screen.findAllByLabelText('Toggle superset'))[1]);
    await waitFor(() =>
      expect(store.getState().ai.buildDraft?.text).toBe('3x8 Barbell Bench Press @135lbs ss 4x10 Pull Ups'));
    const data = store.getState().ai.screen?.data as { exercises: { name: string; superset?: boolean }[] };
    expect(data.exercises.map((e) => [e.name, e.superset])).toEqual([['Barbell Bench Press', true], ['Pull Ups', true]]);

    // An edit tool re-parses the draft text: the pairing must survive it.
    const plan = planToolCall(
      { id: 'c1', name: 'setBuildName', input: { name: 'Push' } },
      { activeWorkout: null, trackedLifts: [], library, buildDraft: store.getState().ai.buildDraft },
    );
    if (plan.kind !== 'auto') throw new Error(plan.kind);
    act(() => plan.apply.forEach((a) => store.dispatch(a)));
    await waitFor(() => expect(store.getState().ai.screen?.summary).toContain('Draft "Push"'));
    expect(store.getState().ai.buildDraft?.text).toBe('3x8 Barbell Bench Press @135lbs ss 4x10 Pull Ups');
    expect(assistant).toBeTypeOf('function');
  });

  it('refuses an edit for an exercise that is not in the draft and leaves the page alone', async () => {
    const { store } = setup();
    typeDraft(TEXT);
    await previewRow('Pull Ups');
    const plan = planToolCall(
      { id: 'c9', name: 'editBuildExercise', input: { exerciseName: 'Deadlift', sets: 3 } },
      { activeWorkout: null, trackedLifts: [], library, buildDraft: store.getState().ai.buildDraft },
    );
    expect(plan).toEqual({ kind: 'rejected', id: 'c9', reason: '"Deadlift" is not in the Build draft.' });
    expect(store.getState().ai.buildDraft?.text).toBe(TEXT);
  });
});
