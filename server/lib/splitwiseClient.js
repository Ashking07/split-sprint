/**
 * Server-only Splitwise API client.
 * Uses stored OAuth access token per user.
 */

import mongoose from "mongoose";
import { SplitwiseConnection } from "../models/SplitwiseConnection.js";

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

  const res = await fetch(url, {
    method,
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Splitwise API error: ${res.status} ${res.statusText}`);
  }

  if (res.status === 401 || res.status === 403) {
    console.error("[Splitwise] API 401/403:", path, "response:", text?.slice(0, 200));
    await SplitwiseConnection.findOneAndUpdate(
      { userId: userIdObj },
      { revokedAt: new Date() }
    );
    throw new Error("Splitwise connection expired. Please reconnect.");
  }

  if (!res.ok) {
    const errMsg = data?.errors?.base?.[0] || data?.errors?.cost?.[0] || data?.message || res.statusText;
    throw new Error(errMsg || `Splitwise API error: ${res.status}`);
  }

  return data;
}
