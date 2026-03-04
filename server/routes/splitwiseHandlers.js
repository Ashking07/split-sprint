/**
 * Shared handlers for Splitwise OAuth - used by both Express router (local) and
 * dedicated Vercel functions (production). Bypasses rewrite/path-restore for reliability.
 */
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import { verifyToken } from "../lib/auth.js";
import { SplitwiseConnection } from "../models/SplitwiseConnection.js";
import { SplitwiseOAuthState } from "../models/SplitwiseOAuthState.js";

const SPLITWISE_AUTH_URL = "https://secure.splitwise.com/oauth/authorize";
const SPLITWISE_TOKEN_URL = "https://secure.splitwise.com/oauth/token";
const SCOPES = process.env.SPLITWISE_SCOPES || "";

const ALLOWED_ORIGINS_RAW = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set(ALLOWED_ORIGINS_RAW);

function isOriginAllowed(origin) {
  const o = (origin || "").replace(/\/$/, "");
  if (ALLOWED_ORIGINS.has(o)) return true;
  if (ALLOWED_ORIGINS.has("http://*:5173") && /^https?:\/\/[^/]+:5173\/?$/.test(o)) return true;
  if (ALLOWED_ORIGINS.has("http://*:5174") && /^https?:\/\/[^/]+:5174\/?$/.test(o)) return true;
  return false;
}

function getRequestOrigin(req) {
  const appOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const proto = req.get("x-forwarded-proto") || "http";
  if (!host && appOrigin) return appOrigin;
  if (!host) return appOrigin || "http://localhost:5173";
  return `${proto}://${host}`.replace(/\/$/, "");
}

async function getUserIdForConnect(req) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) return verifyToken(token);
  const urlToken = req.query?.token;
  if (urlToken) return verifyToken(urlToken);
  return null;
}

function toObjectId(userId) {
  if (!userId) return null;
  return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
}

export async function connectHandler(req, res) {
  const userId = await getUserIdForConnect(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Log in and try again." });
  }
  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const redirectUri = process.env.SPLITWISE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Splitwise integration not configured" });
  }
  const returnTo = req.query?.returnTo || "integrations";
  let origin = (req.query?.origin || process.env.APP_ORIGIN || "http://localhost:5173").replace(/\/$/, "");

  const appOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (!isOriginAllowed(origin) && appOrigin) origin = appOrigin;
  if (!isOriginAllowed(origin) && origin !== appOrigin) {
    return res.status(400).json({
      error: "Bad origin. Set ALLOWED_ORIGINS and APP_ORIGIN in Vercel to your app URL (e.g. https://split-sprint.vercel.app)",
    });
  }

  const state = crypto.randomBytes(32).toString("hex");
  const oauthRedirectUri =
    redirectUri && redirectUri.startsWith("https://")
      ? redirectUri.replace(/\/$/, "")
      : `${origin.replace(/\/$/, "")}/api/splitwise/callback`;

  await connectDB();
  await SplitwiseOAuthState.create({ state, userId: String(userId), origin, returnTo, oauthRedirectUri });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthRedirectUri,
    response_type: "code",
    state,
    ...(SCOPES && { scope: SCOPES }),
  });
  res.redirect(`${SPLITWISE_AUTH_URL}?${params.toString()}`);
}

export async function callbackHandler(req, res) {
  const { code, state } = req.query;
  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const clientSecret = process.env.SPLITWISE_CLIENT_SECRET;
  const requestOrigin = getRequestOrigin(req);

  if (!code || !state) {
    return res.redirect(`${requestOrigin}/?splitwise=error&message=missing_params`);
  }

  await connectDB();
  const stateDoc = await SplitwiseOAuthState.findOneAndDelete({ state });
  if (!stateDoc) {
    return res.redirect(`${requestOrigin}/?splitwise=error&message=invalid_state`);
  }

  const { userId: storedUserId, origin, returnTo, oauthRedirectUri } = stateDoc;
  const redirectUri = oauthRedirectUri || process.env.SPLITWISE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${requestOrigin}/?splitwise=error&message=not_configured`);
  }

  try {
    const tokenRes = await fetch(SPLITWISE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      const err = tokenData?.error_description || tokenData?.error || "Token exchange failed";
      return res.redirect(`${requestOrigin}/?splitwise=error&message=${encodeURIComponent(err)}`);
    }

    const accessToken = tokenData.access_token;
    const tokenType = (tokenData.token_type || "Bearer").trim();
    if (!accessToken) {
      console.error("[Splitwise] Token response missing access_token:", Object.keys(tokenData));
      return res.redirect(`${requestOrigin}/?splitwise=error&message=invalid_token_response`);
    }

    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    const apiBase = process.env.SPLITWISE_BASE_URL || "https://secure.splitwise.com/api/v3.0";
    const userRes = await fetch(`${apiBase}/get_current_user`, {
      headers: { Authorization: `${tokenType} ${accessToken}` },
    });
    const userData = await userRes.json();
    const swUser = userData?.user;

    const finalReturnTo = returnTo || "integrations";
    const finalOrigin = origin || requestOrigin;
    const redirectUrl = isOriginAllowed(finalOrigin)
      ? `${finalOrigin}/oauth/splitwise?returnTo=${encodeURIComponent(finalReturnTo)}`
      : `${requestOrigin}/oauth/splitwise?returnTo=${encodeURIComponent(finalReturnTo)}`;

    const userIdObj = toObjectId(storedUserId);
    await SplitwiseConnection.findOneAndUpdate(
      { userId: userIdObj },
      {
        userId: userIdObj,
        splitwiseAccessToken: accessToken,
        splitwiseTokenType: tokenType,
        splitwiseRefreshToken: refreshToken || undefined,
        splitwiseExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
        splitwiseAccountId: swUser?.id,
        splitwiseEmail: swUser?.email,
        splitwiseFirstName: swUser?.first_name,
        splitwiseLastName: swUser?.last_name,
        splitwiseConnectedAt: new Date(),
        revokedAt: null,
      },
      { upsert: true, new: true }
    );

    const safeUrl = redirectUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${safeUrl}"></head><body><p>Redirecting to Splitsprint... <a href="${safeUrl}">Click here if not redirected</a></p></body></html>`
    );
  } catch (err) {
    console.error("Splitwise callback error:", err);
    return res.redirect(`${getRequestOrigin(req)}/?splitwise=error&message=${encodeURIComponent(err.message)}`);
  }
}

export async function statusHandler(req, res) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = await verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  try {
    await connectDB();
    const userIdObj = toObjectId(userId);
    const conn = await SplitwiseConnection.findOne({
      userId: userIdObj,
      $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
    }).lean();

    if (!conn) {
      return res.status(200).json({ connected: false });
    }
    return res.status(200).json({
      connected: true,
      email: conn.splitwiseEmail,
      firstName: conn.splitwiseFirstName,
      lastName: conn.splitwiseLastName,
    });
  } catch (err) {
    console.error("Splitwise status error:", err);
    return res.status(500).json({ error: err.message });
  }
}
