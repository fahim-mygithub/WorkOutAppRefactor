// worker/src/handlers.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildContextPreamble, handleChat } from './handlers';
import { SMART_MODEL } from './models';

const fakeClient = (content: unknown[], stop_reason = 'end_turn') => {
  const create = vi.fn().mockResolvedValue({ content, stop_reason });
  return { client: { messages: { create } } as unknown as Anthropic, create };
};

describe('buildContextPreamble', () => {
  it('rejects oversized context', () => {
    expect(buildContextPreamble({ screen: 'workout' })).toContain('"screen":"workout"');
    expect(() => buildContextPreamble({ activeWorkout: 'x'.repeat(40_001) })).toThrow('Context too large.');
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
