import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import { StoreProvider } from './providers/StoreProvider';
import { store } from './store';
import { activeWorkoutRestored } from './store/slices/workoutSlice';
import { loadWorkoutSnapshot, setStoredPlanContext } from './lib/workoutSession';
import { initWorkoutPersistence } from './store/persistWorkout';
import App from './App';

// Self-heal stale deploys: when a lazily-imported route chunk fails to load
// (its hashed filename was replaced by a newer deploy while this older,
// service-worker-cached page was open), reload once to fetch the fresh
// index + chunks. The 10s guard prevents a reload loop if the asset is
// genuinely missing. Without this, a deploy can strand an open session on a
// blank route (e.g. tapping into /workout after a deploy).
window.addEventListener('vite:preloadError', () => {
  const KEY = 'wo:chunkReloadTs';
  const last = Number(sessionStorage.getItem(KEY) || '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

// Restore active workout session before first render
try {
  const snapshot = loadWorkoutSnapshot();
  if (snapshot) {
    store.dispatch(
      activeWorkoutRestored({
        activeWorkout: snapshot.activeWorkout,
        restTimer: snapshot.restTimer,
      }),
    );
    if (snapshot.planContext) {
      setStoredPlanContext(snapshot.planContext);
    }
  }
} catch {
  // Corrupt snapshot / throwing storage is ignored safely
}

// Start autosave and flush listeners
initWorkoutPersistence(store);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);
