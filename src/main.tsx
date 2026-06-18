import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import { StoreProvider } from './providers/StoreProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StoreProvider>
  </StrictMode>
);
