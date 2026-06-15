import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import WorkoutPage from '../pages/WorkoutPage';
import BuildPage from '../pages/BuildPage';
import ExercisesPage from '../pages/ExercisesPage';
import ProfilePage from '../pages/ProfilePage';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { useExercises } from '../hooks/useExercises';
import { AuthPromptBanner } from '../components/AuthPromptBanner';

// Component for shared workout routes that don't require authentication
const SharedWorkoutRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  console.log('🔗 SharedWorkoutRoute rendering:', {
    user: user?.uid || 'anonymous',
    path: window.location.pathname,
    search: window.location.search,
    hasUser: !!user,
    isAnonymous: !user,
    routeType: 'SharedWorkout'
  });

  // Shell owns layout + scroller + nav. Nav shows only for authenticated viewers.
  return (
    <AppShell showNav={!!user}>
      {/* Show auth prompt banner for non-authenticated users */}
      {!user && (
        <AuthPromptBanner message="Create a free account to save your workout progress and access more features!" />
      )}
      {children}
    </AppShell>
  );
};

// Component for authenticated-only routes
const AuthenticatedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  console.log('🔒 AuthenticatedRoute check:', {
    user: user?.uid || 'anonymous',
    path: window.location.pathname,
    hasUser: !!user,
    willRedirectToLogin: !user
  });

  if (!user) {
    console.log('❌ AuthenticatedRoute: No user, redirecting to login');
    return <LoginPage />;
  }

  console.log('✅ AuthenticatedRoute: User authenticated, rendering protected content');
  return <AppShell>{children}</AppShell>;
};

export const AppRouter = () => {
  const { user, loading } = useAuth();
  useExercises(); // Load exercises on app start

  console.log('🔄 AppRouter rendering:', {
    user: user?.uid || 'anonymous',
    loading,
    currentPath: window.location.pathname,
    currentSearch: window.location.search,
    isSharedWorkoutRoute: window.location.pathname.includes('/shared/'),
    pathSegments: window.location.pathname.split('/').filter(Boolean)
  });

  if (loading) {
    console.log('⏳ AppRouter: Auth loading state, showing spinner');
    return (
      <div className="flex items-center justify-center h-[100svh] bg-gray-900">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  console.log('🚀 AppRouter: Auth loaded, rendering routes');
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - shared workouts accessible without authentication */}
        <Route
          path="/workout/shared/:shareId"
          element={
            <SharedWorkoutRoute>
              <WorkoutPage />
            </SharedWorkoutRoute>
          }
        />
        <Route
          path="/build/shared/:shareId"
          element={
            <SharedWorkoutRoute>
              <BuildPage />
            </SharedWorkoutRoute>
          }
        />

        {/* Authentication routes - always accessible */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/"
          element={
            <AuthenticatedRoute>
              <HomePage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/workout"
          element={
            <AuthenticatedRoute>
              <WorkoutPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/build"
          element={
            <AuthenticatedRoute>
              <BuildPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/exercises"
          element={
            <AuthenticatedRoute>
              <ExercisesPage />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthenticatedRoute>
              <ProfilePage />
            </AuthenticatedRoute>
          }
        />

        {/* Fallback for any unmatched routes */}
        <Route
          path="*"
          element={
            <AuthenticatedRoute>
              <HomePage />
            </AuthenticatedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};