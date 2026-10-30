/**
 * Worker entry. `/mcp`, the OAuth endpoints and `/.well-known/*` go to the
 * Claude connector (src/mcp); every other request goes to the AI Worker's
 * original handler (src/index.ts) untouched.
 */
import legacy from './index';
import { verifyIdToken } from './access';
import { createFirestoreRest } from './data/firestore';
import { parseServiceAccount, serviceAccountTokenSource } from './data/googleAuth';
import type { McpEnv } from './mcp/env';
import { isConnectorPath, providerFor, type ConnectorDeps } from './mcp/provider';

export interface MainDeps extends ConnectorDeps {
  legacyFetch: (request: Request, env: McpEnv, ctx: ExecutionContext) => Response | Promise<Response>;
  /** Builds the connector's provider; by default one per origin. */
  provider?: typeof providerFor;
}

export const defaultMainDeps: MainDeps = {
  legacyFetch: (request, env) => legacy.fetch(request, env),
  verify: (token, projectId) => verifyIdToken(token, projectId),
  firestore: (env) =>
    createFirestoreRest(env.FIREBASE_PROJECT_ID, serviceAccountTokenSource(parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT))),
};

export function createWorker(deps: MainDeps = defaultMainDeps) {
  const provider = deps.provider ?? providerFor;
  return {
    fetch(request: Request, env: McpEnv, ctx: ExecutionContext): Response | Promise<Response> {
      const url = new URL(request.url);
      if (isConnectorPath(url.pathname)) return provider(url.origin, deps).fetch(request, env, ctx);
      return deps.legacyFetch(request, env, ctx);
    },
  };
}

export default createWorker();
