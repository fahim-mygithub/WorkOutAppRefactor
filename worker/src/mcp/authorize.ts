/**
 * `/authorize`: the page a Claude client opens to connect. GET shows who is
 * asking and a Google sign-in (Firebase JS SDK, loaded from gstatic); POST
 * verifies the Firebase ID token with the Worker's `verifyIdToken`, checks
 * the AI allow-list, and completes the grant with the uid + verified email.
 */
import {
  AuthorizationError,
  CimdFetchError,
  type ConsentDescription,
  type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider';
import { isAllowed } from '../access';
import type { GrantProps, McpEnv } from './env';

export const FIREBASE_SDK_VERSION = '11.10.0';

export type VerifyIdToken = (token: string, projectId: string) => Promise<{ uid: string; email?: string }>;

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, status = 200, headers = new Headers()): Response {
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem;color:#111}
button{font:inherit;padding:.6rem 1rem;border-radius:.5rem;border:1px solid #888;background:#fff;cursor:pointer}
button[disabled]{opacity:.5;cursor:default}
.primary{background:#111;color:#fff;border-color:#111}
.muted{color:#555;font-size:.9rem}
.warn{background:#fff4d6;padding:.5rem .75rem;border-radius:.5rem}
</style></head><body>${body}</body></html>`,
    { status, headers },
  );
}

const errorPage = (message: string, status = 400) =>
  page('Cannot connect', `<h1>Cannot connect</h1><p>${escape(message)}</p>`, status);

export function consentPage(details: ConsentDescription, handle: string, env: McpEnv): string {
  const name = escape(details.clientName);
  const origin = details.clientDomain
    ? `Published by <strong>${escape(details.clientDomain)}</strong>.`
    : 'This app registered itself; its name is not verified.';
  const firebase = JSON.stringify({
    apiKey: env.FIREBASE_WEB_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    projectId: env.FIREBASE_PROJECT_ID,
  }).replace(/</g, '\\u003c');
  const sdk = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  return `<h1>Connect ${name} to your workouts?</h1>
<p>${origin} Access will be sent to <strong>${escape(details.redirectHost)}</strong>.</p>
${details.redirectIsLoopback ? '<p class="warn"><strong>This sends access to an app on your computer.</strong> Continue only if you just started connecting from it.</p>' : ''}
<p>${name} will be able to read your profile, saved workouts, plans and history, and create or change workouts, plans, custom exercises and training preferences. It cannot change your email or sign-in.</p>
<form method="post" id="consent">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <input type="hidden" name="idToken" id="idToken" value="">
  <p><button type="button" id="signin">Sign in with Google</button> <span id="who" class="muted"></span></p>
  <p><button class="primary" name="decision" value="approve" id="approve" disabled>Allow</button>
     <button name="decision" value="deny" formnovalidate>Deny</button></p>
</form>
<script type="module">
import { initializeApp } from '${sdk}/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from '${sdk}/firebase-auth.js';
const auth = getAuth(initializeApp(${firebase}));
const who = document.getElementById('who');
document.getElementById('signin').addEventListener('click', async () => {
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    document.getElementById('idToken').value = await user.getIdToken(true);
    who.textContent = 'Signed in as ' + (user.email || 'your account');
    document.getElementById('approve').disabled = false;
  } catch (e) {
    who.textContent = 'Sign-in failed: ' + (e && e.code ? e.code : 'try again');
  }
});
</script>`;
}

function helpers(env: McpEnv): OAuthHelpers {
  if (!env.OAUTH_PROVIDER) throw new Error('OAuth provider helpers missing');
  return env.OAUTH_PROVIDER;
}

export async function handleAuthorize(request: Request, env: McpEnv, verify: VerifyIdToken): Promise<Response> {
  const oauth = helpers(env);
  try {
    if (request.method === 'GET') {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return page(`Connect ${details.clientName}`, consentPage(details, consent.handle, env), 200, consent.headers);
    }
    if (request.method !== 'POST') return errorPage('Method not allowed.', 405);

    const form = await request.formData();
    const handle = String(form.get('handle') ?? '');
    if (form.get('decision') !== 'approve') {
      const denied = await oauth.denyConsent(request, handle);
      denied.headers.set('location', denied.redirectTo);
      return new Response(null, { status: 302, headers: denied.headers });
    }

    const idToken = String(form.get('idToken') ?? '');
    if (!idToken) return errorPage('Sign in with Google first.', 401);
    let user: { uid: string; email?: string };
    try {
      user = await verify(idToken, env.FIREBASE_PROJECT_ID);
    } catch {
      return errorPage('Sign-in could not be verified. Go back and try again.', 401);
    }
    if (!user.email || !isAllowed(user.email, env.AI_ALLOWED_EMAILS)) {
      return errorPage('This account is not enabled for the Claude connector.', 403);
    }

    const approved = await oauth.approveConsent(request, handle);
    const props: GrantProps = { uid: user.uid, email: user.email };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user.uid,
      metadata: { email: user.email },
      scope: approved.request.scope,
      props,
    });
    approved.headers.set('location', redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (err) {
    if (err instanceof AuthorizationError && err.redirectTo) return Response.redirect(err.redirectTo, 302);
    if (err instanceof AuthorizationError) return errorPage(err.description);
    if (err instanceof CimdFetchError) return errorPage('This app could not be verified.');
    throw err;
  }
}
