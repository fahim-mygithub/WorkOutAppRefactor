import { describe, it, expect } from 'vitest';
import reducer, {
  trackedLiftsHydrated,
  liftAdded,
  liftUpdated,
  liftRemoved,
  categoryAdded,
  categoryRenamed,
  categoryRemoved,
  progressionToggled,
  goalChosen,
  sessionsRecorded,
  bestResolved,
  type TrackedLiftsState,
} from './trackedLiftsSlice';
import { seedTrackedLifts } from '../../lib/trackedLifts';

const ready = (): TrackedLiftsState => reducer(undefined, trackedLiftsHydrated(null));

describe('trackedLiftsSlice', () => {
  it('starts idle and empty until hydrated', () => {
    const s = reducer(undefined, { type: '@@init' });
    expect(s.status).toBe('idle');
    expect(s.lifts).toEqual([]);
  });

  it('hydrates to the starter template when nothing is saved', () => {
    const s = ready();
    expect(s.status).toBe('ready');
    expect(s.categories).toEqual(['Push', 'Pull', 'Legs']);
    expect(s.lifts.map((l) => l.name)).toEqual(['Bench Press', 'Seal Row', 'Front Squat']);
  });

  it('hydrates saved data as-is (an empty saved list stays empty)', () => {
    const s = reducer(undefined, trackedLiftsHydrated({ categories: ['Core'], lifts: [] }));
    expect(s.categories).toEqual(['Core']);
    expect(s.lifts).toEqual([]);
  });

  it('adds a lift with a generated id', () => {
    const s = reducer(
      ready(),
      liftAdded({
        name: 'Med ball slam',
        category: 'Push',
        load: { kind: 'level', label: 'Med ball 8 kg' },
        target: { kind: 'time', seconds: 30 },
      }),
    );
    const added = s.lifts[s.lifts.length - 1];
    expect(added.name).toBe('Med ball slam');
    expect(added.id).toBeTruthy();
    expect(new Set(s.lifts.map((l) => l.id)).size).toBe(s.lifts.length);
  });

  it('adding a lift to an unknown category creates that category', () => {
    const s = reducer(
      ready(),
      liftAdded({ name: 'Plank', category: 'Core', load: { kind: 'bodyweight' }, target: { kind: 'none' } }),
    );
    expect(s.categories).toEqual(['Push', 'Pull', 'Legs', 'Core']);
  });

  it('updates a lift in place by id', () => {
    const base = ready();
    const bench = base.lifts[0];
    const s = reducer(base, liftUpdated({ ...bench, load: { kind: 'weight', value: 275, unit: 'lb' } }));
    expect(s.lifts[0]).toEqual({ ...bench, load: { kind: 'weight', value: 275, unit: 'lb' } });
    expect(s.lifts).toHaveLength(base.lifts.length);
  });

  it('updating a lift into a new category creates the category', () => {
    const base = ready();
    const s = reducer(base, liftUpdated({ ...base.lifts[0], category: 'Chest' }));
    expect(s.categories).toContain('Chest');
  });

  it('removes a lift by id', () => {
    const base = ready();
    const s = reducer(base, liftRemoved(base.lifts[1].id));
    expect(s.lifts.map((l) => l.name)).toEqual(['Bench Press', 'Front Squat']);
  });

  it('adds a trimmed category, ignoring blanks and case-insensitive duplicates', () => {
    let s = reducer(ready(), categoryAdded('  Core  '));
    s = reducer(s, categoryAdded('push'));
    s = reducer(s, categoryAdded('   '));
    expect(s.categories).toEqual(['Push', 'Pull', 'Legs', 'Core']);
  });

  it('renames a category and moves its lifts with it', () => {
    const s = reducer(ready(), categoryRenamed({ from: 'Legs', to: 'Lower body' }));
    expect(s.categories).toEqual(['Push', 'Pull', 'Lower body']);
    expect(s.lifts.find((l) => l.name === 'Front Squat')?.category).toBe('Lower body');
  });

  it('renaming onto an existing category merges them', () => {
    const s = reducer(ready(), categoryRenamed({ from: 'Pull', to: 'Push' }));
    expect(s.categories).toEqual(['Push', 'Legs']);
    expect(s.lifts.filter((l) => l.category === 'Push').map((l) => l.name)).toEqual([
      'Bench Press',
      'Seal Row',
    ]);
  });

  it('removing a category keeps its lifts (they are never silently deleted)', () => {
    const s = reducer(ready(), categoryRemoved('Pull'));
    expect(s.categories).toEqual(['Push', 'Legs']);
    expect(s.lifts).toHaveLength(seedTrackedLifts().lifts.length);
  });

  it('keeps the progression flag, cycle and log when the editor saves', () => {
    let s = ready();
    s = reducer(s, sessionsRecorded({ date: 'd', entries: [{ liftId: 'seed-bench-press', goal: 'volume', sets: [{ weight: 180, reps: 10 }] }] }));
    const bench = s.lifts[0];
    s = reducer(s, liftUpdated({ id: bench.id, name: 'Bench', category: 'Push', load: bench.load, target: bench.target, sets: undefined }));
    expect(s.lifts[0]).toMatchObject({ name: 'Bench', progression: true, cycle: { volume: 1, strength: 0 } });
    expect(s.lifts[0].sessions).toHaveLength(1);
  });

  it('toggles progression and remembers the goal', () => {
    let s = reducer(ready(), progressionToggled('seed-seal-row'));
    expect(s.lifts[1].progression).toBe(true);
    s = reducer(s, progressionToggled('seed-seal-row'));
    expect(s.lifts[1].progression).toBe(false);
    expect(reducer(s, goalChosen('strength')).lastGoal).toBe('strength');
  });

  it('queues a new best for progression lifts only, and Update applies it', () => {
    let s = reducer(
      ready(),
      sessionsRecorded({
        date: 'd',
        entries: [
          { liftId: 'seed-bench-press', goal: 'checkpoint', sets: [{ weight: 275, reps: 1 }] },
          { liftId: 'seed-seal-row', goal: 'volume', sets: [{ weight: 200, reps: 10 }] }, // accessory
        ],
      }),
    );
    expect(s.pendingBests?.map((b) => b.liftId)).toEqual(['seed-bench-press']);
    expect(s.lifts[1].sessions).toHaveLength(1); // accessory is still logged

    const kept = reducer(s, bestResolved({ liftId: 'seed-bench-press', accept: false }));
    expect(kept.pendingBests).toEqual([]);
    expect(kept.lifts[0].load).toEqual({ kind: 'weight', value: 265, unit: 'lb' });

    s = reducer(s, bestResolved({ liftId: 'seed-bench-press', accept: true }));
    expect(s.lifts[0].load).toEqual({ kind: 'weight', value: 275, unit: 'lb' });
  });
});
