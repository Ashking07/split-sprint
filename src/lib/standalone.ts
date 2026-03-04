/**
 * Detect if the app is running as a standalone PWA (e.g. "Add to Home Screen" on iOS).
 * In standalone mode, we render full-screen without the phone frame.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari standalone (legacy)
  if ((navigator as { standalone?: boolean }).standalone) return true;
  // display-mode: standalone (PWA standard)
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // display-mode: fullscreen
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  // iOS: when launched from home screen, window.outerWidth === window.innerWidth (no browser chrome)
  // This is a heuristic; standalone media query is more reliable when supported
  return false;
}
