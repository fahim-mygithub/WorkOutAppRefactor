// worker/src/handlers.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildContextPreamble, extractJson, handleChat, handleParse } from './handlers';
import { FAST_MODEL, SMART_MODEL } from './models';

const fakeClient = (content: unknown[], stop_reason = 'end_turn') => {
  const create = vi.fn().mockResolvedValue({ content, stop_reason });
  return { client: { messages: { create } } as unknown as Anthropic, create };
};

describe('extractJson', () => {
  it('strips fences and preambles', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('Sure: {"a":1} done')).toBe('{"a":1}');
  });
});

describe('buildContextPreamble', () => {
  it('rejects oversized context', () => {
    expect(buildContextPreamble({ screen: 'workout' })).toContain('"screen":"workout"');
    expect(() => buildContextPreamble({ activeWorkout: 'x'.repeat(40_001) })).toThrow('Context too large.');
  });
});

describe('handleParse', () => {
  it('validates the model JSON', async () => {
    const { client, create } = fakeClient([{ type: 'text', text: '{"exercises":[]}' }]);
    expect(await handleParse(client, 'bench 3x5')).toEqual({ exercises: [] });
    expect(create.mock.calls[0][0].model).toBe(FAST_MODEL);
    const bad = fakeClient([{ type: 'text', text: 'nope' }]);
    await expect(handleParse(bad.client, 'x')).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('handleChat', () => {
  it('returns valid tool calls and drops invalid or unknown ones', async () => {
    const { client, create } = fakeClient([
      { type: 'text', text: 'Dropping 10.' },
      { type: 'tool_use', id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'missed' } },
      { type: 'tool_use', id: 't2', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: -1 } },
      { type: 'tool_use', id: 't3', name: 'deleteEverything', input: {} },
    ], 'tool_use');
    const r = await handleChat(client, [{ role: 'user', content: 'missed' }], { screen: 'workout' });
    expect(r).toEqual({
      text: 'Dropping 10.',
      toolCalls: [{ id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: 205, reason: 'missed' } }],
      stopReason: 'tool_use',
    });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe(SMART_MODEL);
    expect(req.messages[0].content).toMatch(/^CONTEXT/);
  });
});
