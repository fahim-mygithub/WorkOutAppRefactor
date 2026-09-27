import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import trackedLifts from '../../store/slices/trackedLiftsSlice';
import user from '../../store/slices/userSlice';
import { TrackedLifts } from './TrackedLifts';
import { useTrackedLiftsSync } from '../../hooks/useTrackedLiftsSync';

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
