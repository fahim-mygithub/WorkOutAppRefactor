import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import workout, { startWorkout, completeSet, startRestTimer, endWorkout } from '../../store/slices/workoutSlice';
import trackedLifts, { trackedLiftsHydrated, liftUpdated } from '../../store/slices/trackedLiftsSlice';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import customExercise from '../../store/slices/customExerciseSlice';
import user from '../../store/slices/userSlice';
import ai, { askAiOpened, askAiClosed, aiChatRestored, buildDraftChanged } from '../../store/slices/aiSlice';
import * as aiClient from '../../ai/aiClient';
import type { AiContext } from '../../ai/context';
import type { WorkoutExercise, Exercise } from '../../types/exercise';
import type { TrackedLift } from '../../types/trackedLifts';
import { AskAiHost } from './AskAiHost';
import { setProfile } from '../../store/slices/userSlice';
import plannedWorkouts from '../../store/slices/plannedWorkoutsSlice';
import { appServices } from '../../ai/appServices';

vi.mock('../../ai/appServices', () => ({
  appServices: {
    saveWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    saveProfile: vi.fn(),
    listSavedWorkouts: vi.fn(),
    history: {
      log: vi.fn(),
      undoLog: vi.fn(),
      edit: vi.fn(),
      undoEdit: vi.fn(),
    },
  },
}));

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

  it('applies a late swap to the sets still open, after another set was logged', async () => {
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
    expect(screen.queryByText(/Couldn't apply/)).not.toBeInTheDocument();
    const ex = store.getState().workout.activeWorkout!.exercises[0];
    expect(ex.exercise.name).toBe('Dumbbell Bench Press');
    expect(ex.sets.map((s) => [s.weight, s.completed])).toEqual([[225, true], [225, true], [225, true], [80, false]]);
  });

  it('applies a new tracked lift card', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Track it.', source: 'backend',
      toolCalls: [{ id: 'n1', name: 'addTrackedLift', input: { name: 'Squat', category: 'Legs', loadKind: 'weight', weight: 315, unit: 'lb', targetKind: 'repMax', reps: 1 } }],
    });
    const store = renderHost();
    const u = await send('track my squat');
    await u.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(screen.queryByText(/Couldn't apply/)).not.toBeInTheDocument();
    expect(store.getState().trackedLifts.lifts.map((l) => l.name)).toEqual(['Bench Press', 'Squat']);
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

  it('sends the seed again when reopened with a new one, after the kept conversation', async () => {
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
      context: { screen: 'build', tab: 'build' },
    });
    await waitFor(() => expect(store.getState().ai.chat.messages).toHaveLength(2));
    act(() => {
      store.dispatch(askAiClosed());
    });
    act(() => {
      store.dispatch(askAiOpened({ seed: 'seed B' }));
    });
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    expect(chat.mock.calls[1][0].messages).toEqual([
      { role: 'user', content: 'seed A' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'seed B' },
    ]);
  });

  it('keeps the conversation when the sheet closes, and New chat clears it', async () => {
    const chat = vi.spyOn(aiClient, 'chat').mockResolvedValue(reply('Bench day it is.'));
    const store = renderHost(makeStoreWithWorkoutAndLift(), '/');
    const u = await send('what should I train?');
    const log = screen.getByRole('log');
    expect(await within(log).findByText('Bench day it is.')).toBeInTheDocument();
    act(() => {
      store.dispatch(askAiClosed());
    });
    await u.click(await screen.findByRole('button', { name: 'Ask AI' }));
    expect(within(screen.getByRole('log')).getByText('what should I train?')).toBeInTheDocument();
    expect(within(screen.getByRole('log')).getByText('Bench day it is.')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'New chat' }));
    expect(within(screen.getByRole('log')).queryByText('what should I train?')).not.toBeInTheDocument();
    expect(within(screen.getByRole('log')).queryByText('Bench day it is.')).not.toBeInTheDocument();
    expect(store.getState().ai.chat.messages).toEqual([]);

    // The next message starts a fresh history.
    await u.type(screen.getByLabelText('Message'), 'hi again');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    expect(chat.mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'hi again' }]);
  });

  it('drops a reply that arrives after New chat', async () => {
    let answer!: (v: ReturnType<typeof reply>) => void;
    vi.spyOn(aiClient, 'chat').mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    const store = renderHost(makeStoreWithWorkoutAndLift(), '/');
    const u = await send('slow question');
    expect(await screen.findByTestId('ai-pending')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'New chat' }));
    await act(async () => {
      answer(reply('late answer'));
    });
    expect(screen.queryByText('late answer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-pending')).not.toBeInTheDocument();
    expect(store.getState().ai.chat.messages).toEqual([]);
  });
});

describe('AskAiHost — build, plan and profile tools', () => {
  function signedInStore() {
    const store = configureStore({ reducer: { workout, trackedLifts, exercise, customExercise, user, ai, plannedWorkouts } });
    store.dispatch(setExercises([bench]));
    store.dispatch(setProfile({ uid: 'u1', email: 'a@b.c', displayName: 'Alex', createdAt: '', lastActiveAt: '' }));
    return store;
  }
  const svc = vi.mocked(appServices);

  beforeEach(() => {
    svc.listSavedWorkouts.mockResolvedValue([
      { id: 'w1', name: 'Push', workoutText: '3x8 Barbell Bench Press', parsedWorkout: { exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 8 }] }], supersets: [] } },
    ]);
    svc.saveWorkout.mockResolvedValue('new1');
    svc.deleteWorkout.mockResolvedValue();
  });

  it('sends saved workouts, profile and today as context', async () => {
    const chat = vi.spyOn(aiClient, 'chat').mockResolvedValue(reply('ok'));
    renderHost(signedInStore(), '/build');
    await send('rename my push day');
    await screen.findByText('ok');
    const context = chat.mock.calls[0][0].context as AiContext;
    expect(svc.listSavedWorkouts).toHaveBeenCalledWith('u1');
    expect(context.savedWorkouts).toBeUndefined();
    expect(context.profile).toMatchObject({ displayName: 'Alex', weightUnit: 'lbs' });
    expect(context.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('saves a created workout only on Apply, and Undo deletes it', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Here you go.', source: 'backend',
      toolCalls: [{ id: 'cw', name: 'createWorkout', input: { workouts: [{ name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: 8 }] }] } }],
    });
    renderHost(signedInStore(), '/build');
    const u = await send('make me a push day');
    const apply = await screen.findByRole('button', { name: 'Apply' });
    expect(svc.saveWorkout).not.toHaveBeenCalled();
    await u.click(apply);
    await waitFor(() => expect(svc.saveWorkout).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Push' })));
    await u.click((await screen.findAllByRole('button', { name: 'Undo' }))[0]);
    await waitFor(() => expect(svc.deleteWorkout).toHaveBeenCalledWith('u1', 'new1'));
  });

  it('plans a workout through planAdded on Apply, and Undo removes it', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: '', source: 'backend',
      toolCalls: [{ id: 'pw', name: 'planWorkout', input: { dateKey: '2099-01-05', name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: 8 }] } }],
    });
    const store = signedInStore();
    renderHost(store, '/build');
    const u = await send('plan push');
    await u.click(await screen.findByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(store.getState().plannedWorkouts.plans).toHaveLength(1));
    await u.click((await screen.findAllByRole('button', { name: 'Undo' }))[0]);
    await waitFor(() => expect(store.getState().plannedWorkouts.plans).toHaveLength(0));
  });

  it('keeps the card open and says so when the save fails', async () => {
    svc.saveWorkout.mockRejectedValue(new Error('offline'));
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: '', source: 'backend',
      toolCalls: [{ id: 'cw2', name: 'createWorkout', input: { workouts: [{ name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: 8 }] }] } }],
    });
    renderHost(signedInStore(), '/build');
    const u = await send('make me a push day');
    await u.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(await screen.findByTestId('ai-error')).toHaveTextContent("Couldn't save");
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });
  it("Undo remains clickable after a second message is sent and after the toast timeout, and still calls the history undo", async () => {
    let toastTimeoutFn: (() => void) | undefined;
    const origSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any, ms: any) => {
      if (ms === 8000) {
        toastTimeoutFn = fn;
        return 9999 as any;
      }
      return origSetTimeout(fn, ms);
    });

    const historyLog = vi.fn().mockResolvedValue({ workoutId: "w-ai-1", exerciseIds: ["ex-ai-1"] });
    const historyUndoLog = vi.fn().mockResolvedValue(undefined);
    svc.history = {
      log: historyLog,
      undoLog: historyUndoLog,
      edit: vi.fn(),
      undoEdit: vi.fn(),
    };
    vi.spyOn(aiClient, "chat")
      .mockResolvedValueOnce({
        reply: "Logged it for you.",
        source: "backend",
        toolCalls: [{
          id: "call-log-1",
          name: "logPastWorkout",
          input: {
            date: "2026-10-30",
            name: "Chest Session",
            exercises: [{ name: "Barbell Bench Press", sets: [{ reps: 5, weight: 135 }] }],
          },
        }],
      })
      .mockResolvedValueOnce({
        reply: "Second turn response.",
        source: "backend",
        toolCalls: [],
      });

    const store = signedInStore();
    renderHost(store, "/build");
    const u = await send("log yesterday bench 5 at 135");

    // 1. Proposal card rendered with Apply button
    const applyBtn = await screen.findByRole("button", { name: "Apply" });
    await u.click(applyBtn);

    // Verify log was called
    await waitFor(() => expect(historyLog).toHaveBeenCalledTimes(1));

    // 2. User sends a second chat message
    await u.type(screen.getByLabelText("Message"), "what should I do next?");
    await u.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Second turn response.")).toBeInTheDocument();

    // 3. Fast-forward past the toast timeout (8 seconds)
    expect(toastTimeoutFn).toBeDefined();
    act(() => {
      toastTimeoutFn?.();
    });

    // Verify the toast is gone
    await waitFor(() => expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument());

    // 4. The Undo button on the card remains clickable!
    const cardUndo = screen.getByRole("button", { name: /undo/i });
    expect(cardUndo).toBeInTheDocument();
    await u.click(cardUndo);

    // 5. It still calls the history undo!
    await waitFor(() => expect(historyUndoLog).toHaveBeenCalledWith("w-ai-1", ["ex-ai-1"]));
  });

  it('restores applied decision and keeps session undo entry when undo fails', async () => {
    const historyLog = vi.fn().mockResolvedValue({ workoutId: 'w-ai-2', exerciseIds: ['ex-ai-2'] });
    const historyUndoLog = vi.fn().mockRejectedValueOnce(new Error('undo network error')).mockResolvedValueOnce(undefined);
    svc.history = {
      log: historyLog,
      undoLog: historyUndoLog,
      edit: vi.fn(),
      undoEdit: vi.fn(),
    };
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Logged it.',
      source: 'backend',
      toolCalls: [{
        id: 'call-log-fail',
        name: 'logPastWorkout',
        input: {
          date: '2026-10-30',
          name: 'Push',
          exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 135 }] }],
        },
      }],
    });

    const store = signedInStore();
    renderHost(store, '/build');
    const u = await send('log bench');

    await u.click(await screen.findByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(historyLog).toHaveBeenCalledTimes(1));

    // First undo attempt fails
    const undos = await screen.findAllByRole('button', { name: 'Undo' });
    await u.click(undos[0]);

    // Error displayed, decision restored to applied, Undo button still present
    expect(await screen.findByText("Couldn't undo — try again.")).toBeInTheDocument();
    expect(await screen.findByText('Applied')).toBeInTheDocument();
    const undosAfter = await screen.findAllByRole('button', { name: 'Undo' });
    expect(undosAfter.length).toBeGreaterThan(0);

    // Second undo attempt succeeds
    await u.click(undosAfter[0]);
    await waitFor(() => expect(historyUndoLog).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Undone')).toBeInTheDocument();
  });

  it("a failed take-back from the toast's Undo is reported to the card like the card's own Undo", async () => {
    const historyLog = vi.fn().mockResolvedValue({ workoutId: 'w-ai-3', exerciseIds: ['ex-ai-3'] });
    const historyUndoLog = vi.fn().mockRejectedValueOnce(new Error('undo network error')).mockResolvedValueOnce(undefined);
    svc.history = { log: historyLog, undoLog: historyUndoLog, edit: vi.fn(), undoEdit: vi.fn() };
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Logged it.',
      source: 'backend',
      toolCalls: [{
        id: 'call-log-toast-fail',
        name: 'logPastWorkout',
        input: {
          date: '2026-10-30',
          name: 'Push',
          exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 135 }] }],
        },
      }],
    });

    const store = signedInStore();
    renderHost(store, '/build');
    const u = await send('log bench');
    await u.click(await screen.findByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(historyLog).toHaveBeenCalledTimes(1));

    // First take-back, from the toast, fails: the card must say Applied again with its Undo.
    const toast = await screen.findByTestId('undo-toast');
    await u.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(historyUndoLog).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Applied')).toBeInTheDocument();
    expect(screen.queryByText('Undone')).not.toBeInTheDocument();

    // And it can be undone again (toast re-queued or the card's Undo).
    const again = await screen.findAllByRole('button', { name: 'Undo' });
    await u.click(again[0]);
    await waitFor(() => expect(historyUndoLog).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Undone')).toBeInTheDocument();
  });

  it('logging a workout and then editing it replaces the log Undo with the edit Undo on the same workout', async () => {
    const historyLog = vi.fn().mockResolvedValue({ workoutId: 'w-ai-10', exerciseIds: ['ex-ai-10'] });
    const historyEdit = vi.fn().mockResolvedValue({ prior: { name: 'Push', date: '2026-10-30', exercises: [] } });
    const historyUndoEdit = vi.fn().mockResolvedValue(undefined);
    const historyUndoLog = vi.fn().mockResolvedValue(undefined);
    svc.history = {
      log: historyLog,
      undoLog: historyUndoLog,
      edit: historyEdit,
      undoEdit: historyUndoEdit,
    };

    // First turn: log workout
    vi.spyOn(aiClient, 'chat')
      .mockResolvedValueOnce({
        reply: 'Logged Push workout.',
        source: 'backend',
        toolCalls: [{
          id: 'call-log-1',
          name: 'logPastWorkout',
          input: {
            date: '2026-10-30',
            name: 'Push',
            exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 135 }] }],
          },
        }],
      })
      // Second turn: edit that same workout
      .mockResolvedValueOnce({
        reply: 'Updated weight to 145.',
        source: 'backend',
        toolCalls: [{
          id: 'call-edit-1',
          name: 'editPastWorkout',
          input: {
            workoutId: 'w-ai-10',
            name: 'Push',
            exercises: [{ name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 145 }] }],
          },
        }],
      });

    const store = signedInStore();
    renderHost(store, '/build');
    const u = await send('log bench 135');

    // Apply the log proposal
    const applyButtons = await screen.findAllByRole('button', { name: 'Apply' });
    await u.click(applyButtons[0]);
    await waitFor(() => expect(historyLog).toHaveBeenCalledTimes(1));

    // Check the proposal cards
    let cards = await screen.findAllByTestId('apply-reject-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    // Send second message to trigger edit on the same workout
    await u.type(screen.getByLabelText('Message'), 'change weight to 145');
    await u.click(screen.getByRole('button', { name: 'Send' }));

    // Apply the edit proposal
    cards = await screen.findAllByTestId('apply-reject-card');
    expect(cards).toHaveLength(2);
    const editApplyBtn = within(cards[1]).getByRole('button', { name: 'Apply' });
    await u.click(editApplyBtn);
    await waitFor(() => expect(historyEdit).toHaveBeenCalledTimes(1));

    // The 'a later Apply on the same record replaces the Undo' rule:
    // The first card (log) no longer has an Undo button!
    expect(within(cards[0]).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    // The second card (edit) DOES have an Undo button!
    const editUndoBtn = within(cards[1]).getByRole('button', { name: 'Undo' });
    expect(editUndoBtn).toBeInTheDocument();

    // Clicking Undo on the edit card undoes the edit, NOT the log!
    await u.click(editUndoBtn);
    await waitFor(() => expect(historyUndoEdit).toHaveBeenCalledWith('w-ai-10', expect.anything()));
    expect(historyUndoLog).not.toHaveBeenCalled();
  });

  it('plans on different records do not cancel each others Undo', async () => {
    svc.history = {
      log: vi.fn(),
      undoLog: vi.fn(),
      edit: vi.fn(),
      undoEdit: vi.fn(),
    };

    // First turn: plan workout for date 2099-11-01
    vi.spyOn(aiClient, 'chat')
      .mockResolvedValueOnce({
        reply: 'Planned workout 1.',
        source: 'backend',
        toolCalls: [{
          id: 'call-plan-1',
          name: 'planWorkout',
          input: {
            dateKey: '2099-11-01',
            name: 'Push Day',
            exercises: [{ name: 'Barbell Bench Press', sets: 3, reps: 5 }],
          },
        }],
      })
      // Second turn: plan workout for date 2099-11-02 (different record/date)
      .mockResolvedValueOnce({
        reply: 'Planned workout 2.',
        source: 'backend',
        toolCalls: [{
          id: 'call-plan-2',
          name: 'planWorkout',
          input: {
            dateKey: '2099-11-02',
            name: 'Pull Day',
            exercises: [{ name: 'Barbell Row', sets: 3, reps: 8 }],
          },
        }],
      });

    const store = signedInStore();
    renderHost(store, '/build');
    const u = await send('plan push on nov 1');

    // Apply the first plan
    const apply1 = await screen.findByRole('button', { name: 'Apply' });
    await u.click(apply1);

    // First card has Undo
    let cards = await screen.findAllByTestId('apply-reject-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    // Send second plan message
    await u.type(screen.getByLabelText('Message'), 'plan pull on nov 2');
    await u.click(screen.getByRole('button', { name: 'Send' }));

    // Apply the second plan
    cards = await screen.findAllByTestId('apply-reject-card');
    expect(cards).toHaveLength(2);
    const apply2 = within(cards[1]).getByRole('button', { name: 'Apply' });
    await u.click(apply2);

    // Both cards still have their Undo buttons! (No over-invalidation across different records)
    expect(within(cards[0]).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(within(cards[1]).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});

describe('AskAiHost — app control', () => {
  const svc = vi.mocked(appServices);
  const pushSaved = {
    id: 'w-push', name: 'Push', workoutText: '3x8 Barbell Bench Press @135',
    parsedWorkout: { exercises: [{ name: 'Barbell Bench Press', sets: [0, 1, 2].map(() => ({ reps: 8, weight: 135, unit: 'lbs' as const })) }], supersets: [] },
  };

  function appStore() {
    const store = configureStore({ reducer: { workout, trackedLifts, exercise, customExercise, user, ai, plannedWorkouts } });
    store.dispatch(setExercises([bench]));
    store.dispatch(setProfile({ uid: 'u1', email: 'a@b.c', displayName: 'Alex', createdAt: '', lastActiveAt: '' }));
    return store;
  }

  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }

  function renderApp(store: ReturnType<typeof appStore>, path = '/') {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Where />
          <AskAiHost />
        </MemoryRouter>
      </Provider>,
    );
    return store;
  }

  beforeEach(() => {
    svc.listSavedWorkouts.mockResolvedValue([pushSaved]);
  });

  it('an applied startWorkout opens the player on /workout with the weight the lifter named', async () => {
    const chat = vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: 'Loading Push with 185 on bench.', source: 'backend',
      toolCalls: [{ id: 'st1', name: 'startWorkout', input: { workoutId: 'w-push', overrides: [{ exerciseName: 'Barbell Bench Press', weight: 185 }] } }],
    });
    const store = renderApp(appStore(), '/');
    const u = await send('load my push day with 185 on bench');
    const card = await screen.findByTestId('apply-reject-card');
    expect(card).toHaveTextContent('Start "Push" (1 exercise)');
    expect(card).toHaveTextContent('Barbell Bench Press 3×8 @ 185 lb');
    expect(store.getState().workout.activeWorkout).toBeNull();
    expect(chat.mock.calls[0][0].context).toMatchObject({ tab: 'today' });

    await u.click(within(card).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/workout'));
    const active = store.getState().workout.activeWorkout!;
    expect(active.name).toBe('Push');
    expect(active.exercises[0].sets.map((s) => [s.reps, s.weight])).toEqual([[8, 185], [8, 185], [8, 185]]);
    expect(store.getState().ai.open).toBe(false);
    expect(store.getState().ai.chat.decisions.st1).toBe('applied');
  });

  it('refuses to start while a workout is in progress', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: '', source: 'backend', toolCalls: [{ id: 'st2', name: 'startWorkout', input: { workoutId: 'w-push' } }],
    });
    const store = appStore();
    store.dispatch(startWorkout({ name: 'Legs', exercises: [] }));
    renderApp(store, '/');
    await send('start push');
    expect(await screen.findByText(/"Legs" is still in progress\. End or finish it first\./)).toBeInTheDocument();
    expect(screen.queryByTestId('apply-reject-card')).not.toBeInTheDocument();
  });

  it('openTab switches tabs at once, and refuses the workout tab with no workout', async () => {
    vi.spyOn(aiClient, 'chat')
      .mockResolvedValueOnce({ reply: 'Here is Build.', source: 'backend', toolCalls: [{ id: 'ot1', name: 'openTab', input: { tab: 'build' } }] })
      .mockResolvedValueOnce({ reply: '', source: 'backend', toolCalls: [{ id: 'ot2', name: 'openTab', input: { tab: 'workout' } }] });
    renderApp(appStore(), '/');
    const u = await send('take me to build');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/build'));
    expect(screen.getByRole('log')).toHaveTextContent('Opened Build');
    // No Undo toast for a tab switch.
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    await u.type(screen.getByLabelText('Message'), 'open my workout');
    await u.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/No workout is in progress/)).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/build');
  });

  it('loadIntoBuild says it replaces the Build draft, and on Apply opens Build with the workout', async () => {
    vi.spyOn(aiClient, 'chat').mockResolvedValue({
      reply: '', source: 'backend', toolCalls: [{ id: 'lb1', name: 'loadIntoBuild', input: { workoutId: 'w-push' } }],
    });
    const store = appStore();
    store.dispatch(buildDraftChanged(true));
    renderApp(store, '/build/custom');
    const u = await send('put push day on build');
    const card = await screen.findByTestId('apply-reject-card');
    expect(card).toHaveTextContent('This replaces what is on the Build screen now.');
    act(() => {
      store.dispatch(buildDraftChanged(false));
    });
    // Applying loads the workout into Build; nothing is saved.
    await u.click(within(card).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(store.getState().ai.buildPreset?.name).toBe('Push'));
    expect(store.getState().ai.buildPreset?.workout.parsedWorkout).toEqual(pushSaved.parsedWorkout);
    expect(screen.getByTestId('where')).toHaveTextContent('/build/custom');
    expect(svc.saveWorkout).not.toHaveBeenCalled();
  });

  it('shows a card restored undecided as expired, not applyable', async () => {
    const store = appStore();
    store.dispatch(aiChatRestored({
      uid: 'u1',
      messages: [
        { id: 'm1', role: 'user', text: 'load push' },
        { id: 'm2', role: 'assistant', text: 'Ready.', proposals: [{ id: 'old1', tool: 'startWorkout', summary: 'Start "Push" (1 exercise)' }] },
      ],
    }));
    renderApp(store, '/');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask AI' }));
    const card = await screen.findByTestId('apply-reject-card');
    expect(card).toHaveAttribute('data-decision', 'expired');
    expect(within(card).queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(card).toHaveTextContent(/Expired/);
  });
});
