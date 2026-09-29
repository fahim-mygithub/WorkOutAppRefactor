import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import customExercise from '../../store/slices/customExerciseSlice';
import user, { setProfile } from '../../store/slices/userSlice';
import ai from '../../store/slices/aiSlice';
import * as aiClient from '../../ai/aiClient';
import { CustomExerciseService, type CustomExercise } from '../../services/customExerciseService';
import type { Exercise } from '../../types/exercise';
import { ExerciseLookupCard, resetLookupCache } from './ExerciseLookupCard';

function makeStore(lib: Partial<Exercise>[] = [], signedIn = true) {
  const store = configureStore({
    reducer: { exercise, customExercise, user, ai },
    middleware: (g) => g({ serializableCheck: false }),
  });
  store.dispatch(setExercises(lib as Exercise[]));
  if (signedIn) {
    store.dispatch(
      setProfile({ uid: 'u1', email: 'a@b.c', displayName: 'A', createdAt: '', lastActiveAt: '' }),
    );
  }
  return store;
}

function renderWithLibrary(
  ui: React.ReactElement,
  lib: Partial<Exercise>[] = [],
  signedIn = true,
) {
  const store = makeStore(lib, signedIn);
  const view = render(<Provider store={store}>{ui}</Provider>);
  return { store, ...view };
}

const found = (over: Partial<aiClient.FindExerciseResult> = {}): aiClient.FindExerciseResult => ({
  name: 'Zercher Carry',
  muscleGroups: ['Core', 'Upper Back'],
  equipment: 'Barbell',
  difficulty: 'Advanced',
  instructions: ['Cradle the bar in your elbows.', 'Walk tall.'],
  media: ['https://a/ok.mp4'],
  rejectedMedia: 0,
  ...over,
});

beforeEach(() => resetLookupCache());
afterEach(() => vi.restoreAllMocks());

describe('ExerciseLookupCard', () => {
  it('shows a loading state with Cancel while the lookup runs', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const u = userEvent.setup();
    renderWithLibrary(<ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={onClose} />);
    expect(screen.getByText(/looking it up/i)).toBeInTheDocument();
    expect(screen.getByText(/up to a minute/i)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('points to the library when the lookup is an alias', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue({
      name: 'Skull Crusher',
      aliasOf: 'lying triceps extension',
      muscleGroups: ['Triceps'],
      equipment: 'Barbell',
      difficulty: 'Intermediate',
      instructions: ['a', 'b'],
      media: [],
      rejectedMedia: 0,
    });
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const u = userEvent.setup();
    renderWithLibrary(<ExerciseLookupCard term="skull crushers" onAdd={onAdd} onClose={onClose} />, [
      { id: 'lte', name: 'Lying Triceps Extension', muscleGroup: 'Triceps', equipment: 'Barbell' },
    ]);
    expect(await screen.findByText('Lying Triceps Extension')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Use it' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'lte' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('can save an alias as new anyway', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue(
      found({ name: 'Skull Crusher', aliasOf: 'Lying Triceps Extension', media: [] }),
    );
    const u = userEvent.setup();
    renderWithLibrary(<ExerciseLookupCard term="skull crushers" onAdd={() => {}} onClose={() => {}} />, [
      { id: 'lte', name: 'Lying Triceps Extension', muscleGroup: 'Triceps', equipment: 'Barbell' },
    ]);
    await u.click(await screen.findByRole('button', { name: 'Save as new anyway' }));
    expect(screen.getByRole('heading', { name: 'Skull Crusher' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('previews media and saves on Apply', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue(found());
    const saved: CustomExercise = {
      id: 'c1',
      userId: 'u1',
      isCustom: true,
      originalName: 'zercher carry',
      name: 'Zercher Carry',
      muscleGroup: 'Core, Upper Back',
      muscleGroups: undefined as unknown as string[],
      equipment: 'Barbell',
      difficulty: 'Advanced',
      instructions: ['Cradle the bar in your elbows.', 'Walk tall.'],
      videoLinks: ['https://a/ok.mp4'],
      force: null,
      grips: null,
      mechanic: null,
      searchKeywords: [],
      createdAt: new Date('2026-09-29T00:00:00Z'),
      updatedAt: new Date('2026-09-29T00:00:00Z'),
      usageCount: 1,
    };
    const save = vi.spyOn(CustomExerciseService, 'saveCustomExercise').mockResolvedValue('c1');
    vi.spyOn(CustomExerciseService, 'getUserCustomExercises').mockResolvedValue([saved]);
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const u = userEvent.setup();
    const { container, store } = renderWithLibrary(
      <ExerciseLookupCard term="zercher carry" onAdd={onAdd} onClose={onClose} />,
    );

    expect(await screen.findByRole('heading', { name: 'Zercher Carry' })).toBeInTheDocument();
    expect(screen.getByText('Core, Upper Back · Barbell · Advanced')).toBeInTheDocument();
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://a/ok.mp4');
    expect(screen.getByText('Walk tall.')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith('u1', {
      originalName: 'zercher carry',
      name: 'Zercher Carry',
      muscleGroup: 'Core, Upper Back',
      equipment: 'Barbell',
      difficulty: 'Advanced',
      instructions: ['Cradle the bar in your elbows.', 'Walk tall.'],
      videoLinks: ['https://a/ok.mp4'],
    });
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', name: 'Zercher Carry', muscleGroups: ['Core', 'Upper Back'] }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(store.getState().customExercise.exercises[0].id).toBe('c1');
  });

  it('cycles clips and shows gifs as images', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue(
      found({ media: ['https://a/one.mp4', 'https://a/two.gif'] }),
    );
    const u = userEvent.setup();
    const { container } = renderWithLibrary(
      <ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />,
    );
    await u.click(await screen.findByRole('button', { name: 'Try another clip' }));
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://a/two.gif');
    await u.click(screen.getByRole('button', { name: 'Try another clip' }));
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://a/one.mp4');
  });

  it('offers a URL field when no demo was found, and saves it', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue(found({ media: [], rejectedMedia: 3 }));
    const save = vi.spyOn(CustomExerciseService, 'saveCustomExercise').mockResolvedValue('c1');
    vi.spyOn(CustomExerciseService, 'getUserCustomExercises').mockResolvedValue([]);
    const u = userEvent.setup();
    renderWithLibrary(<ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />);
    expect(await screen.findByText('No working demo found')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/demo url/i), 'https://v.test/zc.mp4');
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith('u1', expect.objectContaining({ videoLinks: ['https://v.test/zc.mp4'] })),
    );
    // getUserCustomExercises didn't return it → a save error, shown in one line.
    expect(await screen.findByText(/couldn.t save/i)).toBeInTheDocument();
  });

  it('asks to sign in before saving', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue(found());
    renderWithLibrary(
      <ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />,
      [],
      false,
    );
    expect(await screen.findByRole('button', { name: /apply/i })).toBeDisabled();
    expect(screen.getByText('Sign in to save')).toBeInTheDocument();
  });

  it('Reject closes without saving', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockResolvedValue(found());
    const save = vi.spyOn(CustomExerciseService, 'saveCustomExercise');
    const onClose = vi.fn();
    const u = userEvent.setup();
    renderWithLibrary(<ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={onClose} />);
    await u.click(await screen.findByRole('button', { name: 'Reject' }));
    expect(onClose).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('shows one line and Close on failure', async () => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    const u = userEvent.setup();
    const { store } = renderWithLibrary(
      <ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={onClose} />,
    );
    expect(await screen.findByText(/couldn.t look that up/i)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(store.getState().ai.disabledReason).toBeUndefined();
  });

  it.each(['not-allowed', 'limit', 'unconfigured'] as const)('disables AI on %s', async (code) => {
    vi.spyOn(aiClient, 'findExerciseOnline').mockRejectedValue(new aiClient.AiBackendError('x', code));
    const { store } = renderWithLibrary(
      <ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />,
    );
    await waitFor(() => expect(store.getState().ai.disabledReason).toBe(code));
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('ignores a result that lands after the card is gone', async () => {
    let resolve!: (r: aiClient.FindExerciseResult) => void;
    vi.spyOn(aiClient, 'findExerciseOnline').mockReturnValue(new Promise((res) => (resolve = res)));
    const errors = vi.spyOn(console, 'error');
    const { unmount } = renderWithLibrary(
      <ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />,
    );
    unmount();
    resolve(found());
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).not.toHaveBeenCalled();
  });

  it('shares one request across a quick remount of the same term', async () => {
    const lookup = vi.spyOn(aiClient, 'findExerciseOnline').mockReturnValue(new Promise(() => {}));
    const first = renderWithLibrary(<ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />);
    first.unmount();
    renderWithLibrary(<ExerciseLookupCard term="zercher carry" onAdd={() => {}} onClose={() => {}} />);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
