import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, User, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthPromptBannerProps {
  message?: string;
  showDismiss?: boolean;
}

export const AuthPromptBanner: React.FC<AuthPromptBannerProps> = ({
  message = "Sign up to save your workout progress and track your fitness journey!",
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
    <div className="sticky top-0 z-50 bg-accent border-b border-border">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-accent-fg/20 rounded-full flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-accent-fg" />
              </div>
            </div>

            {/* Message */}
            <div className="flex-1">
              <p className="text-accent-fg text-body-sm font-medium">
                {message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                size="sm"
                onClick={handleLogin}
                className="bg-accent-fg/20 text-accent-fg hover:bg-accent-fg/30"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSignUp}
                className="bg-surface-raised text-accent hover:bg-surface-raised/90"
              >
                <UserPlus className="w-4 h-4" />
                <span>Sign Up</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Dismiss Button */}
          {showDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-shrink-0 ml-3 text-accent-fg hover:text-accent-fg/80 transition-colors duration-snap"
              title="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
