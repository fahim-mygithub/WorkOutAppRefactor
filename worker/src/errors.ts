export type AiErrorCode =
  | 'unauthenticated' | 'permission-denied' | 'invalid-argument' | 'not-found'
  | 'resource-exhausted' | 'failed-precondition' | 'internal';

const STATUS: Record<AiErrorCode, number> = {
  unauthenticated: 401, 'permission-denied': 403, 'invalid-argument': 400, 'not-found': 404,
  'resource-exhausted': 429, 'failed-precondition': 503, internal: 502,
};

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiError';
  }
}

export function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

export function errorResponse(err: unknown, headers: Record<string, string>): Response {
  const e = err instanceof AiError ? err : new AiError('internal', 'The AI assistant is temporarily unavailable.');
  return json({ error: { code: e.code, message: e.message } }, STATUS[e.code], headers);
}
