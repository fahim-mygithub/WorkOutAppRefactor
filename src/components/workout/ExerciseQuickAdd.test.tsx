import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import customExercise from '../../store/slices/customExerciseSlice';
import user from '../../store/slices/userSlice';
import ai, { aiDisabled } from '../../store/slices/aiSlice';
import * as aiClient from '../../ai/aiClient';
import { resetLookupCache } from '../ai/ExerciseLookupCard';
import type { Exercise } from '../../types/exercise';
import { ExerciseQuickAdd } from './ExerciseQuickAdd';

const lib = [
  {
    id: 'bb-bench',
    name: 'Barbell Bench Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    videoLinks: ['https://cdn.test/bench-front.mp4#t=0.1', 'https://cdn.test/bench-side.mp4#t=0.1'],
  },
  { id: 'db-bench', name: 'Dumbbell Bench Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'squat', name: 'Barbell Back Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
] as Exercise[];

function makeStore() {
  const store = configureStore({
    reducer: { exercise, customExercise, user, ai },
    middleware: (g) => g({ serializableCheck: false }),
  });
  store.dispatch(setExercises(lib));
  return store;
}

function renderWith(ui: React.ReactElement, store = makeStore()) {
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}

function NameField({ onPick }: { onPick: (e: Exercise) => void }) {
  const [name, setName] = useState('');
  return (
    <ExerciseQuickAdd
      id="lift-name"
      label="Lift"
      value={name}
      onValueChange={setName}
      onAdd={(e) => {
        onPick(e);
        setName(e.name);
      }}
    />
  );
}

describe('ExerciseQuickAdd as a name field', () => {
  it('suggests library matches while typing and fills the name on pick', async () => {
    const u = userEvent.setup();
    const onPick = vi.fn();
    renderWith(<NameField onPick={onPick} />);

    const input = screen.getByLabelText('Lift');
    await u.type(input, 'bench');
    expect(screen.getByRole('button', { name: /Barbell Bench Press/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back Squat/ })).toBeNull();

    await u.click(screen.getByRole('button', { name: /Dumbbell Bench Press/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'db-bench' }));
    expect(input).toHaveValue('Dumbbell Bench Press');
    expect(screen.queryByRole('button', { name: /Barbell Bench Press/ })).toBeNull();
  });

  it('ranks closer names first and matches words in any order', async () => {
    const u = userEvent.setup();
    renderWith(<NameField onPick={() => {}} />);
    await u.type(screen.getByLabelText('Lift'), 'press bench');
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names[0]).toMatch(/^Barbell Bench Press/);
    expect(names).toHaveLength(2);
  });

  it('keeps a free-typed name that matches nothing', async () => {
    const u = userEvent.setup();
    renderWith(<NameField onPick={() => {}} />);
    const input = screen.getByLabelText('Lift');
    await u.type(input, 'Med ball chest pass');
    expect(input).toHaveValue('Med ball chest pass');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('clears after adding when uncontrolled', async () => {
    const u = userEvent.setup();
    const onAdd = vi.fn();
    renderWith(<ExerciseQuickAdd label="Add an exercise" onAdd={onAdd} />);
    const input = screen.getByLabelText('Add an exercise');
    await u.type(input, 'squat');
    await u.click(screen.getByRole('button', { name: /Back Squat/ }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'squat' }));
    expect(input).toHaveValue('');
  });

  it('shows a still of the front clip beside each suggestion, and a placeholder without one', async () => {
    const u = userEvent.setup();
    const { container } = renderWith(<NameField onPick={() => {}} />);
    await u.type(screen.getByLabelText('Lift'), 'bench');

    const videos = container.querySelectorAll('li video');
    expect(videos).toHaveLength(1); // Dumbbell Bench Press has no clip
    expect(videos[0]).toHaveAttribute('src', 'https://cdn.test/bench-front.mp4#t=0.1');
    // Decorative: the row's accessible name stays just the text.
    expect(screen.getByRole('button', { name: /Barbell Bench Press/ })).toBeInTheDocument();
  });
});

describe('ExerciseQuickAdd — custom exercises', () => {
  it('finds saved custom exercises, and skips ones the library already has', async () => {
    const store = makeStore();
    store.dispatch({
      type: 'customExercise/loadCustomExercises/fulfilled',
      payload: {
        exercises: [
          { id: 'c-zc', name: 'Zercher Carry', muscleGroup: 'Core', equipment: 'Barbell', createdAt: new Date(), updatedAt: new Date() },
          { id: 'c-dup', name: 'barbell back squat', muscleGroup: 'Quads', equipment: 'Barbell', createdAt: new Date(), updatedAt: new Date() },
        ],
        lastSynced: '',
      },
    });
    const onAdd = vi.fn();
    const u = userEvent.setup();
    renderWith(<ExerciseQuickAdd label="Add an exercise" onAdd={onAdd} />, store);

    await u.type(screen.getByLabelText('Add an exercise'), 'squat');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await u.clear(screen.getByLabelText('Add an exercise'));
    await u.type(screen.getByLabelText('Add an exercise'), 'zercher');
    await u.click(screen.getByRole('button', { name: /Zercher Carry/ }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-zc', name: 'Zercher Carry' }));
  });
});

describe('ExerciseQuickAdd — AI lookup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetLookupCache();
  });
  const aiOn = () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
  };
  const lookupRow = /look up .*zercher carry.* with ai/i;

  it('offers AI lookup when nothing matches', async () => {
    aiOn();
    const u = userEvent.setup();
    renderWith(<ExerciseQuickAdd label="Add an exercise" onAdd={() => {}} />);
    await u.type(screen.getByLabelText('Add an exercise'), 'zercher carry');
    expect(screen.getByRole('button', { name: lookupRow })).toBeInTheDocument();
  });

  it('does not offer it for short terms, when something matches, or when AI is off', async () => {
    aiOn();
    const u = userEvent.setup();
    const { store } = renderWith(<ExerciseQuickAdd label="Add an exercise" onAdd={() => {}} />);
    const input = screen.getByLabelText('Add an exercise');
    await u.type(input, 'zc');
    expect(screen.queryByRole('button', { name: /with ai/i })).toBeNull();
    await u.clear(input);
    await u.type(input, 'bench');
    expect(screen.queryByRole('button', { name: /with ai/i })).toBeNull();
    await u.clear(input);
    store.dispatch(aiDisabled('limit'));
    await u.type(input, 'zercher carry');
    expect(screen.queryByRole('button', { name: /with ai/i })).toBeNull();
  });

  it('does not offer it when signed out', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(false);
    const u = userEvent.setup();
    renderWith(<ExerciseQuickAdd label="Add an exercise" onAdd={() => {}} />);
    await u.type(screen.getByLabelText('Add an exercise'), 'zercher carry');
    expect(screen.queryByRole('button', { name: /with ai/i })).toBeNull();
  });

  it('opens the lookup sheet, and Use it fills the controlled name and closes', async () => {
    aiOn();
    const find = vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue({
      name: 'Bench Press',
      aliasOf: 'Barbell Bench Press',
      muscleGroups: ['Chest'],
      equipment: 'Barbell',
      difficulty: 'Beginner',
      instructions: ['a', 'b'],
      media: [],
      rejectedMedia: 0,
    });
    const onPick = vi.fn();
    const u = userEvent.setup();
    renderWith(<NameField onPick={onPick} />);
    const input = screen.getByLabelText('Lift');
    await u.type(input, 'zercher carry');
    await u.click(screen.getByRole('button', { name: lookupRow }));

    const dialog = await screen.findByRole('dialog');
    expect(find).toHaveBeenCalledWith('zercher carry');
    await u.click(await within(dialog).findByRole('button', { name: 'Use it' }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'bb-bench' }));
    expect(input).toHaveValue('Barbell Bench Press');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
