/**
 * Opens Splitwise OAuth flow. Same-tab redirect for reliability across all platforms.
 */

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
  const url = `${base}/api/splitwise/connect?${params.toString()}`;
  window.location.href = url;
}
