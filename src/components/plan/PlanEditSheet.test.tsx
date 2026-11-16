import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import userEvent from '@testing-library/user-event';
import workoutReducer from '../../store/slices/workoutSlice';
import trackedLiftsReducer from '../../store/slices/trackedLiftsSlice';
import customExerciseReducer from '../../store/slices/customExerciseSlice';
import plannedWorkoutsReducer, {
  planAdded,
  type PlannedWorkout,
} from '../../store/slices/plannedWorkoutsSlice';
import exerciseReducer, { setExercises } from '../../store/slices/exerciseSlice';
import userReducer from '../../store/slices/userSlice';
import aiReducer, { screenPublished } from '../../store/slices/aiSlice';
import { AskAiHost } from '../ai/AskAiHost';
import { PlanEditSheet } from './PlanEditSheet';
import { planToolCall, type PlanContext } from '../../ai/applyTool';
import type { AiToolCall } from '../../ai/types';
import * as aiClient from '../../ai/aiClient';
import { addDaysKey, toDateKey } from '../../lib/dateKey';
import type { Exercise } from '../../types/exercise';

const libraryExercises: Exercise[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    muscleGroups: ['Chest'],
    equipment: 'Barbell',
    videoLinks: [],
    instructions: [],
    difficulty: 'Intermediate',
    force: 'Push',
    grips: null,
    mechanic: 'Compound',
    searchKeywords: ['bench'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    muscleGroups: ['Back'],
    equipment: 'Cable',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: 'Pull',
    grips: null,
    mechanic: 'Compound',
    searchKeywords: ['pulldown', 'back'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    muscleGroup: 'Triceps',
    muscleGroups: ['Triceps'],
    equipment: 'Cable',
    videoLinks: [],
    instructions: [],
    difficulty: 'Beginner',
    force: 'Push',
    grips: null,
    mechanic: 'Isolation',
    searchKeywords: ['tricep'],
    createdAt: '',
    updatedAt: '',
  },
];

function setup(overrides?: Partial<PlannedWorkout>) {
  const today = toDateKey(new Date());
  const store = configureStore({
    reducer: {
      plannedWorkouts: plannedWorkoutsReducer,
      exercise: exerciseReducer,
      user: userReducer,
      ai: aiReducer,
    },
  });

  store.dispatch(setExercises(libraryExercises));

  const plan: PlannedWorkout = {
    id: 'plan-edit-1',
    dateKey: today,
    name: 'Upper Push',
    status: 'planned',
    createdAt: new Date().toISOString(),
    exercises: [
      {
        id: 'pe-1',
        exercise: libraryExercises[0],
        sets: [
          { id: 's-1', reps: 8, weight: 185, unit: 'lbs', completed: false },
          { id: 's-2', reps: 8, weight: 185, unit: 'lbs', completed: false },
          { id: 's-3', reps: 8, weight: 185, unit: 'lbs', completed: false },
        ],
        restTime: 120,
      },
      {
        id: 'pe-2',
        exercise: libraryExercises[2],
        sets: [
          { id: 's-4', reps: 12, weight: 50, unit: 'lbs', completed: false },
          { id: 's-5', reps: 12, weight: 50, unit: 'lbs', completed: false },
        ],
        restTime: 90,
      },
    ],
    ...overrides,
  };

  store.dispatch(planAdded(plan));
  const onOpenChange = vi.fn();

  const utils = render(
    <Provider store={store}>
      <PlanEditSheet plan={plan} open={true} onOpenChange={onOpenChange} />
    </Provider>,
  );

  return { ...utils, store, plan, onOpenChange };
}

describe('PlanEditSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists exercises with sets, reps, and weight and allows renaming and saving', () => {
    const { store, onOpenChange } = setup();

    const nameInput = screen.getByLabelText(/workout name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Upper Push');
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Tricep Pushdown')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Heavy Upper Push' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(updated?.name).toBe('Heavy Upper Push');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('edits an exercise sets, reps, and weight and persists on Save', () => {
    const { store } = setup();

    const setsInput = screen.getByLabelText(/sets for bench press/i) as HTMLInputElement;
    const repsInput = screen.getByLabelText(/reps for bench press/i) as HTMLInputElement;
    const weightInput = screen.getByLabelText(/weight for bench press/i) as HTMLInputElement;

    expect(setsInput.value).toBe('3');
    expect(repsInput.value).toBe('8');
    expect(weightInput.value).toBe('185');

    fireEvent.change(setsInput, { target: { value: '5' } });
    fireEvent.change(repsInput, { target: { value: '5' } });
    fireEvent.change(weightInput, { target: { value: '205' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    const bench = updated?.exercises[0];
    expect(bench?.sets).toHaveLength(5);
    expect(bench?.sets.every((s) => s.reps === 5 && s.weight === 205)).toBe(true);
  });

  it('removes an exercise and saves', () => {
    const { store } = setup();

    fireEvent.click(screen.getByRole('button', { name: /remove tricep pushdown/i }));
    expect(screen.queryByText('Tricep Pushdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(updated?.exercises.map((e) => e.exercise.name)).toEqual(['Bench Press']);
  });

  it('adds an exercise from the library via ExerciseQuickAdd and saves', () => {
    const { store } = setup();

    const searchInput = screen.getByLabelText(/add exercise/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Lat Pulldown' } });

    const option = screen.getByRole('button', { name: /lat pulldown/i });
    fireEvent.click(option);

    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const updated = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(updated?.exercises.map((e) => e.exercise.name)).toEqual([
      'Bench Press',
      'Tricep Pushdown',
      'Lat Pulldown',
    ]);
  });

  it('discards all changes when Cancel is clicked', () => {
    const { store, onOpenChange } = setup();

    const nameInput = screen.getByLabelText(/workout name/i);
    fireEvent.change(nameInput, { target: { value: 'Discarded Name' } });
    fireEvent.click(screen.getByRole('button', { name: /remove bench press/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const unchanged = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
    expect(unchanged?.name).toBe('Upper Push');
    expect(unchanged?.exercises).toHaveLength(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables Save when workout name is empty or whitespace', () => {
    setup();

    const nameInput = screen.getByLabelText(/workout name/i);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  describe('AI screen snapshot and assistant edit tools', () => {
    function runAssistant(
      store: ReturnType<typeof setup>['store'],
      name: AiToolCall['name'],
      input: Record<string, unknown>,
      id = 'c1',
    ) {
      const ctx: PlanContext = {
        activeWorkout: null,
        trackedLifts: [],
        library: libraryExercises,
        units: 'lbs',
        planDraft: store.getState().ai.planDraft,
      };
      const plan = planToolCall({ id, name, input }, ctx);
      if (plan.kind !== 'auto') {
        throw new Error(plan.kind === 'rejected' ? plan.reason : plan.kind);
      }
      act(() => {
        plan.apply.forEach((a) => store.dispatch(a));
      });
      return plan;
    }

    it('publishes a plan-editor snapshot with unsaved edits while open, and clears it when closed', async () => {
      const tomorrow = addDaysKey(toDateKey(new Date()), 1);
      const { store, plan, onOpenChange, rerender } = setup({ dateKey: tomorrow });

      await waitFor(() => {
        expect(store.getState().ai.screen).toMatchObject({
          tab: 'plan-edit',
          title: 'Plan editor',
          data: {
            planId: 'plan-edit-1',
            name: 'Upper Push',
            date: tomorrow,
            exercises: [
              { name: 'Bench Press', sets: 3, reps: 8, weight: 185, unit: 'lbs' },
              { name: 'Tricep Pushdown', sets: 2, reps: 12, weight: 50, unit: 'lbs' },
            ],
          },
        });
      });

      // Unsaved manual edits update the snapshot without mutating plannedWorkouts.
      fireEvent.change(screen.getByLabelText(/workout name/i), { target: { value: 'Heavy Push' } });
      fireEvent.change(screen.getByLabelText(/sets for bench press/i), { target: { value: '5' } });
      fireEvent.change(screen.getByLabelText(/weight for bench press/i), { target: { value: '205' } });

      await waitFor(() => {
        expect(store.getState().ai.screen?.data).toMatchObject({
          planId: 'plan-edit-1',
          name: 'Heavy Push',
          date: tomorrow,
          exercises: [
            { name: 'Bench Press', sets: 5, reps: 8, weight: 205, unit: 'lbs' },
            { name: 'Tricep Pushdown', sets: 2, reps: 12, weight: 50, unit: 'lbs' },
          ],
        });
      });
      expect(store.getState().plannedWorkouts.plans[0].name).toBe('Upper Push');

      // Closing the sheet clears the snapshot and draft.
      rerender(
        <Provider store={store}>
          <PlanEditSheet plan={plan} open={false} onOpenChange={onOpenChange} />
        </Provider>,
      );

      await waitFor(() => {
        expect(store.getState().ai.screen).toBeUndefined();
        expect(store.getState().ai.planDraft).toBeUndefined();
      });
    });

    it('restores Today snapshot when the sheet opens and closes over Today', async () => {
      const today = toDateKey(new Date());
      const { store, plan, onOpenChange, rerender } = setup({ dateKey: today });
      // Simulate Today having published before opening the modal.
      rerender(
        <Provider store={store}>
          <PlanEditSheet plan={plan} open={false} onOpenChange={onOpenChange} />
        </Provider>,
      );
      act(() => {
        store.dispatch(screenPublished({ tab: 'today', title: 'Today', summary: 'Today: Upper Push' }));
      });
      expect(store.getState().ai.screen?.tab).toBe('today');

      rerender(
        <Provider store={store}>
          <PlanEditSheet plan={plan} open={true} onOpenChange={onOpenChange} />
        </Provider>,
      );
      await waitFor(() => expect(store.getState().ai.screen?.tab).toBe('plan-edit'));

      rerender(
        <Provider store={store}>
          <PlanEditSheet plan={plan} open={false} onOpenChange={onOpenChange} />
        </Provider>,
      );
      await waitFor(() => expect(store.getState().ai.screen?.tab).toBe('today'));
    });

    it('caps a huge plan snapshot within 3,000 characters while keeping all exercises in planDraft', async () => {
      const manyExercises = Array.from({ length: 120 }, (_, idx) => ({
        id: `pe-many-${idx}`,
        exercise: {
          ...libraryExercises[0],
          id: `ex-many-${idx}`,
          name: `Barbell Bench Press Variation Number ${idx}`,
        },
        sets: [{ id: `s-many-${idx}`, reps: 8, weight: 135 + idx, unit: 'lbs' as const, completed: false }],
        restTime: 120,
      }));
      const { store } = setup({ exercises: manyExercises });

      await waitFor(() => expect(store.getState().ai.screen?.summary).toContain('120 exercises'));
      expect(JSON.stringify(store.getState().ai.screen).length).toBeLessThanOrEqual(3_000);
      expect(store.getState().ai.planDraft?.exercises).toHaveLength(120);
    });

    it('editPlanExercise changes visible sets, reps, and weight in the sheet, Undo restores, and Cancel discards it', async () => {
      const { store, plan, onOpenChange, rerender } = setup();
      await waitFor(() => expect(store.getState().ai.planDraft).toBeDefined());

      const setsInput = screen.getByLabelText(/sets for bench press/i) as HTMLInputElement;
      const repsInput = screen.getByLabelText(/reps for bench press/i) as HTMLInputElement;
      const weightInput = screen.getByLabelText(/weight for bench press/i) as HTMLInputElement;

      const applied = runAssistant(store, 'editPlanExercise', {
        exerciseName: 'Bench Press',
        sets: 5,
        reps: 5,
        weight: 205,
      });

      await waitFor(() => {
        expect(setsInput.value).toBe('5');
        expect(repsInput.value).toBe('5');
        expect(weightInput.value).toBe('205');
      });

      // Still unsaved in plannedWorkouts!
      const storedBeforeSave = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
      expect(storedBeforeSave?.exercises[0].sets).toHaveLength(3);
      expect(storedBeforeSave?.exercises[0].sets[0].weight).toBe(185);

      // Undo puts the visible fields back, then re-apply to test Cancel discarding.
      act(() => {
        applied.undo.forEach((a) => store.dispatch(a));
      });
      await waitFor(() => {
        expect(setsInput.value).toBe('3');
        expect(repsInput.value).toBe('8');
        expect(weightInput.value).toBe('185');
      });

      runAssistant(store, 'editPlanExercise', {
        exerciseName: 'Bench Press',
        sets: 4,
        reps: 6,
        weight: 195,
      }, 'c2');
      await waitFor(() => expect(weightInput.value).toBe('195'));

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);

      const afterCancel = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1');
      expect(afterCancel?.exercises[0].sets).toHaveLength(3);
      expect(afterCancel?.exercises[0].sets.every((s) => s.reps === 8 && s.weight === 185)).toBe(true);

      // Reopening the sheet after Cancel resets to the saved plan.
      rerender(
        <Provider store={store}>
          <PlanEditSheet plan={plan} open={false} onOpenChange={onOpenChange} />
        </Provider>,
      );
      rerender(
        <Provider store={store}>
          <PlanEditSheet plan={plan} open={true} onOpenChange={onOpenChange} />
        </Provider>,
      );
      expect((screen.getByLabelText(/weight for bench press/i) as HTMLInputElement).value).toBe('185');
    });

    it('editPlanExercise, setPlanName, addPlanExercise, and removePlanExercise persist when Save is clicked', async () => {
      const { store } = setup();
      await waitFor(() => expect(store.getState().ai.planDraft).toBeDefined());

      runAssistant(store, 'editPlanExercise', {
        exerciseName: 'Bench Press',
        sets: 4,
        reps: 6,
        weight: 100,
        unit: 'kg',
      }, 'a1');
      runAssistant(store, 'addPlanExercise', {
        exerciseName: 'Lat Pulldown',
        sets: 3,
        reps: 10,
        weight: 120,
      }, 'a2');
      runAssistant(store, 'removePlanExercise', {
        exerciseName: 'Tricep Pushdown',
      }, 'a3');
      runAssistant(store, 'setPlanName', {
        name: 'Push & Pull',
      }, 'a4');

      await waitFor(() => {
        expect((screen.getByLabelText(/workout name/i) as HTMLInputElement).value).toBe('Push & Pull');
        expect((screen.getByLabelText(/sets for bench press/i) as HTMLInputElement).value).toBe('4');
        expect((screen.getByLabelText(/reps for bench press/i) as HTMLInputElement).value).toBe('6');
        expect((screen.getByLabelText(/weight for bench press/i) as HTMLInputElement).value).toBe('100');
        expect(screen.getByText('Weight (kg)')).toBeInTheDocument();
        expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
        expect(screen.queryByText('Tricep Pushdown')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      const saved = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-edit-1')!;
      expect(saved.name).toBe('Push & Pull');
      expect(saved.exercises.map((e) => e.exercise.name)).toEqual(['Bench Press', 'Lat Pulldown']);
      expect(saved.exercises[0].sets).toHaveLength(4);
      expect(saved.exercises[0].sets.every((s) => s.reps === 6 && s.weight === 100 && s.unit === 'kg')).toBe(true);
      expect(saved.exercises[1].sets).toHaveLength(3);
      expect(saved.exercises[1].sets.every((s) => s.reps === 10 && s.weight === 120 && s.unit === 'lbs')).toBe(true);
    });

    it('offers an Ask AI button inside the modal when AI is available, opening the assistant', () => {
      const avail = vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
      const signed = vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
      try {
        const { store } = setup();
        const askBtn = screen.getByRole('button', { name: 'Ask AI' });
        fireEvent.click(askBtn);
        expect(store.getState().ai.open).toBe(true);
      } finally {
        avail.mockRestore();
        signed.mockRestore();
      }
    });

    it('lets the lifter open Ask AI from the sheet, update sets/reps/weight via chat without closing the sheet, and save', async () => {
      const avail = vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
      const signed = vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
      const chatSpy = vi.spyOn(aiClient, 'chat').mockResolvedValue({
        reply: 'Updated Bench Press to 5x5 at 205 lbs.',
        source: 'backend',
        toolCalls: [
          {
            id: 'live-1',
            name: 'editPlanExercise',
            input: { exerciseName: 'Bench Press', sets: 5, reps: 5, weight: 205 },
          },
        ],
      });

      try {
        const today = toDateKey(new Date());
        const store = configureStore({
          reducer: {
            workout: workoutReducer,
            trackedLifts: trackedLiftsReducer,
            customExercise: customExerciseReducer,
            plannedWorkouts: plannedWorkoutsReducer,
            exercise: exerciseReducer,
            user: userReducer,
            ai: aiReducer,
          },
        });
        store.dispatch(setExercises(libraryExercises));
        const plan: PlannedWorkout = {
          id: 'plan-stacked-1',
          dateKey: today,
          name: 'Upper Push',
          status: 'planned',
          createdAt: new Date().toISOString(),
          exercises: [
            {
              id: 'pe-1',
              exercise: libraryExercises[0],
              sets: [
                { id: 's-1', reps: 8, weight: 185, unit: 'lbs', completed: false },
                { id: 's-2', reps: 8, weight: 185, unit: 'lbs', completed: false },
                { id: 's-3', reps: 8, weight: 185, unit: 'lbs', completed: false },
              ],
              restTime: 120,
            },
          ],
        };
        store.dispatch(planAdded(plan));
        const onOpenChange = vi.fn();

        render(
          <Provider store={store}>
            <MemoryRouter initialEntries={['/']}>
              <PlanEditSheet plan={plan} open={true} onOpenChange={onOpenChange} />
              <AskAiHost />
            </MemoryRouter>
          </Provider>,
        );

        const u = userEvent.setup();
        await u.click(screen.getByRole('button', { name: 'Ask AI' }));
        expect(onOpenChange).not.toHaveBeenCalled();

        await u.type(screen.getByLabelText('Message'), 'make bench 5x5 at 205');
        await u.click(screen.getByRole('button', { name: 'Send' }));

        await screen.findByText('Updated Bench Press to 5x5 at 205 lbs.');
        expect(chatSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              screen: expect.objectContaining({
                tab: 'plan-edit',
                title: 'Plan editor',
              }),
            }),
          }),
        );

        // Escape closes only AiChatSheet; PlanEditSheet stays open underneath with updated values!
        await u.keyboard('{Escape}');
        await waitFor(() =>
          expect(screen.queryByRole('dialog', { name: 'AI assistant' })).not.toBeInTheDocument(),
        );
        expect(onOpenChange).not.toHaveBeenCalled();

        expect((screen.getByLabelText(/sets for bench press/i) as HTMLInputElement).value).toBe('5');
        expect((screen.getByLabelText(/reps for bench press/i) as HTMLInputElement).value).toBe('5');
        expect((screen.getByLabelText(/weight for bench press/i) as HTMLInputElement).value).toBe('205');

        await u.click(screen.getByRole('button', { name: /save/i }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
        const saved = store.getState().plannedWorkouts.plans.find((p) => p.id === 'plan-stacked-1')!;
        expect(saved.exercises[0].sets).toHaveLength(5);
        expect(saved.exercises[0].sets.every((s) => s.reps === 5 && s.weight === 205)).toBe(true);
      } finally {
        avail.mockRestore();
        signed.mockRestore();
        chatSpy.mockRestore();
      }
    });
  });
});
