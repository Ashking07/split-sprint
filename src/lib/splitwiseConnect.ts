/**
 * Opens Splitwise OAuth flow. Warms the API + MongoDB first to avoid cold-start 504,
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

  const apiBase = base.replace(/\/$/, "");

  // Warm up function + MongoDB by hitting debug/db (awaits actual DB connection)
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${apiBase}/api/debug/db`);
      if (res.ok) break;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const params = new URLSearchParams({
    token,
    returnTo,
    origin: window.location.origin,
  });
  const url = `${apiBase}/api/splitwise/connect?${params.toString()}`;
  window.location.href = url;
}
