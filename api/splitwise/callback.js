import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import { SplitwiseConnection } from "../models/SplitwiseConnection.js";
import { SplitwiseOAuthState } from "../models/SplitwiseOAuthState.js";

const SPLITWISE_TOKEN_URL = "https://secure.splitwise.com/oauth/token";

function getAppOrigin() {
  return process.env.APP_ORIGIN || "http://localhost:5173";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.redirect(302, `${getAppOrigin()}/?splitwise=error&message=method_not_allowed`);
  }

  const { code, state } = req.query || {};
  if (!code || !state) {
    return res.redirect(302, `${getAppOrigin()}/?splitwise=error&message=missing_params`);
  }

  await connectDB();
  const stateDoc = await SplitwiseOAuthState.findOneAndDelete({ state });
  if (!stateDoc) {
    return res.redirect(302, `${getAppOrigin()}/?splitwise=error&message=invalid_state`);
  }

  const { userId: storedUserId, origin, returnTo } = stateDoc;

  const redirectUri = process.env.SPLITWISE_REDIRECT_URI;
  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const clientSecret = process.env.SPLITWISE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(302, `${getAppOrigin()}/?splitwise=error&message=not_configured`);
  }

  try {
    await connectDB();

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
      return res.redirect(302, `${getAppOrigin()}/?splitwise=error&message=${encodeURIComponent(err)}`);
    }

    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type || "Bearer";
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    const apiBase = process.env.SPLITWISE_BASE_URL || "https://secure.splitwise.com/api/v3.0";
    const userRes = await fetch(`${apiBase}/get_current_user`, {
      headers: { Authorization: `${tokenType} ${accessToken}` },
    });
    const userData = await userRes.json();
    const swUser = userData?.user;

    await SplitwiseConnection.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(storedUserId) },
      {
        userId: new mongoose.Types.ObjectId(storedUserId),
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

    const allowedOrigins = new Set(
      (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean)
    );
    const finalOrigin = allowedOrigins.has(origin) ? origin : getAppOrigin();
    const finalReturnTo = returnTo || "integrations";
    const redirectUrl = `${finalOrigin}/oauth/splitwise?returnTo=${encodeURIComponent(finalReturnTo)}`;

    // Use meta refresh only (no inline script - avoids CSP blocking)
    const safeUrl = redirectUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${safeUrl}"></head><body><p>Redirecting to Splitsprint... <a href="${safeUrl}">Click here if not redirected</a></p></body></html>`
    );
  } catch (err) {
    console.error("Splitwise callback error:", err);
    return res.redirect(302, `${getAppOrigin()}/?splitwise=error&message=${encodeURIComponent(err.message)}`);
  }
}
