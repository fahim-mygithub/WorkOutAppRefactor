import { describe, it, expect } from 'vitest';
import { capScreen, SCREEN_BUDGET, type ScreenSnapshot } from './screenSnapshot';

const size = (v: unknown) => JSON.stringify(v).length;

describe('capScreen', () => {
  it('leaves a small snapshot as it is', () => {
    const s: ScreenSnapshot = { tab: 'build', title: 'Build', summary: 'Draft "Push", 2 exercises.', data: { name: 'Push', exercises: [{ name: 'Bench', sets: 3 }] } };
    expect(capScreen(s)).toEqual(s);
  });

  it('clamps the title and summary', () => {
    const out = capScreen({ tab: 'today', title: 't'.repeat(500), summary: 's'.repeat(5_000) });
    expect(out.title).toHaveLength(80);
    expect(out.summary).toHaveLength(500);
    expect('data' in out).toBe(false);
  });

  it('keeps the whole block within the budget: long text is cut first, then long lists', () => {
    const exercises = Array.from({ length: 40 }, (_, k) => ({ name: `Exercise number ${k}`, sets: 3, reps: '8-12', weight: 100 + k }));
    const out = capScreen({ tab: 'build', title: 'Build', summary: 'x', data: { text: 'a'.repeat(9_000), exercises } });
    expect(size(out)).toBeLessThanOrEqual(SCREEN_BUDGET);
    const data = out.data as { text: string; exercises: unknown[] };
    expect(data.text.length).toBeLessThan(9_000);
    expect(data.exercises.length).toBeGreaterThan(0);
  });

  it('drops data entirely when nothing else makes it fit', () => {
    const data = Object.fromEntries(Array.from({ length: 400 }, (_, k) => [`key${k}`, k]));
    const out = capScreen({ tab: 'library', title: 'Library', summary: 'x', data });
    expect(size(out)).toBeLessThanOrEqual(SCREEN_BUDGET);
    expect(out.data).toBeUndefined();
  });

  it('never carries tokens, emails or image data, however deep', () => {
    const out = capScreen({
      tab: 'profile', title: 'Profile', summary: 'x',
      data: { displayName: 'Alex', idToken: 'abc', nested: { apiKey: 'k', photoUrl: 'u', imageData: 'AAAA', keep: 1 }, list: [{ email: 'a@b.c', n: 2 }] },
    });
    expect(out.data).toEqual({ displayName: 'Alex', nested: { keep: 1 }, list: [{ n: 2 }] });
    expect(JSON.stringify(out)).not.toMatch(/abc|AAAA|a@b\.c/);
  });
});
