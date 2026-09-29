import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { aiRequestSchema, readLiftResultSchema } from './schemas';
import { handleReadLift, submitLiftTool } from './handlers';
import { FAST_MODEL } from './models';
import { READ_LIFT_SYSTEM_PROMPT } from './prompts';

/** A fake Anthropic client whose reply is the given content blocks. */
const fakeClient = (content: unknown[]) => {
  const create = vi.fn().mockResolvedValue({ content, stop_reason: 'tool_use' });
  return { client: { messages: { create } } as unknown as Anthropic, create };
};
const toolReply = (input: unknown) => fakeClient([{ type: 'tool_use', id: 't1', name: 'submitLift', input }]);

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
    expect(readLiftResultSchema.safeParse({ ...base, equipment: 'kettle' }).success).toBe(false);
    expect(readLiftResultSchema.safeParse({ ...base, equipment: 'kettlebell' }).success).toBe(true);
  });
});

describe('READ_LIFT_SYSTEM_PROMPT', () => {
  it('forbids invented numbers except default steps, and asks at most one question', () => {
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('Never invent numbers (default steps are the only exception).');
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('ONE short question');
  });
  it('always fills the required fields and omits unknown ones', () => {
    expect(READ_LIFT_SYSTEM_PROMPT).toContain(
      'Always include name, loadKind and targetKind (use targetKind none if unclear). Omit any other field you do not know.',
    );
    expect(READ_LIFT_SYSTEM_PROMPT).not.toContain('Omit any field you do not know.');
  });
  it('gives worked examples and the unit spelling', () => {
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('"lat pulldown pin 12 for 10"');
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('"plank 90s"');
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('"green band pull-aparts 20"');
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('never "lbs"');
    expect(READ_LIFT_SYSTEM_PROMPT).toContain('submitLift');
  });
});

describe('submitLiftTool', () => {
  it('is the result schema as a tool input schema', () => {
    expect(submitLiftTool.name).toBe('submitLift');
    const schema = submitLiftTool.input_schema as { required?: string[]; properties: Record<string, Record<string, unknown>> };
    expect(schema.required?.sort()).toEqual(['loadKind', 'name', 'targetKind']);
    expect(schema.properties.step).toMatchObject({ type: 'number', exclusiveMinimum: 0, maximum: 50 });
    expect(schema.properties.sets).toMatchObject({ type: 'integer', minimum: 1, maximum: 10 });
    expect(schema.properties.equipment).toMatchObject({ type: 'string', enum: expect.arrayContaining(['kettlebell', 'band']) });
    expect(schema.properties.question).toMatchObject({ type: 'string' });
    expect(schema.properties.unit).toMatchObject({ enum: ['lb', 'kg'] });
  });
});

describe('handleReadLift', () => {
  it('forces the submitLift tool on FAST_MODEL with a cached system prompt', async () => {
    const { client, create } = toolReply({
      name: 'Front Squat', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 5, sets: 3,
    });
    await expect(handleReadLift(client, 'front squat 250 for 3x5')).resolves.toEqual({
      name: 'Front Squat', loadKind: 'weight', weight: 250, unit: 'lb', targetKind: 'reps', reps: 5, sets: 3,
    });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe(FAST_MODEL);
    expect(req.system[0]).toMatchObject({ text: READ_LIFT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } });
    expect(req.messages).toEqual([{ role: 'user', content: 'front squat 250 for 3x5' }]);
    expect(req.tools).toEqual([submitLiftTool]);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'submitLift' });
  });

  it('treats null for unknown lift fields as absent', async () => {
    const { client } = toolReply({
      name: 'Leg Press', loadKind: 'level', level: 'Pin 12', weight: null, unit: null, targetKind: 'reps', reps: 10, seconds: null, question: null,
    });
    const r = await handleReadLift(client, 'leg press pin 12 for 10');
    expect(r).toMatchObject({ name: 'Leg Press', level: 'Pin 12', reps: 10 });
    expect(r).not.toHaveProperty('weight');
  });

  it('drops individually invalid optional fields and keeps the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = toolReply({
      name: 'Goblet Squat', loadKind: 'weight', weight: 50, unit: 'lb', targetKind: 'reps', reps: 8,
      sets: 40, rir: 9, equipment: 'kettlebell', step: 500,
    });
    const r = await handleReadLift(client, 'goblet squat 50 for 8');
    expect(r).toEqual({ name: 'Goblet Squat', loadKind: 'weight', weight: 50, unit: 'lb', targetKind: 'reps', reps: 8, equipment: 'kettlebell' });
    expect(warn).toHaveBeenCalledWith('readLift dropped invalid optional fields', ['sets', 'rir', 'step']);
    warn.mockRestore();
  });

  it('throws internal when there is no tool call', async () => {
    const { client } = fakeClient([{ type: 'text', text: '{"name":"X","loadKind":"weight","targetKind":"reps"}' }]);
    await expect(handleReadLift(client, 'x')).rejects.toMatchObject({ code: 'internal' });
  });

  it('throws internal when a required field does not match the schema', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = toolReply({ name: 'X', loadKind: 'banana', targetKind: 'reps' });
    await expect(handleReadLift(client, 'x')).rejects.toMatchObject({ code: 'internal' });
    warn.mockRestore();
  });
});
