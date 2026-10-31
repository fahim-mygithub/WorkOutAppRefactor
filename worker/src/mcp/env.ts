import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type { Env } from '../index';

/** Bindings the connector adds to the Worker's existing ones (see wrangler.toml). */
export interface McpEnv extends Env {
  /** OAuth clients, grants and tokens (@cloudflare/workers-oauth-provider). */
  OAUTH_KV: KVNamespace;
  /** Secret: the Firebase service-account JSON key. */
  FIREBASE_SERVICE_ACCOUNT: string;
  /** Public Firebase web config, for the sign-in page. */
  FIREBASE_WEB_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  /** Set by the OAuth provider before it calls our handlers. */
  OAUTH_PROVIDER?: OAuthHelpers;
  /** R2 bucket for exercise media (photos, GIFs, videos). */
  EXERCISE_MEDIA?: R2Bucket;
}

/** Stored (encrypted) in the grant; arrives as `ctx.props` on every MCP request. */
export interface GrantProps {
  uid: string;
  email: string;
}
