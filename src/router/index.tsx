import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('../pages/HomePage'));
const WorkoutPage = lazy(() => import('../pages/WorkoutPage'));
const BuildPage = lazy(() => import('../pages/BuildPage'));
const ExercisesPage = lazy(() => import('../pages/ExercisesPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const SignUpPage = lazy(() => import('../pages/SignUpPage'));
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptBanner } from '../components/AuthPromptBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Shared full-screen loader; reused for auth-loading and Suspense fallback.
// NOTE: bg-gray-900 is a raw gray that design §4 wants tokenized eventually;
// kept as-is here to match existing style (token unification is a separate Phase-1 task).
const FullScreenLoader = () => (
  <div className="flex items-center justify-center h-[100svh] bg-gray-900">
    <div className="text-white text-lg">Loading...</div>
  </div>
);

// Component for shared workout routes that don't require authentication
const SharedWorkoutRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

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

  if (!user) {
    return <LoginPage />;
  }

  return <AppShell>{children}</AppShell>;
};

export const AppRouter = () => {
  const { loading } = useAuth();
  // TODO(perf §5): call useExercises() inside ExercisesPage/BuildPage/ProfilePage
  // so the exercise DB lazy-loads only on those routes (eager root load removed).

  if (loading) {
    return <FullScreenLoader />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          {/* Public routes - shared workouts accessible without authentication */}
          <Route
            path="/workout/shared/:shareId"
            element={
              <SharedWorkoutRoute>
                <ErrorBoundary>
                  <WorkoutPage />
                </ErrorBoundary>
              </SharedWorkoutRoute>
            }
          />
          <Route
            path="/build/shared/:shareId"
            element={
              <SharedWorkoutRoute>
                <ErrorBoundary>
                  <BuildPage />
                </ErrorBoundary>
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
                <ErrorBoundary>
                  <WorkoutPage />
                </ErrorBoundary>
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/build"
            element={
              <AuthenticatedRoute>
                <ErrorBoundary>
                  <BuildPage />
                </ErrorBoundary>
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
      </Suspense>
    </BrowserRouter>
  );
};
