import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import workout, { startWorkout, completeSet, startRestTimer, endWorkout } from '../../store/slices/workoutSlice';
import trackedLifts, { trackedLiftsHydrated, liftUpdated } from '../../store/slices/trackedLiftsSlice';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import customExercise from '../../store/slices/customExerciseSlice';
import user from '../../store/slices/userSlice';
import ai, { askAiOpened, askAiClosed } from '../../store/slices/aiSlice';
import * as aiClient from '../../ai/aiClient';
import type { AiContext } from '../../ai/context';
import type { WorkoutExercise, Exercise } from '../../types/exercise';
import type { TrackedLift } from '../../types/trackedLifts';
import { AskAiHost } from './AskAiHost';

const bench = { id: 'x-bench', name: 'Barbell Bench Press', equipment: 'Barbell', muscleGroups: ['Chest', 'Triceps'] } as Exercise;
const dbBench = { id: 'x-db', name: 'Dumbbell Bench Press', equipment: 'Dumbbells', muscleGroups: ['Chest', 'Triceps'] } as Exercise;

function makeStore() {
  return configureStore({ reducer: { workout, trackedLifts, exercise, customExercise, user, ai } });
}

/** Saved custom exercises, as the loader thunk delivers them. */
function addCustom(store: ReturnType<typeof makeStore>, ...names: string[]) {
  store.dispatch({
    type: 'customExercise/loadCustomExercises/fulfilled',
    payload: {
      exercises: names.map((name, k) => ({
        id: `c${k}`, name, muscleGroup: 'Chest', equipment: 'Machine', createdAt: new Date(0), updatedAt: new Date(0),
      })),
      lastSynced: '',
    },
  });
}

async function send(text: string) {
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: 'Ask AI' }));
  await u.type(screen.getByLabelText('Message'), text);
  await u.click(screen.getByRole('button', { name: 'Send' }));
  return u;
}

function makeStoreWithWorkoutAndLift(tracked = false) {
  const store = makeStore();
  const e1 = {
    id: 'e1',
    exercise: bench,
    sets: [0, 1, 2, 3].map((k) => ({ id: `s${k}`, reps: 3, weight: 225, unit: 'lbs', completed: false })),
    ...(tracked ? { tracked: { liftId: 'l1', goal: 'strength' } } : {}),
  } as WorkoutExercise;
  const lift: TrackedLift = {
    id: 'l1', name: 'Bench Press', category: 'Push',
    load: { kind: 'weight', value: 265, unit: 'lb' }, target: { kind: 'repMax', reps: 1 },
  };
  store.dispatch(setExercises([bench, dbBench]));
  store.dispatch(startWorkout({ name: 'Push', exercises: [e1] }));
  store.dispatch(completeSet({ exerciseIndex: 0, setIndex: 0, setData: {} }));
  store.dispatch(completeSet({ exerciseIndex: 0, setIndex: 1, setData: {} }));
  store.dispatch(trackedLiftsHydrated({ categories: ['Push'], lifts: [lift] }));
  return store;
}

function renderHost(store = makeStoreWithWorkoutAndLift(), path = '/') {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <AskAiHost />
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

const reply = (text: string) => ({ reply: text, toolCalls: [], source: 'backend' as const });

beforeEach(() => {
  vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
  vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('AskAiHost', () => {
  it('auto-applies adjustSet with undo and shows confirm cards for benchmarks', async () => {
    const chat = vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Drop the last two sets.',
      source: 'backend',
      toolCalls: [
        { id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'missed' } },
        { id: 't2', name: 'updateBenchmark', input: { liftId: 'l1', loadKind: 'weight', weight: 255, unit: 'lb', targetKind: 'repMax', reps: 1, reason: 'three misses' } },
      ],
    });
    const store = renderHost();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'missed a rep');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    // The Undo toast and the chat's applied notice both say what changed.
    expect(await screen.findByRole('status')).toHaveTextContent(/remaining sets at 205 lb/);
    expect(screen.getByRole('log')).toHaveTextContent(/remaining sets at 205 lb/);
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{ role: 'user', content: 'missed a rep' }],
      context: expect.objectContaining({ screen: 'workout', units: 'lbs' }),
    }));
    expect(store.getState().workout.activeWorkout!.exercises[0].sets[2].weight).toBe(205);
    await u.click(screen.getByRole('button', { name: 'Undo' }));
    expect(store.getState().workout.activeWorkout!.exercises[0].sets[2].weight).toBe(225);
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    expect(store.getState().trackedLifts.lifts[0].load).toEqual({ kind: 'weight', value: 255, unit: 'lb' });
  });

  it('shows a discarded notice for a rejected tool call', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: '', source: 'backend',
      toolCalls: [{ id: 't9', name: 'logSet', input: { exerciseId: 'nope', reps: 3 } }],
    });
    renderHost();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'log it');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Suggestion discarded: That exercise is not in this workout.')).toBeInTheDocument();
  });

  it('hides the button once the backend says not allowed', async () => {
    vi.spyOn(aiClient, 'chat').mockRejectedValue(new aiClient.AiBackendError('x', 'not-allowed'));
    const store = renderHost();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'hi');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText("AI isn't enabled for this account.")).toBeInTheDocument();
    expect(store.getState().ai.disabledReason).toBe('not-allowed');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Ask AI', hidden: true })).not.toBeInTheDocument(),
    );
  });

  it('says unconfigured plainly and disables AI', async () => {
    vi.spyOn(aiClient, 'chat').mockRejectedValue(new aiClient.AiBackendError('x', 'unconfigured'));
    const store = renderHost();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'hi');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText("AI isn't set up yet.")).toBeInTheDocument();
    expect(store.getState().ai.disabledReason).toBe('unconfigured');
  });

  it('stays off the workout route, where the player has its own entry', () => {
    renderHost(makeStoreWithWorkoutAndLift(), '/workout');
    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('hides the button while an Undo toast shows', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: '', source: 'backend',
      toolCalls: [{ id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'missed' } }],
    });
    renderHost();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'missed');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('status');
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/205 lb/);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument());
  });

  it('re-plans a late Apply and says why it no longer applies', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Try dumbbells.', source: 'backend',
      toolCalls: [{ id: 't5', name: 'swapExercise', input: { exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'ongoing', reason: 'shoulder' } }],
    });
    const store = renderHost(makeStoreWithWorkoutAndLift(true));
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'shoulder hurts');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Apply' });
    act(() => {
      store.dispatch(endWorkout());
    });
    const before = store.getState().trackedLifts;
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText("Couldn't apply: That exercise is not in this workout.")).toBeInTheDocument();
    expect(store.getState().trackedLifts).toBe(before);
  });

  it('refuses a late Apply whose re-plan would do something else', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Lower it.', source: 'backend',
      // No unit: the lift's own. If that unit changes before Apply, so do the actions.
      toolCalls: [{ id: 't6', name: 'updateBenchmark', input: { liftId: 'l1', loadKind: 'weight', weight: 255, targetKind: 'repMax', reps: 1, reason: 'misses' } }],
    });
    const store = renderHost();
    const u = await send('too heavy');
    await screen.findByRole('button', { name: 'Apply' });
    act(() => {
      store.dispatch(liftUpdated({ id: 'l1', load: { kind: 'weight', value: 120, unit: 'kg' } }));
    });
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText("Couldn't apply: things changed since this was suggested.")).toBeInTheDocument();
    expect(store.getState().trackedLifts.lifts[0].load).toEqual({ kind: 'weight', value: 120, unit: 'kg' });
  });

  it('still applies a proposal when only a name it does not change was edited', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Lower it.', source: 'backend',
      toolCalls: [{ id: 't6', name: 'updateBenchmark', input: { liftId: 'l1', loadKind: 'weight', weight: 255, unit: 'lb', targetKind: 'repMax', reps: 1, reason: 'misses' } }],
    });
    const store = renderHost();
    const u = await send('too heavy');
    await screen.findByRole('button', { name: 'Apply' });
    act(() => {
      store.dispatch(liftUpdated({ id: 'l1', name: 'Paused Bench' }));
    });
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    expect(store.getState().trackedLifts.lifts[0]).toMatchObject({ name: 'Paused Bench', load: { kind: 'weight', value: 255, unit: 'lb' } });
  });

  it('applies an ongoing swap and its benchmark from the same turn, and drops the "benchmark stays" note', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Switch to dumbbells.', source: 'backend',
      toolCalls: [
        { id: 'sw', name: 'swapExercise', input: { exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'ongoing', weight: 80, reason: 'Shoulder.' } },
        { id: 'bm', name: 'updateBenchmark', input: { liftId: 'l1', loadKind: 'weight', weight: 90, unit: 'lb', targetKind: 'reps', reps: 8, reason: 'New movement.' } },
      ],
    });
    const store = renderHost(makeStoreWithWorkoutAndLift(true));
    const u = await send('shoulder');
    const swapCard = await screen.findByRole('group', { name: /Swap Barbell Bench Press for Dumbbell Bench Press/ });
    expect(swapCard).toHaveTextContent('Shoulder.');
    expect(swapCard).not.toHaveTextContent(/Benchmark stays/);
    await u.click(within(swapCard).getByRole('button', { name: 'Apply' }));
    const benchCard = screen.getByRole('group', { name: /benchmark/ });
    await u.click(within(benchCard).getByRole('button', { name: 'Apply' }));
    expect(screen.queryByText(/Couldn't apply/)).not.toBeInTheDocument();
    expect(store.getState().workout.activeWorkout!.exercises[0].exercise.name).toBe('Dumbbell Bench Press');
    expect(store.getState().trackedLifts.lifts[0]).toMatchObject({
      name: 'Dumbbell Bench Press', load: { kind: 'weight', value: 90, unit: 'lb' },
    });
  });

  it('refuses a late swap whose set patches changed because a set was logged', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Try dumbbells.', source: 'backend',
      toolCalls: [{ id: 'sw', name: 'swapExercise', input: { exerciseId: 'e1', replacementExerciseName: 'Dumbbell Bench Press', scope: 'today', weight: 80, reason: 'x' } }],
    });
    const store = renderHost();
    const u = await send('no bench');
    await screen.findByRole('button', { name: 'Apply' });
    act(() => {
      store.dispatch(completeSet({ exerciseIndex: 0, setIndex: 2, setData: {} }));
    });
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText("Couldn't apply: things changed since this was suggested.")).toBeInTheDocument();
    expect(store.getState().workout.activeWorkout!.exercises[0].exercise.name).toBe('Barbell Bench Press');
  });

  it('says the limit plainly and disables AI', async () => {
    vi.spyOn(aiClient, 'chat').mockRejectedValue(new aiClient.AiBackendError('x', 'limit'));
    const store = renderHost();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    await u.type(screen.getByLabelText('Message'), 'hi');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('AI limit reached for today.')).toBeInTheDocument();
    expect(store.getState().ai.disabledReason).toBe('limit');
  });

  it('hides the button while the rest timer runs', () => {
    const store = makeStoreWithWorkoutAndLift();
    store.dispatch(startRestTimer({ duration: 90 }));
    renderHost(store);
    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('hides the button when signed out', () => {
    vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(false);
    renderHost();
    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('hides the button without a backend', () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(false);
    renderHost();
    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('sends the seed again when reopened with a new one', async () => {
    const chat = vi.spyOn(aiClient, 'chat').mockResolvedValue(reply('ok'));
    const store = makeStore();
    store.dispatch(setExercises([bench]));
    renderHost(store, '/build');
    act(() => {
      store.dispatch(askAiOpened({ seed: 'seed A' }));
    });
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    expect(chat.mock.calls[0][0]).toMatchObject({
      messages: [{ role: 'user', content: 'seed A' }],
      context: { screen: 'build' },
    });
    act(() => {
      store.dispatch(askAiClosed());
    });
    act(() => {
      store.dispatch(askAiOpened({ seed: 'seed B' }));
    });
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    expect(chat.mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'seed B' }]);
  });
});
