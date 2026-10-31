/**
 * The OAuth 2.1 provider around `/mcp` (@cloudflare/workers-oauth-provider):
 * dynamic client registration at /register, Client ID Metadata Documents,
 * /authorize (ours, see authorize.ts), /oauth/token, and the
 * /.well-known metadata a claude.ai connector discovers from the 401.
 */
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { isAllowed } from '../access';
import type { FirestoreRest } from '../data/firestore';
import { UserData } from '../data/userData';
import { handleAuthorize, type VerifyIdToken } from './authorize';
import type { GrantProps, McpEnv } from './env';
import { handleMcpRequest } from './server';

export const MCP_ROUTE = '/mcp';
export const AUTHORIZE_PATH = '/authorize';
export const TOKEN_PATH = '/oauth/token';
export const REGISTER_PATH = '/register';
export const SCOPE = 'workouts';

export interface ConnectorDeps {
  verify: VerifyIdToken;
  /** Firestore as the service account; throws when it isn't configured. */
  firestore: (env: McpEnv) => FirestoreRest;
}

/** Paths the provider owns; everything else is the AI Worker's. */
export function isConnectorPath(pathname: string): boolean {
  return (
    pathname === MCP_ROUTE ||
    pathname.startsWith(`${MCP_ROUTE}/`) ||
    pathname === AUTHORIZE_PATH ||
    pathname === TOKEN_PATH ||
    pathname === REGISTER_PATH ||
    pathname.startsWith('/.well-known/')
  );
}

const jsonError = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });

export function createProvider(origin: string, deps: ConnectorDeps): OAuthProvider<McpEnv> {
  return new OAuthProvider<McpEnv>({
    apiRoute: MCP_ROUTE,
    apiHandler: {
      async fetch(request, env, ctx) {
        const props = (ctx as ExecutionContext & { props?: GrantProps }).props;
        if (!props?.uid) return jsonError(401, 'Not signed in.');
        // Re-checked on every call: removing an email from the list cuts off its existing tokens.
        if (!isAllowed(props.email, env.AI_ALLOWED_EMAILS)) return jsonError(403, 'This account is not enabled.');
        let firestore: FirestoreRest;
        try {
          firestore = deps.firestore(env);
        } catch (err) {
          console.error('connector not configured', err instanceof Error ? err.message : String(err));
          return jsonError(503, 'The connector is not configured.');
        }
        return handleMcpRequest(request, new UserData(firestore, props.uid, { r2: env.EXERCISE_MEDIA, kv: env.AI_USAGE, origin }));
      },
    },
    defaultHandler: {
      fetch(request, env) {
        const { pathname } = new URL(request.url);
        if (pathname === AUTHORIZE_PATH) return handleAuthorize(request, env, deps.verify);
        return new Response('Not found', { status: 404 });
      },
    },
    authorizeEndpoint: AUTHORIZE_PATH,
    tokenEndpoint: TOKEN_PATH,
    clientRegistrationEndpoint: REGISTER_PATH,
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: [SCOPE],
    requiredScopes: [SCOPE],
    resourceMetadata: {
      resource: `${origin}${MCP_ROUTE}`,
      authorization_servers: [origin],
      resource_name: 'WorkoutApp',
    },
  });
}

const providers = new Map<string, OAuthProvider<McpEnv>>();

/** One provider per origin (the canonical resource URL is built from it). */
export function providerFor(origin: string, deps: ConnectorDeps): OAuthProvider<McpEnv> {
  let p = providers.get(origin);
  if (!p) {
    p = createProvider(origin, deps);
    providers.set(origin, p);
  }
  return p;
}
