import React, { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Applies the effective color theme to <html> from Redux state (DARK-FIRST).
 *
 * tokens.css :root paints dark on cold start, so there is no light flash. This
 * provider only opts the document into the resolved mode by toggling the
 * `dark` / `light` classes on document.documentElement:
 *   - effective dark  → add `dark`,  remove `light`  (matches tailwind darkMode:'class')
 *   - effective light → add `light`, remove `dark`   (.light overrides to light palette)
 *
 * Theme source is state.user.preferences.theme ('light' | 'dark' | 'system').
 * 'system' resolves via prefers-color-scheme and re-resolves on OS change.
 *
 * No React context is exported — theme state already lives in Redux. This must
 * render inside <StoreProvider> so useAppSelector works.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const theme = useAppSelector((state) => state.user.preferences.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
      root.classList.toggle('light', !isDark);
    };

    if (theme !== 'system') {
      apply(theme === 'dark');
      return;
    }

    // 'system': follow the OS preference and keep following it while mounted.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    apply(media.matches);

    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener('change', onChange);

    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [theme]);

  return <>{children}</>;
};
