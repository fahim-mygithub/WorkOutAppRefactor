import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import customExercise from '../../store/slices/customExerciseSlice';
import user, { setProfile } from '../../store/slices/userSlice';
import ai, { aiDisabled } from '../../store/slices/aiSlice';
import * as aiClient from '../../ai/aiClient';
import { CustomExerciseService, type CustomExercise } from '../../services/customExerciseService';
import type { Exercise } from '../../types/exercise';
import { MachinePhotoAdd } from './MachinePhotoAdd';

const photo = { mediaType: 'image/jpeg' as const, data: 'AAAA' };
const machine: aiClient.ReadMachineResult = {
  name: 'Seated Leg Curl',
  muscleGroups: ['Hamstrings'],
  equipment: 'Machine',
  setupCues: ['Knees in line with the pivot.', 'Pad just above the heels.'],
  defaultSets: { sets: 3, reps: 12 },
};

function makeStore(lib: Partial<Exercise>[] = []) {
  const store = configureStore({
    reducer: { exercise, customExercise, user, ai },
    middleware: (g) => g({ serializableCheck: false }),
  });
  store.dispatch(setExercises(lib as Exercise[]));
  store.dispatch(setProfile({ uid: 'u1', email: 'a@b.c', displayName: 'A', createdAt: '', lastActiveAt: '' }));
  return store;
}

function renderAdd(onAdd = vi.fn(), store = makeStore()) {
  const prepareImage = vi.fn().mockResolvedValue(photo);
  render(
    <Provider store={store}>
      <MachinePhotoAdd onAdd={onAdd} prepareImage={prepareImage} />
    </Provider>,
  );
  return { onAdd, store, prepareImage };
}

const takePhoto = () =>
  fireEvent.change(screen.getByTestId('machine-photo-input'), {
    target: { files: [new File([new Uint8Array(4)], 'm.jpg', { type: 'image/jpeg' })] },
  });

beforeEach(() => {
  vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
  vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('MachinePhotoAdd', () => {
  it('is hidden entirely when AI is not configured', () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(false);
    renderAdd();
    expect(screen.queryByRole('button', { name: /photo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('machine-photo-input')).not.toBeInTheDocument();
  });

  it('is hidden when signed out or after the Worker said no', () => {
    vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(false);
    const { store } = renderAdd();
    expect(screen.queryByTestId('machine-photo-input')).not.toBeInTheDocument();
    vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
    store.dispatch(aiDisabled('not-allowed'));
    expect(screen.queryByTestId('machine-photo-input')).not.toBeInTheDocument();
  });

  it('offers a rear-camera photo input', () => {
    renderAdd();
    expect(screen.getByRole('button', { name: 'Add from a photo' })).toBeInTheDocument();
    const input = screen.getByTestId('machine-photo-input');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');
  });

  it('shows the read exercise in an editable card and saves nothing until Add', async () => {
    const read = vi.spyOn(aiClient, 'readMachinePhoto').mockResolvedValue(machine);
    const save = vi.spyOn(CustomExerciseService, 'saveCustomExercise').mockResolvedValue('c9');
    vi.spyOn(CustomExerciseService, 'getUserCustomExercises').mockResolvedValue([
      { id: 'c9', name: 'Seated Leg Curl (Cybex)', muscleGroup: 'Hamstrings', equipment: 'Machine' } as CustomExercise,
    ]);
    const u = userEvent.setup();
    const { onAdd, store } = renderAdd();
    takePhoto();
    const name = await screen.findByLabelText('Name');
    expect(read).toHaveBeenCalledWith(photo);
    expect(name).toHaveValue('Seated Leg Curl');
    expect(screen.getByLabelText('Muscles')).toHaveValue('Hamstrings');
    expect(screen.getByLabelText('Equipment')).toHaveValue('Machine');
    expect(screen.getByLabelText('Setup cues')).toHaveValue('Knees in line with the pivot.\nPad just above the heels.');
    expect(screen.getByLabelText('Sets')).toHaveValue(3);
    expect(screen.getByLabelText('Reps')).toHaveValue(12);
    // Editing is local; nothing is saved or added yet.
    await u.clear(name);
    await u.type(name, 'Seated Leg Curl (Cybex)');
    await u.clear(screen.getByLabelText('Sets'));
    await u.type(screen.getByLabelText('Sets'), '4');
    expect(save).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(store.getState().customExercise.exercises).toEqual([]);

    await u.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith('u1', expect.objectContaining({
      name: 'Seated Leg Curl (Cybex)',
      muscleGroup: 'Hamstrings',
      equipment: 'Machine',
      instructions: ['Knees in line with the pivot.', 'Pad just above the heels.'],
    }));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ id: 'c9', name: 'Seated Leg Curl (Cybex)' });
    expect(onAdd.mock.calls[0][1]).toEqual({ sets: 4, reps: 12 });
  });

  it('uses the library exercise when the name is already there, without saving', async () => {
    vi.spyOn(aiClient, 'readMachinePhoto').mockResolvedValue(machine);
    const save = vi.spyOn(CustomExerciseService, 'saveCustomExercise');
    const u = userEvent.setup();
    const { onAdd } = renderAdd(vi.fn(), makeStore([{ id: 'x-lc', name: 'Seated Leg Curl', muscleGroups: ['Hamstrings'] }]));
    takePhoto();
    await u.click(await screen.findByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd.mock.calls[0][0]).toMatchObject({ id: 'x-lc' });
    expect(save).not.toHaveBeenCalled();
  });

  it('Cancel closes the card without saving', async () => {
    vi.spyOn(aiClient, 'readMachinePhoto').mockResolvedValue(machine);
    const save = vi.spyOn(CustomExerciseService, 'saveCustomExercise');
    const u = userEvent.setup();
    const { onAdd } = renderAdd();
    takePhoto();
    await screen.findByLabelText('Name');
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument());
    expect(save).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('turns AI off for the session when the Worker says not allowed', async () => {
    vi.spyOn(aiClient, 'readMachinePhoto').mockRejectedValue(new aiClient.AiBackendError('x', 'not-allowed'));
    const { store } = renderAdd();
    takePhoto();
    await waitFor(() => expect(store.getState().ai.disabledReason).toBe('not-allowed'));
  });
});
