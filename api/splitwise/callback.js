/**
 * Dedicated Vercel function for Splitwise OAuth callback.
 * Bypasses the /api/(.*) rewrite - code and state arrive intact.
 */
import { callbackHandler } from "../../server/routes/splitwiseHandlers.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return callbackHandler(req, res);
}
