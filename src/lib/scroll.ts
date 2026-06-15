/**
 * The id of the single canonical scroll container owned by <AppShell>.
 * Page code must scroll this element, NOT window — window.scrollTo is a no-op
 * because the document/body no longer scrolls (body is overflow:hidden).
 */
export const APP_SCROLL_ID = 'app-scroll';

/**
 * Scroll the app's main scroll container (`#app-scroll`) back to the top.
 * Smoothly when supported, with a safe fallback for older engines.
 *
 * Safe to call from anywhere; it no-ops if the shell isn't mounted yet.
 */
export function scrollAppToTop(behavior: ScrollBehavior = 'smooth'): void {
  if (typeof document === 'undefined') return;

  const el = document.getElementById(APP_SCROLL_ID);
  if (!el) return;

  try {
    el.scrollTo({ top: 0, behavior });
  } catch {
    // Older engines without the options-object overload.
    el.scrollTop = 0;
  }
}
