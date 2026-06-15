import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loadSharedWorkout, setAnonymousSession, clearCurrentSharedWorkout } from '../store/slices/sharedWorkoutSlice';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Loader2, Share, ArrowLeft } from 'lucide-react';

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

  console.log('📥 SharedWorkoutLoader rendering:', {
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
      console.log('🚀 SharedWorkoutLoader: Loading shared workout:', shareId);
      setHasLoadedOnce(true);
      dispatch(loadSharedWorkout(shareId));

      // Set anonymous session flag if user is not authenticated
      if (!user) {
        console.log('👤 SharedWorkoutLoader: Setting anonymous session');
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
    console.log('❌ SharedWorkoutLoader: No shareId found');
    return <SharedWorkoutNotFoundError message="Invalid share link - no workout ID found" />;
  }

  if (isLoadingShared) {
    console.log('⏳ SharedWorkoutLoader: Loading shared workout...');
    return <SharedWorkoutLoadingState />;
  }

  if (shareError) {
    console.log('❌ SharedWorkoutLoader: Error loading shared workout:', shareError);
    return (
      <SharedWorkoutNotFoundError
        message={shareError}
        shareId={shareId}
      />
    );
  }

  if (!currentSharedWorkout) {
    console.log('❌ SharedWorkoutLoader: No shared workout found after loading');
    return <SharedWorkoutNotFoundError message="Workout not found or has expired" shareId={shareId} />;
  }

  console.log('✅ SharedWorkoutLoader: Successfully loaded shared workout, rendering children');
  return <>{children(currentSharedWorkout)}</>;
};

// Loading state component
const SharedWorkoutLoadingState: React.FC = () => {
  return (
    <div className="min-h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Loading Shared Workout</h2>
        <p className="text-gray-400">Please wait while we fetch the workout...</p>
        <div className="mt-8 flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Share className="w-4 h-4" />
          <span>Shared workout</span>
        </div>
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

  return (
    <div className="min-h-full bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Workout Not Found</h2>

        <p className="text-gray-400 mb-6">
          {message}
        </p>

        {shareId && (
          <div className="bg-gray-800 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500 mb-1">Share ID:</p>
            <p className="text-sm text-gray-300 font-mono break-all">{shareId}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            This could happen if:
          </p>
          <ul className="text-sm text-gray-400 text-left space-y-1">
            <li>• The workout link is invalid or corrupted</li>
            <li>• The workout has been deleted by its creator</li>
            <li>• The workout link has expired</li>
            <li>• There was a network error loading the workout</li>
          </ul>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={handleGoBack}
            className="flex-1 flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <button
            onClick={handleGoHome}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>Need help? Contact the person who shared this workout with you.</p>
        </div>
      </div>
    </div>
  );
};

export default SharedWorkoutLoader;