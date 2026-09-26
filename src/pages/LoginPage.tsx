import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Sign in (Tempo): a calm hero on the navy ground. Display title, one line of
 * purpose, filled fields with real labels, one amber "Sign in", Google as a
 * secondary pill, and the remaining routes as plain amber text links. The
 * reset-password flow swaps in place so the screen still has one action.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle, resetPassword, error, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();

    const result = await signIn(email, password);
    if (!result.success) {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    clearError();

    const result = await signInWithGoogle();
    if (!result.success) {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();

    await resetPassword(resetEmail);
    setLoading(false);
    setShowReset(false);
  };

  return (
    <div className="flex min-h-full flex-col justify-center bg-surface px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-body-sm text-ink-muted">{showReset ? 'Password help' : 'Welcome back'}</p>
        <h1 className="mt-1 font-display text-display-lg text-ink">
          {showReset ? 'Reset password' : 'Sign in'}
        </h1>
        <p className="mt-3 max-w-[34ch] text-body text-ink-muted">
          {showReset
            ? "Enter your email and we'll send you a link to set a new password."
            : 'Pick up your training where you left off.'}
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-body-sm text-danger">
            {error}
          </p>
        )}

        {!showReset ? (
          <>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-ink-muted">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="login-password" className="text-ink-muted">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="min-h-touch-min text-body-sm font-semibold text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full px-1"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" size="xl" disabled={loading} className="!mt-8">
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-hairline" />
              <span className="text-body-sm text-ink-subtle">or</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full"
            >
              <GoogleGlyph />
              Continue with Google
            </Button>

            <p className="mt-8 text-center text-body-sm text-ink-muted">
              New here?{' '}
              <Link
                to="/signup"
                className="font-semibold text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:underline"
              >
                Create an account
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-ink-muted">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>

            <Button type="submit" size="xl" disabled={loading} className="!mt-8">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setShowReset(false)}
              className="w-full"
            >
              Back to sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
