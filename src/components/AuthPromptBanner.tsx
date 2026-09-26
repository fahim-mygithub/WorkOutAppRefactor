import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

interface AuthPromptBannerProps {
  message?: string;
  showDismiss?: boolean;
}

/**
 * Sign-up nudge for guests on shared workouts (Tempo): a quiet strip on the
 * subtle surface. It never takes the amber primary away from the page below,
 * so "Create account" is a secondary pill and "Sign in" is plain amber text.
 */
export const AuthPromptBanner: React.FC<AuthPromptBannerProps> = ({
  message = "Create an account to save this workout and track your progress.",
  showDismiss = true
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (isDismissed) {
    return null;
  }

  const handleSignUp = () => {
    // Preserve current location for redirect after signup
    navigate('/signup', {
      state: {
        redirectTo: location.pathname + location.search,
        fromSharedWorkout: true
      }
    });
  };

  const handleLogin = () => {
    // Preserve current location for redirect after login
    navigate('/login', {
      state: {
        redirectTo: location.pathname + location.search,
        fromSharedWorkout: true
      }
    });
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div role="region" aria-label="Create an account" className="sticky top-0 z-50 bg-surface-subtle">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="min-w-0 flex-1 basis-56 text-body-sm text-ink">{message}</p>

        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={handleLogin} className="text-accent hover:text-accent">
            Sign in
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleSignUp}>
            Create account
          </Button>
          {showDismiss && (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              aria-label="Dismiss"
              title="Dismiss"
            >
              <X size={18} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
};
