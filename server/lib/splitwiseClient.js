/**
 * Server-only Splitwise API client.
 * Uses stored OAuth access token per user.
 * Resilient: timeout + retry for reads, no retry for mutations.
 */

import mongoose from "mongoose";
import { SplitwiseConnection } from "../models/SplitwiseConnection.js";
import { resilientFetch, classifyError, ExternalServiceError } from "./resilientFetch.js";

/** Timeout for read/idempotent calls (ms) */
const SW_READ_TIMEOUT = 5_000;
/** Timeout for mutation calls (ms) */
const SW_WRITE_TIMEOUT = 8_000;
/** Retries for idempotent reads */
const SW_READ_RETRIES = 1;

const SPLITWISE_BASE = process.env.SPLITWISE_BASE_URL || "https://secure.splitwise.com/api/v3.0";

export async function getSplitwiseToken(userId) {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;
  const conn = await SplitwiseConnection.findOne({
    userId: userIdObj,
    $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
  }).lean();
  return conn;
}

export async function splitwiseFetch(userId, path, options = {}) {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;
  const conn = await getSplitwiseToken(userId);
  if (!conn) {
    throw new Error("Splitwise not connected. Connect your account first.");
  }

  const url = path.startsWith("http") ? path : `${SPLITWISE_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const scheme = (conn.splitwiseTokenType || "Bearer").toLowerCase() === "bearer" ? "Bearer" : (conn.splitwiseTokenType || "Bearer");
  const authValue = `${scheme} ${String(conn.splitwiseAccessToken).trim()}`;
  const method = options.method || "GET";
  const headers = {
    Authorization: authValue,
    ...options.headers,
  };

  let bodyStr;
  if (options.body && method !== "GET") {
    if (path.includes("create_expense") || path.includes("create_group")) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      bodyStr = new URLSearchParams(
        Object.entries(options.body).map(([k, v]) => [k, String(v)])
      ).toString();
    } else {
      headers["Content-Type"] = "application/json";
      bodyStr = JSON.stringify(options.body);
    }
  }

  // Mutations (create_expense, create_group) are NOT retried to avoid duplicates.
  const isMutation = method !== "GET" && (path.includes("create_expense") || path.includes("create_group"));
  const timeoutMs = isMutation ? SW_WRITE_TIMEOUT : SW_READ_TIMEOUT;
  const retries = isMutation ? 0 : SW_READ_RETRIES;

  let res;
  try {
    res = await resilientFetch(url, {
      method,
      headers,
      body: bodyStr,
      timeoutMs,
      retries,
      service: "splitwise",
    });
  } catch (err) {
    // Auth errors from resilientFetch → revoke token
    if (err instanceof ExternalServiceError && err.kind === "auth") {
      console.error("[Splitwise] API auth error:", path);
      await SplitwiseConnection.findOneAndUpdate(
        { userId: userIdObj },
        { revokedAt: new Date() }
      );
      throw new Error("Splitwise connection expired. Please reconnect.");
    }
    throw classifyError(err, "splitwise");
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ExternalServiceError(
      `Splitwise API error: ${res.status} ${res.statusText}`,
      "upstream",
      res.status,
      "splitwise"
    );
  }

  if (!res.ok) {
    const errMsg = data?.errors?.base?.[0] || data?.errors?.cost?.[0] || data?.message || res.statusText;
    throw new ExternalServiceError(
      errMsg || `Splitwise API error: ${res.status}`,
      res.status >= 500 ? "upstream" : "unknown",
      res.status,
      "splitwise"
    );
  }

  return data;
}

/**
 * Upload a receipt image to an existing Splitwise expense.
 * Uses multipart/form-data via native FormData + Blob (Node 18+).
 * @param {string} userId
 * @param {number} expenseId
 * @param {string} imageBase64 - raw base64 (no data: prefix)
 * @returns {Promise<boolean>}
 */
export async function splitwiseUploadReceipt(userId, expenseId, imageBase64) {
  const conn = await getSplitwiseToken(userId);
  if (!conn) return false;

  const scheme = (conn.splitwiseTokenType || "Bearer").toLowerCase() === "bearer"
    ? "Bearer"
    : (conn.splitwiseTokenType || "Bearer");
  const authValue = `${scheme} ${String(conn.splitwiseAccessToken).trim()}`;

  // Strip data-URL prefix if present
  const raw = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  const imageBuffer = Buffer.from(raw, "base64");
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });

  const formData = new FormData();
  formData.set("receipt", blob, "receipt.jpg");

  const url = `${SPLITWISE_BASE}/update_expense/${expenseId}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: authValue },
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[Splitwise] Receipt upload failed (${res.status}):`, text.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Splitwise] Receipt upload error:", err.message);
    return false;
  }
}
