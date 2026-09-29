import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { aiRequestSchema, readLiftResultSchema } from './schemas';
import { handleReadLift } from './handlers';
import { FAST_MODEL } from './models';
import { READ_LIFT_SYSTEM_PROMPT } from './prompts';

const fakeClient = (text: string) => {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text }], stop_reason: 'end_turn' });
  return { client: { messages: { create } } as unknown as Anthropic, create };
};

const base = { name: 'Front Squat', loadKind: 'weight', targetKind: 'reps' };

describe('readLift', () => {
  it('accepts the request', () => {
    expect(aiRequestSchema.safeParse({ action: 'readLift', text: 'front squat 250 for 3x5' }).success).toBe(true);
  });

  it('rejects an empty or oversized request', () => {
    expect(aiRequestSchema.safeParse({ action: 'readLift', text: '' }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ action: 'readLift', text: 'x'.repeat(501) }).success).toBe(false);
  });

  it('validates a result with an optional question', () => {
    expect(readLiftResultSchema.safeParse({
      name: 'Front Squat', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 5,
      sets: 3, rir: 0, equipment: 'barbell', step: 5, question: null,
    }).success).toBe(true);
    expect(readLiftResultSchema.safeParse({ name: 'X', loadKind: 'weight', targetKind: 'reps', question: 'Which machine is pin 12 on?' }).success).toBe(true);
  });

  it('rejects a non-positive, absurd or non-finite step', () => {
    for (const step of [0, -5, 51, Infinity]) {
      expect(readLiftResultSchema.safeParse({ ...base, step }).success).toBe(false);
    }
    expect(readLiftResultSchema.safeParse({ ...base, step: 50 }).success).toBe(true);
    expect(readLiftResultSchema.safeParse({ ...base, step: 2.5 }).success).toBe(true);
  });

  it('rejects non-finite numbers', () => {
    expect(readLiftResultSchema.safeParse({ ...base, weight: Infinity }).success).toBe(false);
    expect(readLiftResultSchema.safeParse({ ...base, targetKind: 'time', seconds: Infinity }).success).toBe(false);
  });

  it('rejects out-of-range sets / rir and unknown equipment', () => {
    expect(readLiftResultSchema.safeParse({ ...base, sets: 11 }).success).toBe(false);
    expect(readLiftResultSchema.safeParse({ ...base, rir: 6 }).success).toBe(false);
    expect(readLiftResultSchema.safeParse({ ...base, equipment: 'kettlebell' }).success).toBe(false);
  });
});

describe('READ_LIFT_SYSTEM_PROMPT', () => {
  it('forbids invented numbers and asks at most one question', () => {
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('Never invent numbers.');
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('ONE short question');
  });
});

describe('handleReadLift', () => {
  it('returns the validated result from FAST_MODEL with a cached system prompt', async () => {
    const { client, create } = fakeClient(
      '```json\n{"name":"Front Squat","loadKind":"weight","weight":250,"unit":"lb","targetKind":"reps","reps":5,"sets":3,"question":null}\n```',
    );
    await expect(handleReadLift(client, 'front squat 250 for 3x5')).resolves.toMatchObject({
      name: 'Front Squat', weight: 250, reps: 5, sets: 3,
    });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe(FAST_MODEL);
    expect(req.system[0]).toMatchObject({ text: READ_LIFT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } });
    expect(req.messages).toEqual([{ role: 'user', content: 'front squat 250 for 3x5' }]);
  });

  it('treats null for unknown lift fields as absent', async () => {
    const { client } = fakeClient(
      '{"name":"Leg Press","loadKind":"level","level":"Pin 12","weight":null,"unit":null,"targetKind":"reps","reps":10,"seconds":null,"question":null}',
    );
    const r = await handleReadLift(client, 'leg press pin 12 for 10');
    expect(r).toMatchObject({ name: 'Leg Press', level: 'Pin 12', reps: 10 });
    expect(r).not.toHaveProperty('weight');
  });

  it('throws internal on a reply that is not JSON', async () => {
    const { client } = fakeClient('Sorry, I cannot help.');
    await expect(handleReadLift(client, 'x')).rejects.toMatchObject({ code: 'internal' });
  });

  it('throws internal on a reply that does not match the schema', async () => {
    const { client } = fakeClient('{"name":"X","loadKind":"weight","targetKind":"reps","step":500}');
    await expect(handleReadLift(client, 'x')).rejects.toMatchObject({ code: 'internal' });
  });

  it('throws internal when the reply has no text block', async () => {
    const create = vi.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn' });
    await expect(handleReadLift({ messages: { create } } as unknown as Anthropic, 'x')).rejects.toMatchObject({ code: 'internal' });
  });
});
