import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import { StoreProvider } from './providers/StoreProvider';
import { ThemeProvider } from './providers/ThemeProvider';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StoreProvider>
  </StrictMode>
);
