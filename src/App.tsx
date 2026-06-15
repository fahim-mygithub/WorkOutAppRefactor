import { AuthProvider } from './contexts/AuthContext';
import { StoreProvider } from './providers/StoreProvider';
import { AppRouter } from './router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthSync } from './hooks/useAuthSync';
import './App.css';
import './styles/animations.css';

function AppContent() {
  // Initialize auth sync
  useAuthSync();

  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </StoreProvider>
  );
}

export default App;