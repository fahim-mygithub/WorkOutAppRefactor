import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the underlying service so the hook is tested in isolation. The service
// itself is covered by aiClient.test.ts.
vi.mock('@/ai/aiClient', () => ({
  parse: vi.fn(),
  chat: vi.fn(),
  isBackendAvailable: vi.fn(() => true),
  AiBackendError: class AiBackendError extends Error {},
}));

import { useAi } from '@/ai/useAi';
import {
  parse as parseService,
  chat as chatService,
  isBackendAvailable,
} from '@/ai/aiClient';

const parseMock = vi.mocked(parseService);
const chatMock = vi.mocked(chatService);
const availableMock = vi.mocked(isBackendAvailable);

describe('useAi', () => {
  beforeEach(() => {
    parseMock.mockReset();
    chatMock.mockReset();
    availableMock.mockReset();
    availableMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes backendAvailable from the service', () => {
    availableMock.mockReturnValue(false);
    const { result } = renderHook(() => useAi());
    expect(result.current.backendAvailable).toBe(false);
  });

  it('parse() delegates to the service', async () => {
    parseMock.mockResolvedValue({
      workout: { exercises: [], supersets: [] },
      warnings: [],
      source: 'fallback',
    });

    const { result } = renderHook(() => useAi());
    await act(async () => {
      const res = await result.current.parse({ text: '3x10 Squats' });
      expect(res.source).toBe('fallback');
    });
    expect(parseMock).toHaveBeenCalledWith({ text: '3x10 Squats' });
  });

  it('chat() delegates to the service, wrapping messages', async () => {
    chatMock.mockResolvedValue({ reply: 'ok', toolCalls: [], source: 'backend' });

    const { result } = renderHook(() => useAi());
    await act(async () => {
      const res = await result.current.chat([{ role: 'user', content: 'hi' }]);
      expect(res.reply).toBe('ok');
    });
    expect(chatMock).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('recomputes backendAvailable on offline/online events', async () => {
    availableMock.mockReturnValue(true);
    const { result } = renderHook(() => useAi());
    expect(result.current.backendAvailable).toBe(true);

    availableMock.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await waitFor(() => expect(result.current.backendAvailable).toBe(false));

    availableMock.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.backendAvailable).toBe(true));
  });

  it('keeps parse/chat references stable across renders', () => {
    const { result, rerender } = renderHook(() => useAi());
    const firstParse = result.current.parse;
    const firstChat = result.current.chat;
    rerender();
    expect(result.current.parse).toBe(firstParse);
    expect(result.current.chat).toBe(firstChat);
  });
});
