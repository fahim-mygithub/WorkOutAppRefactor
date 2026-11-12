import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ai from '../store/slices/aiSlice';
import { usePublishScreen, type PublishedScreen } from './useScreenSnapshot';

function Screen({ snapshot }: { snapshot: PublishedScreen | null }) {
  usePublishScreen('library', snapshot);
  return null;
}

const mk = () => configureStore({ reducer: { ai } });
const wrap = (store: ReturnType<typeof mk>, snapshot: PublishedScreen | null) => (
  <Provider store={store}><Screen snapshot={snapshot} /></Provider>
);
const snap = (summary: string, data?: unknown): PublishedScreen => ({ tab: 'library', title: 'Library', summary, data });

describe('usePublishScreen', () => {
  it('publishes on mount, again when the snapshot changes, and clears on unmount', () => {
    const store = mk();
    const { rerender, unmount } = render(wrap(store, snap('3 exercises')));
    expect(store.getState().ai.screen).toEqual(snap('3 exercises'));
    rerender(wrap(store, snap('2 exercises for search "row"')));
    expect(store.getState().ai.screen?.summary).toBe('2 exercises for search "row"');
    unmount();
    expect(store.getState().ai.screen).toBeUndefined();
  });

  it('publishes a capped block however much the screen offers', () => {
    const store = mk();
    render(wrap(store, snap('big', { names: Array.from({ length: 800 }, (_, k) => `Exercise number ${k}`) })));
    expect(JSON.stringify(store.getState().ai.screen).length).toBeLessThanOrEqual(3_000);
  });

  it('publishes nothing for a screen with nothing to say yet', () => {
    const store = mk();
    render(wrap(store, null));
    expect(store.getState().ai.screen).toBeUndefined();
  });

  it('clears what it published when the mounted screen has nothing to show any more', () => {
    const store = mk();
    const { rerender } = render(wrap(store, snap('a shared workout')));
    expect(store.getState().ai.screen?.summary).toBe('a shared workout');
    rerender(wrap(store, null));
    expect(store.getState().ai.screen).toBeUndefined();
    rerender(wrap(store, snap('back')));
    expect(store.getState().ai.screen?.summary).toBe('back');
  });

  it('a screen with nothing to show does not clear a different screen that published', () => {
    const store = mk();
    store.dispatch({ type: 'ai/screenPublished', payload: { tab: 'today', title: 'Today', summary: 'now' } });
    render(wrap(store, null));
    expect(store.getState().ai.screen?.tab).toBe('today');
  });

  it('does not republish an unchanged snapshot', () => {
    const store = mk();
    const states: unknown[] = [];
    store.subscribe(() => states.push(store.getState().ai.screen));
    const { rerender } = render(wrap(store, snap('same')));
    const after = states.length;
    rerender(wrap(store, snap('same')));
    expect(states.length).toBe(after);
  });

  it('a screen going away does not clear a different screen that published since', () => {
    const store = mk();
    const { unmount } = render(wrap(store, snap('library')));
    store.dispatch({ type: 'ai/screenPublished', payload: { tab: 'today', title: 'Today', summary: 'now' } });
    unmount();
    expect(store.getState().ai.screen?.tab).toBe('today');
  });
});
