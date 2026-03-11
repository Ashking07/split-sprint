/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Good enough for single-process (local dev, single Vercel instance).
 * For multi-instance, swap to Redis-backed — same interface.
 */

/** @type {Map<string, number[]>} key → array of timestamps */
const windows = new Map();

/** Evict expired entries periodically to prevent memory leak */
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of windows) {
      // Keep only entries from the last 15 minutes (generous ceiling)
      const cutoff = now - 15 * 60 * 1000;
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) windows.delete(key);
      else windows.set(key, fresh);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block Node process exit
  if (cleanupTimer?.unref) cleanupTimer.unref();
}

/**
 * Check if a request is within the rate limit.
 * @param {string} key - unique key (e.g. "auth:ip:1.2.3.4" or "parse:user:abc123")
 * @param {number} maxRequests - max allowed in the window
 * @param {number} windowMs - sliding window size in ms
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(key, maxRequests, windowMs) {
  startCleanup();

  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = windows.get(key) || [];
  const recent = existing.filter((t) => t > cutoff);

  if (recent.length >= maxRequests) {
    const oldestInWindow = recent[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  recent.push(now);
  windows.set(key, recent);
  return { allowed: true, remaining: maxRequests - recent.length, retryAfterMs: 0 };
}

/**
 * Express middleware factory.
 * @param {{ keyFn: (req) => string, max: number, windowMs: number, message?: string }} opts
 */
export function rateLimitMiddleware({ keyFn, max, windowMs, message }) {
  const msg = message || "Too many requests. Please try again later.";
  return (req, res, next) => {
    const key = keyFn(req);
    const { allowed, remaining, retryAfterMs } = checkRateLimit(key, max, windowMs);
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    if (!allowed) {
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ error: msg });
    }
    next();
  };
}

/**
 * Get client IP from request (respects trust proxy).
 * @param {import("express").Request} req
 * @returns {string}
 */
export function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}
