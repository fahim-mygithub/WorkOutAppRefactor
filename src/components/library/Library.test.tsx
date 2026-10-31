import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import exercise, { setExercises } from '../../store/slices/exerciseSlice';
import customExercise, { addCustomExerciseLocally } from '../../store/slices/customExerciseSlice';
import user, { setProfile } from '../../store/slices/userSlice';
import ai from '../../store/slices/aiSlice';
import { CustomExerciseService, type CustomExercise } from '../../services/customExerciseService';
import ExercisesPage from '../../pages/ExercisesPage';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { LibraryMediaClip } from './LibraryMediaClip';
import * as aiClient from '../../ai/aiClient';

vi.mock('../../hooks/useExercises', () => ({
  useExercises: vi.fn(),
}));

const sampleDbExercise = {
  id: 'bench-press',
  name: 'Barbell Bench Press',
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Barbell',
  videoLinks: ['https://cdn.test/bench.mp4'],
  instructions: ['Lie on bench', 'Press bar'],
  difficulty: 'Intermediate' as const,
  force: null,
  grips: null,
  mechanic: null,
  searchKeywords: ['bench', 'press'],
  createdAt: '',
  updatedAt: '',
};

const sampleCustomExercise: CustomExercise = {
  id: 'custom-1',
  userId: 'u1',
  name: 'Cable Fly High-to-Low',
  originalName: 'Cable Fly High-to-Low',
  isCustom: true,
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Cable',
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  instructions: ['Set pulleys high', 'Bring handles down'],
  notes: 'Focus on lower pecs',
  videoLinks: ['https://r2.test/fly.gif'],
  searchKeywords: ['cable', 'fly'],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  usageCount: 3,
};

const sampleCustomPhotoExercise: CustomExercise = {
  id: 'custom-2',
  userId: 'u1',
  name: 'Plate Loaded Chest Press',
  originalName: 'Plate Loaded Chest Press',
  isCustom: true,
  muscleGroup: 'Chest',
  muscleGroups: ['Chest'],
  equipment: 'Machine',
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  instructions: ['Adjust seat to chest level'],
  videoLinks: ['https://r2.test/machine.jpg'],
  searchKeywords: ['chest', 'press'],
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
  usageCount: 1,
};

const sampleCustomVideoExercise: CustomExercise = {
  id: 'custom-3',
  userId: 'u1',
  name: 'Belt Squat',
  originalName: 'Belt Squat',
  isCustom: true,
  muscleGroup: 'Legs',
  muscleGroups: ['Legs'],
  equipment: 'Machine',
  difficulty: 'Intermediate',
  force: null,
  grips: null,
  mechanic: null,
  instructions: ['Hook belt to lever', 'Squat deep'],
  videoLinks: ['https://r2.test/squat.mp4'],
  searchKeywords: ['belt', 'squat'],
  createdAt: new Date('2026-01-03'),
  updatedAt: new Date('2026-01-03'),
  usageCount: 2,
};

function makeStore(customList: CustomExercise[] = []) {
  const store = configureStore({
    reducer: { exercise, customExercise, user, ai },
    middleware: (g) => g({ serializableCheck: false }),
  });
  store.dispatch(setExercises([sampleDbExercise]));
  customList.forEach((e) => store.dispatch(addCustomExerciseLocally(e)));
  store.dispatch(
    setProfile({
      uid: 'u1',
      email: 'lifter@test.com',
      displayName: 'Lifter',
      createdAt: '',
      lastActiveAt: '',
    }),
  );
  return store;
}

function renderLibrary(store = makeStore([sampleCustomExercise, sampleCustomPhotoExercise, sampleCustomVideoExercise])) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ExercisesPage />
      </MemoryRouter>
    </Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
  vi.spyOn(aiClient, 'isSignedIn').mockReturnValue(true);
  vi.spyOn(CustomExerciseService, 'getUserCustomExercises').mockResolvedValue([
    sampleCustomExercise,
    sampleCustomPhotoExercise,
    sampleCustomVideoExercise,
  ]);
});

describe('LibraryMediaClip', () => {
  it('renders GIF as an img tag', () => {
    const { container } = render(<LibraryMediaClip url="https://r2.test/demo.gif" alt="Demo GIF" />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://r2.test/demo.gif');
  });

  it('renders photo as an img tag', () => {
    const { container } = render(<LibraryMediaClip url="https://r2.test/photo.jpg" alt="Demo Photo" />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://r2.test/photo.jpg');
  });

  it('renders video as a muted looping video tag', () => {
    const { container } = render(<LibraryMediaClip url="https://r2.test/clip.mp4" />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://r2.test/clip.mp4');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
  });

  it('shows placeholder glyph initially or when url is empty', () => {
    const { container } = render(<LibraryMediaClip url="" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('ExercisesPage (Library)', () => {
  it('My exercises lists custom exercises with media', async () => {
    const u = userEvent.setup();
    renderLibrary();

    // Click "My exercises" filter chip
    const myChip = screen.getByRole('button', { name: /My exercises/i });
    expect(myChip).toBeInTheDocument();
    await u.click(myChip);

    // Lists the custom exercises
    expect(await screen.findByText('Cable Fly High-to-Low')).toBeInTheDocument();
    expect(screen.getByText('Plate Loaded Chest Press')).toBeInTheDocument();
    expect(screen.getByText('Belt Squat')).toBeInTheDocument();

    // Verify media elements are rendered for the custom exercises
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2); // GIF and photo
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument(); // MP4 video
  });

  it('empty search offers create prefilled with search text', async () => {
    const u = userEvent.setup();
    renderLibrary();

    const searchInput = screen.getByPlaceholderText('Search exercises');
    await u.type(searchInput, 'Nordic Curl Machine');

    // Empty search state
    expect(await screen.findByText('No exercises match')).toBeInTheDocument();

    // "Create custom exercise" button is shown prefilled
    const createBtn = screen.getByRole('button', { name: /Create custom exercise/i });
    expect(createBtn).toBeInTheDocument();

    await u.click(createBtn);

    // Sheet opens with name prefilled to the search text
    const nameInput = await screen.findByLabelText(/Exercise name/i);
    expect(nameInput).toHaveValue('Nordic Curl Machine');
  });

  it('edit saves through customExerciseService with exactly 1 call', async () => {
    const updateSpy = vi.spyOn(CustomExerciseService, 'updateCustomExercise').mockResolvedValue();
    const u = userEvent.setup();
    renderLibrary();

    // Go to My exercises
    await u.click(screen.getByRole('button', { name: /My exercises/i }));
    await screen.findByText('Cable Fly High-to-Low');

    // Click "Edit" on Cable Fly
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    await u.click(editBtns[0]);

    // Sheet opens for editing
    const nameInput = await screen.findByLabelText(/Exercise name/i);
    expect(nameInput).toHaveValue('Cable Fly High-to-Low');

    // Make an edit
    const cuesInput = screen.getByLabelText(/Setup cues/i);
    await u.clear(cuesInput);
    await u.type(cuesInput, 'Slight elbow bend.\nSqueeze at center.');

    // Save changes
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    await u.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith('u1', 'custom-1', expect.objectContaining({
        name: 'Cable Fly High-to-Low',
        instructions: ['Slight elbow bend.', 'Squeeze at center.'],
      }));
    });
  });

  it('edit saves with uploaded media through customExerciseService', async () => {
    const updateSpy = vi.spyOn(CustomExerciseService, 'updateCustomExercise').mockResolvedValue();
    const uploadMock = vi.fn().mockResolvedValue({
      url: 'https://r2.test/cable-fly-new.mp4',
      kind: 'video',
      bytes: 8192,
    });
    const u = userEvent.setup();

    render(
      <Provider store={makeStore([sampleCustomExercise])}>
        <CustomExerciseSheet
          open={true}
          onOpenChange={vi.fn()}
          exercise={sampleCustomExercise}
          uploadFile={uploadMock}
        />
      </Provider>,
    );

    // Remove existing media first
    const removeBtn = screen.getByRole('button', { name: /Remove media/i });
    await u.click(removeBtn);

    // Upload new media
    const fileInput = screen.getByTestId('custom-exercise-media-input');
    const fakeFile = new File(['fake video data'], 'fly.mp4', { type: 'video/mp4' });
    await u.upload(fileInput, fakeFile);

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(fakeFile);
    });

    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    await u.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith('u1', 'custom-1', expect.objectContaining({
        name: 'Cable Fly High-to-Low',
        videoLinks: ['https://r2.test/cable-fly-new.mp4'],
      }));
    });
  });

  it('create saves a custom exercise with uploaded media through customExerciseService with exactly 1 call', async () => {
    const saveSpy = vi.spyOn(CustomExerciseService, 'saveCustomExercise').mockResolvedValue('c-new');
    vi.spyOn(CustomExerciseService, 'getUserCustomExercises').mockResolvedValue([
      {
        id: 'c-new',
        name: 'Pendlay Row',
        muscleGroup: 'Back',
        equipment: 'Barbell',
        videoLinks: ['https://r2.test/new-custom.gif'],
      } as CustomExercise,
    ]);
    const uploadMock = vi.fn().mockResolvedValue({
      url: 'https://r2.test/new-custom.gif',
      kind: 'gif',
      bytes: 4096,
    });

    const store = makeStore([]);
    const onSaved = vi.fn();
    const u = userEvent.setup();

    render(
      <Provider store={store}>
        <CustomExerciseSheet
          open={true}
          onOpenChange={vi.fn()}
          prefillName="Pendlay Row"
          onSaved={onSaved}
          uploadFile={uploadMock}
        />
      </Provider>,
    );

    const nameInput = screen.getByLabelText(/Exercise name/i);
    expect(nameInput).toHaveValue('Pendlay Row');

    const musclesInput = screen.getByLabelText(/Muscles targeted/i);
    await u.type(musclesInput, 'Back');

    const equipmentInput = screen.getByLabelText(/Equipment/i);
    await u.type(equipmentInput, 'Barbell');

    // Actually upload media via file picker
    const fileInput = screen.getByTestId('custom-exercise-media-input');
    const fakeFile = new File(['fake gif data'], 'row.gif', { type: 'image/gif' });
    await u.upload(fileInput, fakeFile);

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(fakeFile);
    });

    const saveBtn = screen.getByRole('button', { name: /Create exercise/i });
    await u.click(saveBtn);

    await waitFor(() => {
      // Must call saveCustomExercise exactly ONCE with videoLinks attached
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith('u1', expect.objectContaining({
        name: 'Pendlay Row',
        muscleGroup: 'Back',
        equipment: 'Barbell',
        videoLinks: ['https://r2.test/new-custom.gif'],
      }));
    });
  });

  it('hides or disables media upload when AI is unavailable', () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(false);

    render(
      <Provider store={makeStore([])}>
        <CustomExerciseSheet
          open={true}
          onOpenChange={vi.fn()}
        />
      </Provider>,
    );

    expect(screen.queryByRole('button', { name: /Add GIF or video/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Take photo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/AI media upload is currently disabled or offline/i)).toBeInTheDocument();
  });

  it('clicking an exercise opens detail sheet and shows media', async () => {
    const u = userEvent.setup();
    renderLibrary();

    // Click on the db exercise
    const row = screen.getByText('Barbell Bench Press');
    await u.click(row);

    // Detail sheet displays instructions
    expect(await screen.findByText('How to do it')).toBeInTheDocument();
    expect(screen.getByText('Lie on bench')).toBeInTheDocument();
  });
});
