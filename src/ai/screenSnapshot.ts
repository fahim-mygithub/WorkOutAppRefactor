/**
 * What the visible screen tells the assistant: the "render layer".
 *
 * A mounted screen publishes a small summary of what it shows (see
 * `useScreenSnapshot`); `buildAiContext` sends it as `screen`. The assistant
 * reads it to answer "what am I looking at" without tools, and its typed edit
 * tools change the screen through the store, never through the DOM.
 *
 * Publishers send names and numbers only: never other users' data, tokens or
 * image data. `capScreen` is the backstop: the whole block stays within
 * `SCREEN_BUDGET` characters of JSON, and keys that look like secrets or
 * images are dropped whatever a publisher puts in `data`.
 */
import type { AiAppTab } from './types';

/** Largest serialized screen block (characters), below the Worker's 3,500 cap. */
export const SCREEN_BUDGET = 3_000;
const TITLE_CAP = 80;
const SUMMARY_CAP = 500;
/** Keys never sent, wherever they sit in `data`. */
const SECRET_KEY = /token|secret|password|image|photo|email|api.?key|auth/i;

export interface ScreenSnapshot {
  tab: AiAppTab;
  title: string;
  summary: string;
  data?: unknown;
}

/** What the Build screen holds, for the planner of its edit tools. Never sent. */
export interface BuildDraftState {
  name: string;
  text: string;
}

const size = (v: unknown): number => JSON.stringify(v).length;

/** A deep copy without secret-looking keys, undefined values or functions. */
function clean(value: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) continue;
      const c = clean(v, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  return value;
}

/** `value` with strings longer than `max` cut (and marked with an ellipsis). */
function cutStrings(value: unknown, max: number): unknown {
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  if (Array.isArray(value)) return value.map((v) => cutStrings(v, max));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cutStrings(v, max)]));
  }
  return value;
}

/** `value` with every array cut to its first `keep` items. */
function cutArrays(value: unknown, keep: number): unknown {
  if (Array.isArray(value)) return value.slice(0, keep).map((v) => cutArrays(v, keep));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cutArrays(v, keep)]));
  }
  return value;
}

/**
 * The snapshot with title and summary clamped and `data` shrunk until the
 * whole block fits: long strings first, then long lists, then `data` goes.
 */
export function capScreen(snapshot: ScreenSnapshot): ScreenSnapshot {
  const head = {
    tab: snapshot.tab,
    title: snapshot.title.slice(0, TITLE_CAP),
    summary: snapshot.summary.slice(0, SUMMARY_CAP),
  };
  if (snapshot.data === undefined) return head;
  let data: unknown = clean(snapshot.data);
  const fits = (d: unknown) => size({ ...head, data: d }) <= SCREEN_BUDGET;
  if (!fits(data)) {
    for (const max of [1_500, 800, 400, 200]) {
      data = cutStrings(data, max);
      if (fits(data)) break;
    }
  }
  if (!fits(data)) {
    for (const keep of [20, 10, 5, 2]) {
      data = cutArrays(data, keep);
      if (fits(data)) break;
    }
  }
  return fits(data) ? { ...head, data } : head;
}
