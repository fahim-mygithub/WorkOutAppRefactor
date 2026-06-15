import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AiBackendError,
  chat,
  isBackendAvailable,
  parse,
  resetAiClient,
} from '@/ai/aiClient';
import type { AiChatResponse, AiParseResponse } from '@/ai/types';

// We never hit real Firebase here. The client exposes a `deps.resolveCallable`
// injection point; each test supplies its own fake callable (or null = no
// backend) so we can drive the backend-available and fallback paths precisely.

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    configurable: true,
    writable: true,
  });
}

/** A fake httpsCallable that resolves with the given data. */
function fakeCallable<T>(data: T) {
  return vi.fn(async () => ({ data }));
}

const backendWorkout: AiParseResponse = {
  workout: {
    exercises: [{ name: 'Backend Squats', sets: [{ reps: 5 }] }],
    supersets: [],
  },
  warnings: [],
  source: 'backend',
};

describe('aiClient', () => {
  beforeEach(() => {
    resetAiClient();
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAiClient();
    setOnline(true);
  });

  describe('parse()', () => {
    it('uses the backend callable when one is available', async () => {
      const callable = fakeCallable(backendWorkout);
      const res = await parse(
        { text: '5x5 Squats' },
        { resolveCallable: () => callable as never },
      );

      expect(callable).toHaveBeenCalledWith({ op: 'parse', text: '5x5 Squats' });
      expect(res.source).toBe('backend');
      expect(res.workout.exercises[0].name).toBe('Backend Squats');
    });

    it('falls back to the deterministic parser when there is NO backend', async () => {
      const res = await parse(
        { text: '3x10 Squats' },
        { resolveCallable: () => null },
      );

      expect(res.source).toBe('fallback');
      expect(res.workout.exercises[0].name).toBe('Squats');
      expect(res.workout.exercises[0].sets).toHaveLength(3);
    });

    it('falls back when the device is offline (never calls the backend)', async () => {
      setOnline(false);
      const callable = fakeCallable(backendWorkout);

      const res = await parse(
        { text: '3x10 Squats' },
        { resolveCallable: () => callable as never },
      );

      expect(callable).not.toHaveBeenCalled();
      expect(res.source).toBe('fallback');
      expect(res.workout.exercises[0].name).toBe('Squats');
    });

    it('falls back when the backend call throws', async () => {
      const callable = vi.fn(async () => {
        throw new Error('network/internal');
      });

      const res = await parse(
        { text: '3x10 Squats' },
        { resolveCallable: () => callable as never },
      );

      expect(callable).toHaveBeenCalled();
      expect(res.source).toBe('fallback');
      expect(res.workout.exercises[0].name).toBe('Squats');
    });

    it('falls back when the backend returns a malformed response', async () => {
      const callable = fakeCallable({ nonsense: true });

      const res = await parse(
        { text: '3x10 Squats' },
        { resolveCallable: () => callable as never },
      );

      expect(res.source).toBe('fallback');
      expect(res.workout.exercises[0].name).toBe('Squats');
    });

    it('forwards knownExerciseNames to the backend', async () => {
      const callable = fakeCallable(backendWorkout);
      await parse(
        { text: '5x5 Squats', knownExerciseNames: ['Squats', 'Bench Press'] },
        { resolveCallable: () => callable as never },
      );

      expect(callable).toHaveBeenCalledWith({
        op: 'parse',
        text: '5x5 Squats',
        knownExerciseNames: ['Squats', 'Bench Press'],
      });
    });
  });

  describe('chat()', () => {
    const chatReply: AiChatResponse = {
      reply: 'Here is a plan.',
      toolCalls: [],
      source: 'backend',
    };

    it('returns the backend reply when a backend is available', async () => {
      const callable = fakeCallable(chatReply);
      const res = await chat(
        { messages: [{ role: 'user', content: 'plan a push day' }] },
        { resolveCallable: () => callable as never },
      );

      expect(callable).toHaveBeenCalledWith({
        op: 'chat',
        messages: [{ role: 'user', content: 'plan a push day' }],
      });
      expect(res.reply).toBe('Here is a plan.');
      expect(res.source).toBe('backend');
    });

    it('throws AiBackendError when there is NO backend (no offline fallback)', async () => {
      await expect(
        chat(
          { messages: [{ role: 'user', content: 'hi' }] },
          { resolveCallable: () => null },
        ),
      ).rejects.toBeInstanceOf(AiBackendError);
    });

    it('throws AiBackendError when offline', async () => {
      setOnline(false);
      const callable = fakeCallable(chatReply);

      await expect(
        chat(
          { messages: [{ role: 'user', content: 'hi' }] },
          { resolveCallable: () => callable as never },
        ),
      ).rejects.toBeInstanceOf(AiBackendError);
      expect(callable).not.toHaveBeenCalled();
    });

    it('wraps a backend failure in AiBackendError (with cause)', async () => {
      const underlying = new Error('boom');
      const callable = vi.fn(async () => {
        throw underlying;
      });

      await expect(
        chat(
          { messages: [{ role: 'user', content: 'hi' }] },
          { resolveCallable: () => callable as never },
        ),
      ).rejects.toMatchObject({
        name: 'AiBackendError',
        cause: underlying,
      });
    });

    it('defaults reply/toolCalls when the backend omits them', async () => {
      const callable = fakeCallable({});
      const res = await chat(
        { messages: [{ role: 'user', content: 'hi' }] },
        { resolveCallable: () => callable as never },
      );
      expect(res.reply).toBe('');
      expect(res.toolCalls).toEqual([]);
    });
  });

  describe('isBackendAvailable()', () => {
    it('is true when a callable resolves and online', () => {
      const callable = fakeCallable(backendWorkout);
      expect(isBackendAvailable({ resolveCallable: () => callable as never })).toBe(
        true,
      );
    });

    it('is false when no callable resolves', () => {
      expect(isBackendAvailable({ resolveCallable: () => null })).toBe(false);
    });

    it('is false when offline even if a callable resolves', () => {
      setOnline(false);
      const callable = fakeCallable(backendWorkout);
      expect(isBackendAvailable({ resolveCallable: () => callable as never })).toBe(
        false,
      );
    });
  });
});
