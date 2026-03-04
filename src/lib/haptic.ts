/**
 * Haptic feedback for mobile PWA. Uses Vibration API when available.
 * Light tap on buttons, medium for selections, success/error for outcomes.
 */

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

export function hapticLight(): void {
  if (canVibrate) navigator.vibrate(10);
}

export function hapticMedium(): void {
  if (canVibrate) navigator.vibrate(20);
}

export function hapticSuccess(): void {
  if (canVibrate) navigator.vibrate([30, 50, 30]);
}

export function hapticError(): void {
  if (canVibrate) navigator.vibrate([50, 50, 50]);
}
