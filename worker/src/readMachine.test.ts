import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { aiRequestSchema, MAX_IMAGE_BASE64_CHARS, readMachineResultSchema } from './schemas';
import { readMachine, submitMachineTool } from './readMachine';
import { SMART_MODEL } from './models';
import { READ_MACHINE_SYSTEM_PROMPT } from './prompts';

const image = { mediaType: 'image/jpeg' as const, data: 'AAAA' };
const machine = {
  name: 'Seated Leg Curl',
  muscleGroups: ['Hamstrings'],
  equipment: 'Machine',
  setupCues: ['Line your knees up with the pivot.', 'Pad just above the heels.'],
  defaultSets: { sets: 3, reps: 12 },
};

const fakeClient = (content: unknown[]) => {
  const create = vi.fn().mockResolvedValue({ content, stop_reason: 'tool_use' });
  return { client: { messages: { create } } as unknown as Anthropic, create };
};

describe('readMachine request', () => {
  it('accepts one base64 photo', () => {
    expect(aiRequestSchema.safeParse({ action: 'readMachine', image }).success).toBe(true);
  });
  it('caps the photo size and checks its type and encoding', () => {
    const big = { ...image, data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS + 4) };
    expect(aiRequestSchema.safeParse({ action: 'readMachine', image: big }).success).toBe(false);
    const atCap = { ...image, data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS) };
    expect(aiRequestSchema.safeParse({ action: 'readMachine', image: atCap }).success).toBe(true);
    expect(aiRequestSchema.safeParse({ action: 'readMachine', image: { ...image, mediaType: 'image/tiff' } }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ action: 'readMachine', image: { ...image, data: 'not base64!' } }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ action: 'readMachine' }).success).toBe(false);
  });
  it('the cap is about 1.5 MB of decoded image', () => {
    expect(MAX_IMAGE_BASE64_CHARS).toBe(2_000_000);
  });
});

describe('chat images', () => {
  const user = (over: object = {}) => ({ role: 'user', content: 'what is this?', ...over });
  it('accepts one photo on a user message', () => {
    expect(aiRequestSchema.safeParse({ action: 'chat', messages: [user({ image })] }).success).toBe(true);
  });
  it('rejects more than one photo, a photo on an assistant turn, or an oversized photo', () => {
    expect(aiRequestSchema.safeParse({
      action: 'chat', messages: [user({ image }), { role: 'assistant', content: 'ok' }, user({ image })],
    }).success).toBe(false);
    expect(aiRequestSchema.safeParse({
      action: 'chat', messages: [user(), { role: 'assistant', content: 'ok', image }],
    }).success).toBe(false);
    const big = { ...image, data: 'A'.repeat(MAX_IMAGE_BASE64_CHARS + 4) };
    expect(aiRequestSchema.safeParse({ action: 'chat', messages: [user({ image: big })] }).success).toBe(false);
  });
});

describe('readMachineResultSchema', () => {
  it('is {name, muscleGroups, equipment, setupCues, defaultSets}', () => {
    expect(readMachineResultSchema.safeParse(machine).success).toBe(true);
    expect(Object.keys(readMachineResultSchema.shape).sort()).toEqual(['defaultSets', 'equipment', 'muscleGroups', 'name', 'setupCues']);
    for (const key of Object.keys(machine)) {
      const { [key]: _drop, ...rest } = machine as Record<string, unknown>;
      expect(readMachineResultSchema.safeParse(rest).success).toBe(false);
    }
  });
});

describe('readMachine', () => {
  it('forces submitMachine on SMART_MODEL with the photo as an image block', async () => {
    const { client, create } = fakeClient([{ type: 'tool_use', id: 't1', name: 'submitMachine', input: machine }]);
    await expect(readMachine(client, image)).resolves.toEqual(machine);
    const req = create.mock.calls[0][0];
    expect(req.model).toBe(SMART_MODEL);
    expect(req.system[0]).toMatchObject({ text: READ_MACHINE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } });
    expect(req.tools).toEqual([submitMachineTool]);
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'submitMachine' });
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].content[0]).toEqual({
      type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
    });
    expect(req.messages[0].content[1]).toMatchObject({ type: 'text' });
  });

  it('returns exactly the result shape, dropping extras and nulls', async () => {
    const { client } = fakeClient([
      { type: 'text', text: 'Looks like a leg curl.' },
      { type: 'tool_use', id: 't1', name: 'submitMachine', input: { ...machine, brand: 'Cybex', note: null } },
    ]);
    const r = await readMachine(client, image);
    expect(r).toEqual(machine);
  });

  it('throws internal without a tool call or on a bad shape', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(readMachine(fakeClient([{ type: 'text', text: 'no' }]).client, image)).rejects.toMatchObject({ code: 'internal' });
    const bad = fakeClient([{ type: 'tool_use', id: 't1', name: 'submitMachine', input: { ...machine, muscleGroups: [] } }]);
    await expect(readMachine(bad.client, image)).rejects.toMatchObject({ code: 'internal' });
    warn.mockRestore();
  });

  it('submitMachine emits a nested defaultSets schema', () => {
    const schema = submitMachineTool.input_schema as { required?: string[]; properties: Record<string, Record<string, unknown>> };
    expect(schema.required?.sort()).toEqual(['defaultSets', 'equipment', 'muscleGroups', 'name', 'setupCues']);
    expect(schema.properties.defaultSets).toMatchObject({ type: 'object', required: ['sets', 'reps'] });
  });
});
