/**
 * Resilient fetch wrapper with timeout, retry, and error classification.
 *
 * - AbortController-based timeout for every request.
 * - Exponential backoff + jitter for retries on safe/idempotent calls.
 * - Error classification (timeout, network, upstream, auth, unknown).
 */

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export class ExternalServiceError extends Error {
  /**
   * @param {string} message
   * @param {"timeout"|"network"|"upstream"|"auth"|"rate_limit"|"unknown"} kind
   * @param {number} [status]
   * @param {string} [service]
   */
  constructor(message, kind, status, service) {
    super(message);
    this.name = "ExternalServiceError";
    this.kind = kind;
    this.status = status ?? null;
    this.service = service ?? null;
  }
}

/**
 * Classify a caught error into an ExternalServiceError.
 * @param {unknown} err
 * @param {string} service - e.g. "splitwise", "openai"
 * @returns {ExternalServiceError}
 */
export function classifyError(err, service) {
  if (err instanceof ExternalServiceError) return err;

  const msg = err?.message ?? String(err);

  if (err?.name === "AbortError" || msg.includes("aborted")) {
    return new ExternalServiceError(
      `${service} request timed out`,
      "timeout",
      undefined,
      service
    );
  }

  if (
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNRESET") ||
    msg.includes("socket hang up")
  ) {
    return new ExternalServiceError(
      `${service} network error: ${msg}`,
      "network",
      undefined,
      service
    );
  }

  return new ExternalServiceError(msg, "unknown", undefined, service);
}

// ---------------------------------------------------------------------------
// Resilient fetch
// ---------------------------------------------------------------------------

/** @type {(ms: number) => Promise<void>} */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Compute delay with exponential backoff + jitter, capped at 4 s.
 * @param {number} attempt 0-indexed
 * @returns {number} milliseconds
 */
function backoffMs(attempt) {
  const base = Math.min(4000, 500 * 2 ** attempt);
  return base + Math.random() * base * 0.3; // up to 30 % jitter
}

/**
 * Fetch with timeout and optional retry.
 *
 * @param {string | URL} url
 * @param {RequestInit & {
 *   timeoutMs?: number;
 *   retries?: number;
 *   service?: string;
 * }} [options]
 * @returns {Promise<Response>}
 */
export async function resilientFetch(url, options = {}) {
  const { timeoutMs = 8000, retries = 0, service = "external", ...fetchOpts } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Classify HTTP-level failures so callers can react uniformly
      if (res.status === 401 || res.status === 403) {
        throw new ExternalServiceError(
          `${service} auth error (${res.status})`,
          "auth",
          res.status,
          service
        );
      }
      if (res.status === 429) {
        throw new ExternalServiceError(
          `${service} rate limited`,
          "rate_limit",
          429,
          service
        );
      }

      // 5xx → retryable upstream error
      if (res.status >= 500) {
        throw new ExternalServiceError(
          `${service} upstream error (${res.status})`,
          "upstream",
          res.status,
          service
        );
      }

      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = classifyError(err, service);

      // Only retry on transient errors
      const retryable =
        lastError.kind === "timeout" ||
        lastError.kind === "network" ||
        lastError.kind === "upstream" ||
        lastError.kind === "rate_limit";

      if (!retryable || attempt >= retries) {
        throw lastError;
      }

      await sleep(backoffMs(attempt));
    }
  }

  throw lastError;
}
