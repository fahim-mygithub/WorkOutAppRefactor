// worker/src/handlers.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildContextPreamble, handleChat } from './handlers';
import { SMART_MODEL } from './models';
import { FakeFirestore } from './data/testing/fakeFirestore';
import { UserData } from './data/userData';

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

  it('strips top-level nulls from tool inputs before validating', async () => {
    const { client } = fakeClient([
      { type: 'tool_use', id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, weight: null, reps: 3, reason: 'missed' } },
    ], 'tool_use');
    const r = await handleChat(client, [{ role: 'user', content: 'missed' }], undefined);
    expect(r.toolCalls).toEqual([
      { id: 't1', name: 'adjustSet', input: { exerciseId: 'e1', fromSetIndex: 2, reps: 3, reason: 'missed' } },
    ]);
  });

  it('sends a photo as an image block before the text of its message', async () => {
    const { client, create } = fakeClient([{ type: 'text', text: 'A leg curl.' }]);
    await handleChat(client, [
      { role: 'user', content: 'what is this?', image: { mediaType: 'image/jpeg', data: 'AAAA' } },
    ], undefined);
    const req = create.mock.calls[0][0];
    expect(req.messages).toEqual([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
        { type: 'text', text: 'what is this?' },
      ],
    }]);
  });

  it('chat loop runs a read tool and returns the final text', async () => {
    const uid = 'user-token-abc';
    const fakeFs = new FakeFirestore();
    fakeFs.put(['users', uid, 'workout_history', 'w1'], {
      name: 'Upper Body',
      startTime: new Date('2026-10-25T10:00:00Z'),
      endTime: new Date('2026-10-25T11:00:00Z'),
      duration: 60,
      totalExercises: 2,
      totalSets: 6,
      totalReps: 50,
      totalVolume: 5000,
    });

    const create = vi
      .fn()
      // Round 1: Model calls list_history
      .mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'call_1', name: 'list_history', input: { kind: 'workouts', pageSize: 5 } },
        ],
        stop_reason: 'tool_use',
      })
      // Round 2: Model receives history result and replies with text
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Your last session was Upper Body on 2026-10-25.' }],
        stop_reason: 'end_turn',
      });

    const client = { messages: { create } } as unknown as Anthropic;
    const r = await handleChat(client, [{ role: 'user', content: 'What was my last session?' }], undefined, {
      uid,
      firestore: fakeFs.client(),
      userData: new UserData(fakeFs.client(), uid),
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(r.text).toBe('Your last session was Upper Body on 2026-10-25.');
    expect(r.toolCalls).toHaveLength(0);
    expect(r.stopReason).toBe('end_turn');

    // Check round 2 message contained tool_result
    const secondCallMessages = create.mock.calls[1][0].messages;
    const userToolResult = secondCallMessages[secondCallMessages.length - 1];
    expect(userToolResult.role).toBe('user');
    expect(userToolResult.content[0].type).toBe('tool_result');
    expect(userToolResult.content[0].tool_use_id).toBe('call_1');
    expect(userToolResult.content[0].content).toContain('Upper Body');
  });

  it('uid comes from the token, never the model', async () => {
    const verifiedUid = 'verified-lifter-789';
    const fakeFs = new FakeFirestore();
    fakeFs.put(['users', verifiedUid, 'workout_history', 'w1'], {
      name: 'Leg Day',
      startTime: new Date('2026-10-26T10:00:00Z'),
      endTime: new Date('2026-10-26T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 15,
      totalVolume: 3000,
    });

    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [
          // Model calls list_history; even if it attempts to pass a spoofed uid, only verifiedUid is read
          { type: 'tool_use', id: 'call_x', name: 'list_history', input: { kind: 'workouts', pageSize: 5 } },
        ],
        stop_reason: 'tool_use',
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Checked history.' }],
        stop_reason: 'end_turn',
      });

    const client = { messages: { create } } as unknown as Anthropic;
    await handleChat(client, [{ role: 'user', content: 'history' }], undefined, {
      uid: verifiedUid,
      firestore: fakeFs.client(),
      userData: new UserData(fakeFs.client(), verifiedUid),
    });

    // Queries recorded in fakeFs MUST have been executed and MUST target verifiedUid
    expect(fakeFs.requests.length).toBeGreaterThan(0);
    for (const req of fakeFs.requests) {
      expect(req.path[1]).toBe(verifiedUid);
      expect(req.path[1]).not.toBe('spoofed-lifter');
    }
  });

  it('enforces tool-round cap (max 6 rounds) and returns an explanation message', async () => {
    const uid = 'user-loop-test';
    const fakeFs = new FakeFirestore();
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'loop_call', name: 'list_history', input: { kind: 'workouts' } }],
      stop_reason: 'tool_use',
    });

    const client = { messages: { create } } as unknown as Anthropic;
    const r = await handleChat(client, [{ role: 'user', content: 'loop forever' }], undefined, {
      uid,
      firestore: fakeFs.client(),
      userData: new UserData(fakeFs.client(), uid),
    });

    // Should stop at exactly 6 rounds and return a message explaining why
    expect(create).toHaveBeenCalledTimes(6);
    expect(r.stopReason).toBe('tool_use');
    expect(r.text).toContain('reached the tool limit');
  });

  it('preserves proposals emitted in the same turn alongside read calls', async () => {
    const uid = 'user-same-turn';
    const fakeFs = new FakeFirestore();
    fakeFs.put(['users', uid, 'workout_history', 'w1'], {
      name: 'Old Workout',
      startTime: new Date('2026-10-25T10:00:00Z'),
      endTime: new Date('2026-10-25T11:00:00Z'),
      duration: 60,
      totalExercises: 1,
      totalSets: 3,
      totalReps: 15,
      totalVolume: 3000,
    });

    const create = vi
      .fn()
      // Round 1: Model calls BOTH a read tool (list_history) and a write tool (logPastWorkout)
      .mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'read_1', name: 'list_history', input: { kind: 'workouts', pageSize: 5 } },
          {
            type: 'tool_use',
            id: 'write_1',
            name: 'logPastWorkout',
            input: {
              date: '2026-10-28',
              name: 'Push Day',
              exercises: [{ name: 'Bench Press', sets: [{ reps: 10, weight: 185 }] }],
            },
          },
        ],
        stop_reason: 'tool_use',
      })
      // Round 2: Model finishes with response text
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I found your history and prepared the past workout proposal.' }],
        stop_reason: 'end_turn',
      });

    const client = { messages: { create } } as unknown as Anthropic;
    const r = await handleChat(client, [{ role: 'user', content: 'Check and log' }], undefined, {
      uid,
      firestore: fakeFs.client(),
      userData: new UserData(fakeFs.client(), uid),
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(r.text).toBe('I found your history and prepared the past workout proposal.');
    // Proposal from round 1 MUST NOT be dropped
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0]).toEqual({
      id: 'write_1',
      name: 'logPastWorkout',
      input: {
        date: '2026-10-28',
        name: 'Push Day',
        exercises: [{ name: 'Bench Press', sets: [{ reps: 10, weight: 185 }] }],
      },
    });
  });

  it('allows editPastWorkout proposals through handleChat', async () => {
    const { client } = fakeClient([
      {
        type: 'tool_use',
        id: 'edit_1',
        name: 'editPastWorkout',
        input: {
          workoutId: 'w100',
          name: 'Updated Legs',
          exercises: [{ id: 'ex_1', name: 'Squat', sets: [{ reps: 5, weight: 315 }] }],
        },
      },
      { type: 'text', text: 'Here is your update card.' },
    ], 'tool_use');

    const r = await handleChat(client, [{ role: 'user', content: 'Change my squats' }], undefined);
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].name).toBe('editPastWorkout');
    expect(r.toolCalls[0].input).toMatchObject({
      workoutId: 'w100',
      name: 'Updated Legs',
    });
  });
});
