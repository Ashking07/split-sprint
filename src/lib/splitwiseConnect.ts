/**
 * Opens Splitwise OAuth flow. Uses popup on iOS PWA to avoid redirect leaving the app context.
 * Falls back to same-tab when popup is blocked.
 */

const SPLITWISE_CONNECTED = "splitsprint_splitwise_connected";

export function openSplitwiseConnect(returnTo: string): void {
  const token = localStorage.getItem("splitsprint-token");
  const base = import.meta.env.VITE_API_URL || "";
  if (!token) {
    alert("Please log in first.");
    return;
  }

  const params = new URLSearchParams({
    token,
    returnTo,
    origin: window.location.origin,
  });
  const url = `${base || ""}/api/splitwise/connect?${params.toString()}`;

  // On iOS PWA, same-tab redirect often opens Safari and doesn't return to the app.
  // Try popup first - it keeps the flow in a separate window that we can close.
  const isStandalone = /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    (window.navigator as { standalone?: boolean }).standalone === true;

  if (isStandalone) {
    const w = window.open(url, "splitwise_oauth", "width=500,height=600,scrollbars=yes");
    if (w) {
      let checkClosed: ReturnType<typeof setInterval>;
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === SPLITWISE_CONNECTED) {
          window.removeEventListener("message", onMessage);
          clearInterval(checkClosed);
          import("./groupsCache").then((m) => m.prefetchGroups());
          window.location.href = `/?screen=${encodeURIComponent(e.data.returnTo || returnTo)}`;
        }
      };
      window.addEventListener("message", onMessage);
      checkClosed = setInterval(() => {
        if (w.closed) {
          window.removeEventListener("message", onMessage);
          clearInterval(checkClosed);
          window.location.href = `/?screen=${encodeURIComponent(returnTo)}`;
        }
      }, 500);
    } else {
      // Popup blocked - fall back to same-tab
      window.location.href = url;
    }
  } else {
    window.location.href = url;
  }
}

export function notifySplitwiseConnected(returnTo: string): void {
  if (window.opener) {
    window.opener.postMessage({ type: SPLITWISE_CONNECTED, returnTo }, window.location.origin);
    window.close();
  }
}
