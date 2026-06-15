/**
 * React hook over the client AI service.
 *
 * Exposes:
 *   - parse(text)  → structured sets (backend when available, else the on-device
 *                    deterministic fallback; never rejects for backend reasons)
 *   - chat(messages) → conversational coaching (backend-only; throws
 *                    `AiBackendError` when no backend is reachable)
 *   - backendAvailable → best-effort flag the UI uses to enable/disable chat
 *     and to label parse results as "offline". Recomputed on online/offline
 *     events so the flag tracks connectivity changes.
 *
 * The hook is a thin, stable wrapper — all resilience/fallback logic lives in
 * `aiClient`, which keeps the hook trivially testable and the service reusable
 * outside React.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  chat as chatService,
  isBackendAvailable,
  parse as parseService,
} from './aiClient';
import type {
  AiChatMessage,
  AiChatResponse,
  AiParseRequest,
  AiParseResponse,
} from './types';

export interface UseAi {
  /** Parse freeform text into structured sets. Falls back offline. */
  parse: (request: AiParseRequest) => Promise<AiParseResponse>;
  /** Chat with tools. Rejects with `AiBackendError` when no backend. */
  chat: (messages: AiChatMessage[]) => Promise<AiChatResponse>;
  /** Best-effort: is a chat-capable backend currently reachable? */
  backendAvailable: boolean;
}

export function useAi(): UseAi {
  const [backendAvailable, setBackendAvailable] = useState<boolean>(() =>
    isBackendAvailable(),
  );

  // Keep the flag in sync with connectivity. The browser fires online/offline
  // on the window; in jsdom these are inert, which is fine.
  useEffect(() => {
    const update = () => setBackendAvailable(isBackendAvailable());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const parse = useCallback(
    (request: AiParseRequest) => parseService(request),
    [],
  );

  const chat = useCallback(
    (messages: AiChatMessage[]) => chatService({ messages }),
    [],
  );

  return { parse, chat, backendAvailable };
}
