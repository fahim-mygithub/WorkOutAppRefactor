import { describe, it, expect, vi } from 'vitest';
import { computeBaseStrengthMarkers } from '../lib/strengthMarkers';
import type { ExerciseHistory } from '../types/exerciseHistory';
import {
  parseStrengthMarkersAiReply,
  reviewStrengthMarkersWithAi,
} from './strengthMarkersAi';

const sampleHistory: ExerciseHistory[] = [
  {
    id: 'h1',
    userId: 'u1',
    exerciseId: 'bench-press',
    exerciseName: 'Barbell Bench Press',
    workoutDate: new Date('2026-11-10T10:00:00Z'),
    configuration: '3x8',
    muscleGroups: ['Chest'],
    equipment: 'Barbell',
    totalVolume: 4440,
    sets: [
      { setNumber: 1, targetReps: 8, actualReps: 8, weight: 185, unit: 'lbs', completed: true },
    ],
  },
  {
    id: 'h2',
    userId: 'u1',
    exerciseId: 'back-squat',
    exerciseName: 'Back Squat',
    workoutDate: new Date('2026-11-12T10:00:00Z'),
    configuration: '3x5',
    muscleGroups: ['Quads'],
    equipment: 'Barbell',
    totalVolume: 4725,
    sets: [
      { setNumber: 1, targetReps: 5, actualReps: 5, weight: 315, unit: 'lbs', completed: true },
    ],
  },
];

const baseMarkers = computeBaseStrengthMarkers(sampleHistory);

describe('strengthMarkersAi', () => {
  it('sends only exercise stats (no personal profile data) and accepts valid in-band replies', async () => {
    const chatMock = vi.fn().mockResolvedValue({
      reply: JSON.stringify({
        lifts: [
          {
            exerciseName: 'Barbell Bench Press',
            e1RM: 240,
            note: 'Strong 8-rep set supports ~240 lb 1RM.\nSecond line collapsed.',
          },
          {
            exerciseName: 'Back Squat',
            e1RM: 365,
            note: 'Solid 315x5 set.',
          },
        ],
      }),
      toolCalls: [],
      source: 'backend',
    });

    const result = await reviewStrengthMarkersWithAi(baseMarkers, {
      isBackendAvailable: () => true,
      isSignedIn: () => true,
      chat: chatMock,
      now: () => new Date('2026-11-22T00:00:00.000Z'),
    });

    expect(chatMock).toHaveBeenCalledTimes(1);
    const sentPrompt = chatMock.mock.calls[0][0].messages[0].content;
    expect(sentPrompt).toContain('Barbell Bench Press');
    expect(sentPrompt).toContain('formulaE1RM');
    expect(sentPrompt).not.toContain('u1');
    expect(sentPrompt).not.toContain('email');

    expect(result.usedAi).toBe(true);
    expect(result.reviews['bench-press']).toEqual({
      exerciseKey: 'bench-press',
      e1RM: 240,
      note: 'Strong 8-rep set supports ~240 lb 1RM. Second line collapsed.',
      reviewedAt: '2026-11-22T00:00:00.000Z',
      formulaE1RM: 234,
    });
    expect(result.reviews['back-squat']?.e1RM).toBe(365);
  });

  it('rejects out-of-band (+-25%) and malformed AI values', () => {
    const reply = [
      '```json',
      JSON.stringify({
        lifts: [
          // 234 * 1.25 = 292.5 -> 350 is way out of band
          { exerciseName: 'Barbell Bench Press', e1RM: 350, note: 'Too high' },
          // 368 * 0.75 = 276 -> 200 is too low; malformed string also rejected
          { exerciseName: 'Back Squat', e1RM: 200, note: 'Too low' },
        ],
      }),
      '```',
    ].join('\n');

    expect(parseStrengthMarkersAiReply(reply, baseMarkers, '2026-11-22T00:00:00Z')).toEqual({});
    expect(parseStrengthMarkersAiReply('not json at all', baseMarkers, '2026-11-22T00:00:00Z')).toEqual({});
    expect(
      parseStrengthMarkersAiReply(
        JSON.stringify({ lifts: [{ exerciseName: 'Back Squat', e1RM: '370', note: 'string' }] }),
        baseMarkers,
        '2026-11-22T00:00:00Z',
      ),
    ).toEqual({});
  });

  it('falls back silently when backend is unavailable, signed out, fails, or times out', async () => {
    const chatSpy = vi.fn();

    await expect(
      reviewStrengthMarkersWithAi(baseMarkers, {
        isBackendAvailable: () => false,
        isSignedIn: () => true,
        chat: chatSpy,
      }),
    ).resolves.toEqual({ reviews: {}, usedAi: false });

    await expect(
      reviewStrengthMarkersWithAi(baseMarkers, {
        isBackendAvailable: () => true,
        isSignedIn: () => false,
        chat: chatSpy,
      }),
    ).resolves.toEqual({ reviews: {}, usedAi: false });

    expect(chatSpy).not.toHaveBeenCalled();

    await expect(
      reviewStrengthMarkersWithAi(baseMarkers, {
        isBackendAvailable: () => true,
        isSignedIn: () => true,
        chat: vi.fn().mockRejectedValue(new Error('network down')),
      }),
    ).resolves.toEqual({ reviews: {}, usedAi: false });

    await expect(
      reviewStrengthMarkersWithAi(baseMarkers, {
        isBackendAvailable: () => true,
        isSignedIn: () => true,
        timeoutMs: 10,
        chat: () => new Promise(() => {}),
      }),
    ).resolves.toEqual({ reviews: {}, usedAi: false });
  });
});
