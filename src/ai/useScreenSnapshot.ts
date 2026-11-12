/**
 * A screen tells the assistant what it shows: publishes its snapshot while it
 * is mounted (again whenever the snapshot changes) and clears it on unmount.
 * The snapshot lives in the store (`ai.screen`), is capped there, and is never
 * persisted with the chat.
 */
import { useEffect, useRef } from 'react';
import { useAppDispatch } from '../store/hooks';
import { screenCleared, screenPublished } from '../store/slices/aiSlice';
import type { BuildDraftState, ScreenSnapshot } from './screenSnapshot';
import type { AiAppTab } from './types';

export type PublishedScreen = ScreenSnapshot & { draft?: BuildDraftState };

/**
 * @param tab      the tab this screen is (the clear on unmount only affects it)
 * @param snapshot what the screen shows now; null publishes nothing yet
 */
export function usePublishScreen(tab: AiAppTab, snapshot: PublishedScreen | null): void {
  const dispatch = useAppDispatch();
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const key = snapshot ? JSON.stringify(snapshot) : '';
  useEffect(() => {
    if (latest.current) dispatch(screenPublished(latest.current));
  }, [key, dispatch]);
  useEffect(() => () => {
    dispatch(screenCleared(tab));
  }, [tab, dispatch]);
}
