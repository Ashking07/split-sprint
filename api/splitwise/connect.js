import crypto from "crypto";
import { connectDB } from "../lib/mongodb.js";
import { verifyToken } from "../lib/auth.js";
import { SplitwiseOAuthState } from "../models/SplitwiseOAuthState.js";

const SPLITWISE_AUTH_URL = "https://secure.splitwise.com/oauth/authorize";
const SCOPES = process.env.SPLITWISE_SCOPES || "";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers?.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const urlToken = req.query?.token;
  const jwtToken = token || urlToken;

  if (!jwtToken) {
    return res.status(401).json({ error: "Unauthorized. Log in and try again." });
  }

  const userId = await verifyToken(jwtToken);
  if (!userId) {
    return res.status(401).json({ error: "Invalid token. Log in and try again." });
  }

  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const redirectUri = process.env.SPLITWISE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Splitwise integration not configured" });
  }

  const returnTo = req.query?.returnTo || "integrations";
  const origin = req.query?.origin || process.env.APP_ORIGIN || "http://localhost:5173";

  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean)
  );
  if (!allowedOrigins.has(origin)) {
    return res.status(400).json({ error: "Bad origin. Use http://localhost:5173 in dev." });
  }

  const state = crypto.randomBytes(32).toString("hex");

  await connectDB();
  await SplitwiseOAuthState.create({ state, userId: String(userId), origin, returnTo });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    ...(SCOPES && { scope: SCOPES }),
  });

  return res.redirect(302, `${SPLITWISE_AUTH_URL}?${params.toString()}`);
}
