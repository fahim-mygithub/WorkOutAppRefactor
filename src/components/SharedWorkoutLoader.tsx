import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loadSharedWorkout, setAnonymousSession, clearCurrentSharedWorkout } from '../store/slices/sharedWorkoutSlice';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface SharedWorkoutLoaderProps {
  children: (workout: any) => React.ReactNode;
  onWorkoutNotFound?: () => void;
}

export const SharedWorkoutLoader: React.FC<SharedWorkoutLoaderProps> = ({
  children,
  onWorkoutNotFound
}) => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { currentSharedWorkout, isLoadingShared, shareError } = useAppSelector(state => state.sharedWorkout);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  console.log('SharedWorkoutLoader rendering:', {
    shareId,
    user: user?.uid || 'anonymous',
    hasLoadedOnce,
    isLoadingShared,
    hasCurrentSharedWorkout: !!currentSharedWorkout,
    shareError
  });

  // Load shared workout when component mounts or shareId changes
  useEffect(() => {
    if (shareId && !hasLoadedOnce) {
      console.log('SharedWorkoutLoader: Loading shared workout:', shareId);
      setHasLoadedOnce(true);
      dispatch(loadSharedWorkout(shareId));

      // Set anonymous session flag if user is not authenticated
      if (!user) {
        console.log('SharedWorkoutLoader: Setting anonymous session');
        dispatch(setAnonymousSession(true));
      }
    }

    // Cleanup on unmount
    return () => {
      if (!shareId) {
        dispatch(clearCurrentSharedWorkout());
      }
    };
  }, [shareId, hasLoadedOnce, user, dispatch]);

  // Handle workout not found
  useEffect(() => {
    if (shareError && !isLoadingShared && hasLoadedOnce) {
      if (onWorkoutNotFound) {
        onWorkoutNotFound();
      }
    }
  }, [shareError, isLoadingShared, hasLoadedOnce, onWorkoutNotFound]);

  if (!shareId) {
    console.log('SharedWorkoutLoader: No shareId found');
    return <SharedWorkoutNotFoundError message="Invalid share link - no workout ID found" />;
  }

  if (isLoadingShared) {
    console.log('SharedWorkoutLoader: Loading shared workout...');
    return <SharedWorkoutLoadingState />;
  }

  if (shareError) {
    console.log('SharedWorkoutLoader: Error loading shared workout:', shareError);
    return (
      <SharedWorkoutNotFoundError
        message={shareError}
        shareId={shareId}
      />
    );
  }

  if (!currentSharedWorkout) {
    console.log('SharedWorkoutLoader: No shared workout found after loading');
    return <SharedWorkoutNotFoundError message="Workout not found or has expired" shareId={shareId} />;
  }

  console.log('SharedWorkoutLoader: Successfully loaded shared workout, rendering children');
  return <>{children(currentSharedWorkout)}</>;
};

/// Loading state component
const SharedWorkoutLoadingState: React.FC = () => {
  return (
    <div className="flex min-h-full items-center bg-surface px-4">
      <div className="mx-auto w-full max-w-sm" aria-busy="true" aria-live="polite">
        <p className="flex items-center gap-2 text-body-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Shared workout
        </p>
        <h2 className="mt-1 font-display text-display text-ink">Loading</h2>
        <p className="mt-3 text-body text-ink-muted">Fetching the workout someone shared with you.</p>
      </div>
    </div>
  );
};

// Error state component
interface SharedWorkoutNotFoundErrorProps {
  message: string;
  shareId?: string;
}

const SharedWorkoutNotFoundError: React.FC<SharedWorkoutNotFoundErrorProps> = ({
  message,
  shareId
}) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const reasons = [
    'The link is incomplete or mistyped',
    'Its creator deleted the workout',
    'The link has expired',
    'The connection dropped while loading',
  ];

  return (
    <div className="min-h-full bg-surface px-4 pb-8 pt-10">
      <div className="mx-auto w-full max-w-sm" role="alert">
        <p className="flex items-center gap-2 text-body-sm text-danger">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Shared workout
        </p>
        <h2 className="mt-1 font-display text-display text-ink">Workout not found</h2>
        <p className="mt-3 text-body text-ink-muted">{message}</p>

        <div className="mt-6 rounded-[20px] bg-surface-subtle px-4 py-2">
          <p className="pt-2 text-body-sm font-semibold text-ink">This can happen when</p>
          <ul className="divide-y divide-hairline text-body-sm text-ink-muted">
            {reasons.map((reason) => (
              <li key={reason} className="py-2.5">{reason}</li>
            ))}
          </ul>
          {shareId && (
            <p className="border-t border-hairline py-2.5 text-caption text-ink-subtle">
              Share ID <span className="break-all font-mono text-ink-muted">{shareId}</span>
            </p>
          )}
        </div>

        <div className="mt-8 space-y-2">
          <Button size="xl" onClick={handleGoHome}>
            Go to Today
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </Button>
        </div>

        <p className="mt-6 text-caption text-ink-subtle">
          Need help? Ask the person who shared it for a new link.
        </p>
      </div>
    </div>
  );
};

export default SharedWorkoutLoader;