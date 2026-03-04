/**
 * PWA Install Prompt - captures beforeinstallprompt and provides API to show install dialog.
 * On supported browsers (Chrome, Edge), triggers the native "Add to Home Screen" when user accepts.
 * On iOS Safari, shows manual instructions (Share > Add to Home Screen).
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function setDeferredPrompt(e: BeforeInstallPromptEvent | null): void {
  deferredPrompt = e;
}

export function clearDeferredPrompt(): void {
  deferredPrompt = null;
}

export async function triggerInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      clearDeferredPrompt();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function shouldShowInstallPrompt(): boolean {
  return !isStandalone() && (deferredPrompt !== null || isIOS());
}
