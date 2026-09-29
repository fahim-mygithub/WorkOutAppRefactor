import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import trackedLifts from '../../store/slices/trackedLiftsSlice';
import user from '../../store/slices/userSlice';
import { TrackedLifts } from './TrackedLifts';
import { useTrackedLiftsSync } from '../../hooks/useTrackedLiftsSync';
import * as aiClient from '../../ai/aiClient';

/** AppShell mounts the sync hook app-wide; stand in for it here. */
function WithSync(props: React.ComponentProps<typeof TrackedLifts>) {
  useTrackedLiftsSync();
  return <TrackedLifts {...props} />;
}

function renderList(props: React.ComponentProps<typeof TrackedLifts> = {}) {
  const store = configureStore({ reducer: { trackedLifts, user } });
  const { unmount } = render(
    <Provider store={store}>
      <WithSync {...props} />
    </Provider>,
  );
  return Object.assign(store, { unmount });
}

describe('TrackedLifts', () => {
  beforeEach(() => localStorage.clear());

  it('shows the starter lifts grouped under Push / Pull / Legs', async () => {
    renderList();
    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Push', 'Pull', 'Legs']);
    expect(screen.getByRole('button', { name: /Bench Press.*1-rep max.*265 lb/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seal Row.*160 lb/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Front Squat.*3 reps.*250 lb/ })).toBeInTheDocument();
  });

  it('adds a lift with a non-plate progression step and a time target', async () => {
    const u = userEvent.setup();
    const store = renderList();
    await u.click(await screen.findByRole('button', { name: 'Add a lift to Push' }));

    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Lift'), 'Med ball chest pass');
    await u.click(within(dialog).getByRole('radio', { name: 'Level' }));
    await u.type(within(dialog).getByLabelText('Progression step'), 'Med ball 6 kg');
    await u.click(within(dialog).getByRole('radio', { name: 'Time' }));
    await u.type(within(dialog).getByLabelText('Seconds under tension'), '40');
    await u.type(within(dialog).getByLabelText('Tempo (optional)'), '3-1-3');
    await u.click(within(dialog).getByRole('button', { name: 'Add lift' }));

    const added = store.getState().trackedLifts.lifts.at(-1)!;
    expect(added).toMatchObject({
      name: 'Med ball chest pass',
      category: 'Push',
      load: { kind: 'level', label: 'Med ball 6 kg' },
      target: { kind: 'time', seconds: 40, tempo: '3-1-3' },
    });
    expect(
      await screen.findByRole('button', { name: /Med ball chest pass.*40 s under tension, tempo 3-1-3.*Med ball 6 kg/ }),
    ).toBeInTheDocument();
  });

  it('keeps Save disabled until the entry is valid', async () => {
    const u = userEvent.setup();
    renderList();
    await u.click((await screen.findAllByRole('button', { name: 'Add lift' }))[0]);
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Add lift' });
    expect(save).toBeDisabled();
    await u.type(within(dialog).getByLabelText('Lift'), 'Dip');
    await u.type(within(dialog).getByLabelText('Weight'), '45');
    expect(save).toBeDisabled(); // reps still empty
    await u.type(within(dialog).getByLabelText('Reps'), '8');
    expect(save).toBeEnabled();
  });

  it('edits and deletes an existing lift', async () => {
    const u = userEvent.setup();
    const store = renderList();
    await u.click(await screen.findByRole('button', { name: /^Seal Row/ }));
    let dialog = await screen.findByRole('dialog');
    const weight = within(dialog).getByLabelText('Weight');
    await u.clear(weight);
    await u.type(weight, '170');
    await u.click(within(dialog).getByRole('button', { name: 'Save lift' }));
    expect(store.getState().trackedLifts.lifts.find((l) => l.name === 'Seal Row')?.load).toEqual({
      kind: 'weight',
      value: 170,
      unit: 'lb',
    });

    await u.click(await screen.findByRole('button', { name: /^Seal Row/ }));
    dialog = await screen.findByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: 'Delete lift' }));
    expect(store.getState().trackedLifts.lifts.some((l) => l.name === 'Seal Row')).toBe(false);
  });

  it('persists the list locally and restores it on the next mount', async () => {
    const u = userEvent.setup();
    const first = renderList();
    await u.click(await screen.findByRole('button', { name: /^Front Squat/ }));
    const dialog = await screen.findByRole('dialog');
    await u.click(within(dialog).getByRole('button', { name: 'Delete lift' }));
    first.unmount();

    const store = renderList();
    await screen.findAllByRole('heading', { level: 3 });
    expect(store.getState().trackedLifts.lifts.map((l) => l.name)).toEqual(['Bench Press', 'Seal Row']);
  });

  it('shows a checkbox per lift only when selection is enabled', async () => {
    const u = userEvent.setup();
    const toggled: string[] = [];
    renderList({ selectedIds: ['seed-seal-row'], onToggleSelect: (id) => toggled.push(id) });

    const bench = await screen.findByRole('checkbox', { name: 'Include Bench Press in a workout' });
    expect(bench).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: 'Include Seal Row in a workout' })).toHaveAttribute('aria-checked', 'true');

    await u.click(bench);
    expect(toggled).toEqual(['seed-bench-press']);
    // the row itself still opens the editor, not the checkbox
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no checkboxes without a selection handler', async () => {
    renderList();
    await screen.findAllByRole('heading', { level: 3 });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('flags a lift for progression from the row', async () => {
    const u = userEvent.setup();
    const store = renderList();
    const flag = await screen.findByRole('button', { name: 'Track progression for Seal Row' });
    expect(flag).toHaveAttribute('aria-pressed', 'false');
    await u.click(flag);
    expect(store.getState().trackedLifts.lifts[1].progression).toBe(true);
    expect(flag).toHaveAttribute('aria-pressed', 'true');
    // flagged rows show their cycle status
    // flagged rows (Bench, Front Squat from the template, now Seal Row) show their cycle status
    expect(screen.getAllByText(/^Volume 0\/2 · Strength 0\/2/)).toHaveLength(3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('TrackedLiftEditor — Weight step', () => {
  beforeEach(() => localStorage.clear());

  it('shows Weight step only for a weight load, validates it and saves it', async () => {
    const u = userEvent.setup();
    const store = renderList();
    await u.click(await screen.findByRole('button', { name: 'Add a lift to Legs' }));
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Add lift' });
    await u.type(within(dialog).getByLabelText('Lift'), 'Hack Squat');
    await u.type(within(dialog).getByLabelText('Weight'), '200');
    await u.type(within(dialog).getByLabelText('Reps'), '8');
    const step = within(dialog).getByLabelText('Weight step');
    expect(step).toHaveAttribute('placeholder', '5');
    await u.type(step, '60');
    expect(save).toBeDisabled(); // > 50
    await u.clear(step);
    await u.type(step, '-1');
    expect(save).toBeDisabled();
    await u.clear(step);
    await u.type(step, '10');
    expect(save).toBeEnabled();

    await u.click(within(dialog).getByRole('radio', { name: 'kg' }));
    expect(within(dialog).getByLabelText('Weight step')).toHaveAttribute('placeholder', '2.5');
    await u.click(within(dialog).getByRole('radio', { name: 'lb' }));
    await u.click(within(dialog).getByRole('radio', { name: 'Level' }));
    expect(within(dialog).queryByLabelText('Weight step')).not.toBeInTheDocument();
    await u.click(within(dialog).getByRole('radio', { name: 'Weight' }));
    await u.click(save);
    expect(store.getState().trackedLifts.lifts.at(-1)).toMatchObject({ name: 'Hack Squat', step: 10 });
  });
});

describe('TrackedLiftEditor — Describe it', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  async function openAdd() {
    const u = userEvent.setup();
    const store = renderList();
    await u.click(await screen.findByRole('button', { name: 'Add a lift to Legs' }));
    const dialog = await screen.findByRole('dialog');
    return { u, store, dialog };
  }

  const describeIt = async (u: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, text: string) => {
    await u.type(within(dialog).getByLabelText('Describe it'), text);
    await u.click(within(dialog).getByRole('button', { name: 'Fill' }));
  };

  it('is hidden when the AI backend is not available', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(false);
    const { dialog } = await openAdd();
    expect(within(dialog).queryByLabelText('Describe it')).not.toBeInTheDocument();
  });

  it('fills the form from a description, never saves, and carries step + equipment on save', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    const read = vi.spyOn(aiClient, 'readLiftEntry').mockResolvedValue({
      name: 'Front Squat', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 5, sets: 3,
      step: 5, equipment: 'barbell', question: null,
    });
    const { u, store, dialog } = await openAdd();
    const before = store.getState().trackedLifts.lifts.length;
    await describeIt(u, dialog, 'front squat 250 for 3x5');

    expect(read).toHaveBeenCalledWith('front squat 250 for 3x5');
    expect(await within(dialog).findByText(/check and save/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Lift')).toHaveValue('Front Squat');
    expect(within(dialog).getByLabelText('Weight')).toHaveValue('250');
    expect(within(dialog).getByLabelText('Reps')).toHaveValue('5');
    expect(within(dialog).getByLabelText(/^Sets/)).toHaveValue('3');
    expect(within(dialog).getByLabelText('Weight step')).toHaveValue('5');
    expect(store.getState().trackedLifts.lifts).toHaveLength(before); // never saves

    await u.click(within(dialog).getByRole('button', { name: 'Add lift' }));
    expect(store.getState().trackedLifts.lifts.at(-1)).toMatchObject({
      name: 'Front Squat',
      category: 'Legs',
      load: { kind: 'weight', value: 250, unit: 'lb' },
      target: { kind: 'reps', min: 5 },
      sets: 3,
      step: 5,
      equipment: 'barbell',
    });
  });

  it('shows the question under the field and still fills', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'readLiftEntry').mockResolvedValue({
      name: 'Dumbbell Press', loadKind: 'weight', weight: 60, unit: null as unknown as undefined,
      targetKind: 'reps', reps: 10, question: 'Is 60 per hand?',
    });
    const { u, dialog } = await openAdd();
    await describeIt(u, dialog, 'db press 60 x10');
    expect(await within(dialog).findByText('Is 60 per hand?')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Lift')).toHaveValue('Dumbbell Press');
    expect(within(dialog).getByLabelText('Weight')).toHaveValue('60');
    expect(within(dialog).getByRole('radio', { name: 'lb' })).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the typed name when the result has an empty name', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'readLiftEntry').mockResolvedValue({
      name: '', loadKind: 'bodyweight', targetKind: 'reps', reps: 12, question: null,
    });
    const { u, dialog } = await openAdd();
    await u.type(within(dialog).getByLabelText('Lift'), 'Pistol Squat');
    await describeIt(u, dialog, 'twelve reps');
    expect(await within(dialog).findByText(/check and save/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Lift')).toHaveValue('Pistol Squat');
    expect(within(dialog).getByRole('radio', { name: 'Bodyweight' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByLabelText('Reps')).toHaveValue('12');
  });

  it('says the daily limit is reached', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'readLiftEntry').mockRejectedValue(new aiClient.AiBackendError('x', 'limit'));
    const { u, dialog } = await openAdd();
    await describeIt(u, dialog, 'squat');
    expect(await within(dialog).findByText(/AI limit reached for today/)).toBeInTheDocument();
  });

  it('falls back to a generic note on other errors', async () => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'readLiftEntry').mockRejectedValue(new Error('boom'));
    const { u, dialog } = await openAdd();
    await describeIt(u, dialog, 'squat');
    expect(await within(dialog).findByText(/Couldn't read that — fill the form below/)).toBeInTheDocument();
  });

  it.each(['not-allowed', 'signed-out', 'unconfigured'] as const)('hides the field on %s', async (code) => {
    vi.spyOn(aiClient, 'isBackendAvailable').mockReturnValue(true);
    vi.spyOn(aiClient, 'readLiftEntry').mockRejectedValue(new aiClient.AiBackendError('x', code));
    const { u, dialog } = await openAdd();
    await describeIt(u, dialog, 'squat');
    await vi.waitFor(() => expect(within(dialog).queryByLabelText('Describe it')).not.toBeInTheDocument());
  });
});
