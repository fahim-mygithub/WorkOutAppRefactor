import { describe, it, expect } from 'vitest';
import { AiError, errorResponse } from './errors';

describe('errorResponse', () => {
  it('maps codes to statuses with a JSON body', async () => {
    const r = errorResponse(new AiError('resource-exhausted', 'Daily AI limit reached.'), {});
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: { code: 'resource-exhausted', message: 'Daily AI limit reached.' } });
  });
  it('hides unknown errors as internal', async () => {
    const r = errorResponse(new Error('secret stack'), {});
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: { code: 'internal', message: 'The AI assistant is temporarily unavailable.' } });
  });
});
