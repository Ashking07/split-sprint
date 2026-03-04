/**
 * Dedicated Vercel function for Splitwise OAuth connect.
 * Bypasses the /api/(.*) rewrite - no path restore, no query loss.
 */
import { connectHandler } from "../../server/routes/splitwiseHandlers.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return connectHandler(req, res);
}
