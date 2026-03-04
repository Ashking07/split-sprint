/**
 * Opens Splitwise OAuth flow. Navigates directly — no warm-up fetch
 * (warm-up was causing the button to appear unresponsive).
 */
export function openSplitwiseConnect(returnTo: string): void {
  const token = localStorage.getItem("splitsprint-token");
  const base =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!token) {
    alert("Please log in first.");
    return;
  }

  const params = new URLSearchParams({
    token,
    returnTo,
    origin: window.location.origin,
  });
  const url = `${base.replace(/\/$/, "")}/api/splitwise/connect?${params.toString()}`;
  window.location.href = url;
}
