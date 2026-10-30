/**
 * Lets node-based vitest load @cloudflare/workers-oauth-provider, which
 * imports `cloudflare:workers` (only workerd provides it). Import this before
 * importing anything that pulls in the provider, then import those modules
 * dynamically. The stub WorkerEntrypoint is enough: we pass plain handlers.
 */
import { register } from 'node:module';

const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') {
    return { url: 'data:text/javascript,export class WorkerEntrypoint {}', shortCircuit: true };
  }
  return next(specifier, context);
}`;

register(`data:text/javascript,${encodeURIComponent(hooks)}`);
