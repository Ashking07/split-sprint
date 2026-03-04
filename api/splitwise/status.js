/**
 * Dedicated Vercel function for Splitwise status.
 * Bypasses rewrite, returns Cache-Control: no-store to prevent stale responses.
 */
import { statusHandler } from "../../server/routes/splitwiseHandlers.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return statusHandler(req, res);
}
