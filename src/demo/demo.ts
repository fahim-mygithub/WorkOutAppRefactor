/**
 * Demo-mode constants for the public, loginless GitHub Pages build.
 *
 * Enabled at build time by `vite build --mode demo` (which loads `.env.demo`
 * with VITE_DEMO=true). In demo mode the app skips Firebase auth, injects a fake
 * "Demo Lifter" user, seeds some local state, and short-circuits every Firestore
 * read/write — so the published demo never touches the real backend and anyone
 * can experiment without signing in. The normal `npm run build` leaves all of
 * this off (VITE_DEMO undefined → DEMO_MODE false).
 */

/** True only in the dedicated demo build. Statically replaced by Vite. */
export const DEMO_MODE = import.meta.env.VITE_DEMO === 'true';

/** Stable uid for the demo identity; service guards key off it. */
export const DEMO_UID = 'demo-user-123';

/** The fake signed-in user injected into AuthContext. */
export const DEMO_USER = {
  uid: DEMO_UID,
  email: 'demo@workouttracker.app',
  displayName: 'Demo Lifter',
  photoURL: null as string | null,
};

/**
 * Guard for service methods: true when we're in the demo build AND the call is
 * for the demo user. Lets each Firestore method early-return a local stub
 * (`if (isDemo(userId)) return …`) without affecting real (non-demo) builds.
 */
export const isDemo = (uid?: string): boolean => DEMO_MODE && uid === DEMO_UID;
