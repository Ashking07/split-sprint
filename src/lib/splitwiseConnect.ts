/**
 * Opens Splitwise OAuth flow. Warms the API first to avoid cold-start 504,
 * then redirects in the same tab for reliability across all platforms.
 */
export async function openSplitwiseConnect(returnTo: string): Promise<void> {
  const token = localStorage.getItem("splitsprint-token");
  const base =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!token) {
    alert("Please log in first.");
    return;
  }

  // Warm up the serverless function before redirecting
  try {
    await fetch(`${base.replace(/\/$/, "")}/api/health`);
  } catch {
    // ignore - even a failed request warms the function
  }

  const params = new URLSearchParams({
    token,
    returnTo,
    origin: window.location.origin,
  });
  const url = `${base.replace(/\/$/, "")}/api/splitwise/connect?${params.toString()}`;
  window.location.href = url;
}
