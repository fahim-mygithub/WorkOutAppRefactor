import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, User, UserPlus, ArrowRight } from 'lucide-react';

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
    <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 border-b border-blue-500">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Message */}
            <div className="flex-1">
              <p className="text-white text-sm font-medium">
                {message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleLogin}
                className="flex items-center space-x-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </button>

              <button
                onClick={handleSignUp}
                className="flex items-center space-x-1 bg-white hover:bg-gray-100 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                <UserPlus className="w-4 h-4" />
                <span>Sign Up</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Dismiss Button */}
          {showDismiss && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-3 text-white hover:text-gray-200 transition-colors duration-200"
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